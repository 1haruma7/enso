import argparse
import json
import os
import time
from pprint import pprint
from typing import Any, Dict, List, Optional

import requests
from googletrans import Translator
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


def parse_cli_args() -> argparse.Namespace:
    # CLI 引数と出力ファイルの指定（デフォルトは src/data/cults_creations.json）
    parser = argparse.ArgumentParser(
        description="Fetch latest Cults3D creations and update the local dataset."
    )
    parser.add_argument("--username", help="Cults3D API username (can also be set via CULTS_USERNAME)")
    parser.add_argument("--password", help="Cults3D API password (can also be set via CULTS_API_PASSWORD)")
    parser.add_argument(
        "--output",
        default="src/data/cults_creations_test.json",
        help="Path to the dataset JSON that should be updated (default: src/data/cults_creations.json)",
    )
    return parser.parse_args()


def require_credential(name: str, cli_value: Optional[str]) -> str:
    """Return credential provided via CLI or environment, otherwise raise clean error."""
    # CLI 引数があるなら優先、それ以外は環境変数から取る
    if cli_value:
        return cli_value
    value = os.environ.get(name)
    if value:
        return value
    # 認証情報が与えられていないときはわかりやすい例外を出す
    raise RuntimeError(
        f"{name} is required. Set it via environment (export {name}=...) or pass --{name.lower().split('_')[-1]}."
    )


ARGS = parse_cli_args()
USERNAME = ("ensocorporation")
API_PASSWORD = ("GwztNLeYM5FOUDXRYjrNehUGN")
GRAPHQL_ENDPOINT = "https://cults3d.com/graphql"

PAGE_SIZE = 50
TARGET_TOTAL = 500
SORT_ORDER = "BY_DOWNLOADS"
SORT_DIRECTION = "DESC"
ONLY_FREE = True
OUTPUT_FILE = ARGS.output
PAGE_TIMEOUT = (10, 30)
MAX_POST_RETRIES = 4
RETRY_BACKOFF = 2

TRANSLATOR = Translator()
TRANSLATION_CACHE: Dict[str, str] = {}

# 取得した文字列を日本語に翻訳し、キャッシュで重複を防止
def translate_text(text: Optional[str]) -> Optional[str]:
    if not text:
        return text
    cached = TRANSLATION_CACHE.get(text)
    if cached is not None:
        return cached
    try:
        translated = TRANSLATOR.translate(text, dest="ja").text
    except Exception:
        translated = text
    TRANSLATION_CACHE[text] = translated
    return translated

SESSION = requests.Session()
SESSION.mount(
    "https://",
    HTTPAdapter(
        max_retries=Retry(
            total=MAX_POST_RETRIES,
            backoff_factor=RETRY_BACKOFF,
            status_forcelist=(429, 502, 503, 504),
            allowed_methods=frozenset(["POST"]),
        )
    ),
)


def load_existing_creations(path: str) -> List[Dict[str, Any]]:
    """Read the existing dataset so we can skip duplicates when appending."""
    if not os.path.isfile(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError) as exc:
        print(f"Warning: could not load {path}: {exc}")
        return []
    if not isinstance(data, list):
        print(f"Warning: expected a list in {path} but got {type(data).__name__}")
        return []
    return data


