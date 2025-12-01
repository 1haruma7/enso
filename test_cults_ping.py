import json
import os
import requests
from pprint import pprint
from typing import Any, Dict, List, Optional

def require_env(name: str) -> str:
    """Raise if the required environment variable is missing."""
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Environment variable {name} is required for this script")
    return value


USERNAME = require_env("CULTS_USERNAME")
API_PASSWORD = require_env("CULTS_API_PASSWORD")
GRAPHQL_ENDPOINT = "https://cults3d.com/graphql"

PAGE_SIZE = 50
TARGET_TOTAL = 2800
SORT_ORDER = "BY_DOWNLOADS"
SORT_DIRECTION = "DESC"
ONLY_FREE = True
OUTPUT_FILE = "cults_creations.json"


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
          price(currency: USD) {{
            formatted
            cents
          }}
        }}
      }}
    }}
    """


def post_graphql(query: str, variables: Dict[str, Any]) -> Dict[str, Any]:
    response = requests.post(
        GRAPHQL_ENDPOINT,
        json={"query": query, "variables": variables},
        auth=(USERNAME, API_PASSWORD),
        timeout=10,
    )

    try:
        return response.json()
    except ValueError:
        raise RuntimeError(
            "Failed to decode JSON response from Cults GraphQL:\n" + response.text
        )


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

    return {
        "title_en": creation.get("titleEN"),
        "title_ja": creation.get("titleEN"),
        "image_url": creation.get("illustrationImageUrl"),
        "source_url": creation.get("shortUrl"),
        "site": "Cults3D",
        "source_name": "Cults3D",
        "price": format_price(price_info),
        "is_free": bool(is_free),
        "tags_en": creation.get("tagsEN") or [],
        "tags_ja": creation.get("tagsEN") or [],
    }


def collect_creations(
    total: int,
    sort_order: str,
    direction: str,
    only_free: bool,
    page_size: int,
) -> List[Dict[str, Any]]:
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
        if len(results) < limit:
            break

    return collected[:total]


def main():
    creations = collect_creations(
        TARGET_TOTAL,
        SORT_ORDER,
        SORT_DIRECTION,
        ONLY_FREE,
        PAGE_SIZE,
    )
    formatted = [build_creation_payload(c) for c in creations]
    formatted = [item for item in formatted if item.get("is_free")]

    print(
        f"Retrieved {len(formatted)} Cults creations (sort={SORT_ORDER}, direction={SORT_DIRECTION}, only_free={ONLY_FREE})."
    )
    pprint(formatted)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as fh:
        json.dump(formatted, fh, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