def filter_new_unique_items(
    existing: List[Dict[str, Any]], candidates: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Return only candidates whose source_url is not already present."""
    seen_urls = {
        item.get("source_url") for item in existing if item.get("source_url")
    }
    unique_items: List[Dict[str, Any]] = []
    for item in candidates:
        source_url = item.get("source_url")
        if source_url and source_url in seen_urls:
            continue
        if source_url:
            seen_urls.add(source_url)
        unique_items.append(item)
    return unique_items


def build_creations_query(sort_order: str, direction: str, only_free: bool) -> str:
    only_free_literal = "true" if only_free else "false"
    return f"""
    query GetCreations($limit: Int!, $offset: Int!) {{
      creationsBatch(onlyFree: {only_free_literal}, sort: {sort_order}, direction: {direction}, limit: $limit, offset: $offset) {{
        results {{
          titleEN: name(locale: EN)
          shortUrl
          illustrationImageUrl
          tagsEN: tags(locale: EN)
          descriptionEN: description(locale: EN)
          price(currency: USD) {{
            formatted
            cents
          }}
        }}
      }}
    }}
    """


def post_graphql(query: str, variables: Dict[str, Any]) -> Dict[str, Any]:
    attempt = 0
    while True:
        attempt += 1
        try:
            response = SESSION.post(
                GRAPHQL_ENDPOINT,
                json={"query": query, "variables": variables},
                auth=(USERNAME, API_PASSWORD),
                timeout=PAGE_TIMEOUT,
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as exc:
            if attempt >= MAX_POST_RETRIES:
                raise RuntimeError(
                    f"GraphQL request failed after {attempt} attempts: {exc}"
                ) from exc
            print(f"GraphQL request failed (attempt {attempt}), retrying...", exc)
            time.sleep(RETRY_BACKOFF * attempt)


def format_price(price: Optional[Dict[str, Any]]) -> Optional[str]:
    if not price:
        return None
    if price.get("formatted"):
        return price["formatted"]
    cents = price.get("cents")
    if cents is None:
        return None
    return f"${cents / 100:.2f}"


def build_creation_payload(creation: Dict[str, Any]) -> Dict[str, Any]:
    price_info = creation.get("price") or {}
    cents = price_info.get("cents")
    is_free = cents == 0 if cents is not None else False

    tags = creation.get("tagsEN") or []
    return {
        "title_en": creation.get("titleEN"),
        "title_ja": translate_text(creation.get("titleEN")),
        "image_url": creation.get("illustrationImageUrl"),
        "source_url": creation.get("shortUrl"),
        "site": "Cults3D",
        "source_name": "Cults3D",
        "price": format_price(price_info),
        "is_free": bool(is_free),
        "tags_en": tags,
        "tags_ja": [translate_text(tag) for tag in tags],
        "description_en": creation.get("descriptionEN"),
        "description_ja": translate_text(creation.get("descriptionEN")),
    }


def collect_creations(
    total: int,
    sort_order: str,
    direction: str,
    only_free: bool,
    page_size: int,
) -> List[Dict[str, Any]]:
    # GraphQL でバッチ取得を行い、取得件数と範囲をログ出力
    # Fetch the requested number of creations in batches, showing progress per request.
    query = build_creations_query(sort_order, direction, only_free)
    offset = 0
    collected: List[Dict[str, Any]] = []
    while len(collected) < total:
        limit = min(page_size, total - len(collected))
        payload = post_graphql(query, {"limit": limit, "offset": offset})
        errors = payload.get("errors")
        if errors:
            print("GraphQL errors:")
            pprint(errors)
            break

        batch = payload.get("data", {}).get("creationsBatch", {})
        results = batch.get("results", [])
        if not results:
            break

        collected.extend(results)
        offset += len(results)
        start_num = len(collected) - len(results) + 1
        end_num = len(collected)
        total_target = total
        print(
            f"Fetched {len(results)} entries "
            f"({start_num}-{end_num} of {total_target})"
        )
        if len(results) < limit:
            break

    return collected[:total]


def main():
    # 全体の流れ：取得 → 翻訳 → 重複除去 → ファイル保存
    creations = collect_creations(
        TARGET_TOTAL,
        SORT_ORDER,
        SORT_DIRECTION,
        ONLY_FREE,
        PAGE_SIZE,
    )
    formatted = [build_creation_payload(c) for c in creations]
    free_items = [item for item in formatted if item.get("is_free")]

    existing_creations = load_existing_creations(OUTPUT_FILE)
    new_creations = filter_new_unique_items(existing_creations, free_items)
    merged_creations = [*existing_creations, *new_creations]

    print(
        f"Retrieved {len(free_items)} Cults creations (sort={SORT_ORDER}, direction={SORT_DIRECTION}, only_free={ONLY_FREE}); "
        f"appended {len(new_creations)} new unique entries."
    )
    pprint(new_creations)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as fh:
        json.dump(merged_creations, fh, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
