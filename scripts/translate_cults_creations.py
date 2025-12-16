#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
from typing import Iterable, List

from googletrans import Translator


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Translate cults_creations5000.json entries into Japanese."
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("cults_creations5000.json"),
        help="Path to the source JSON file.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("src/data/cults_creations_translated.json"),
        help="Where to write the translated dataset.",
    )
    parser.add_argument(
        "--cache",
        type=Path,
        default=Path(".translation_cache.json"),
        help="Optional cache of already translated strings.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Only process the first N entries (useful for testing).",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Retranslate strings even when a cache entry exists.",
    )
    parser.add_argument(
        "--start",
        type=int,
        default=0,
        help="0-based index of the first entry to translate. Useful for splitting into chunks.",
    )
    return parser.parse_args()


def load_cache(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        with path.open(encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return {}


def save_cache(path: Path, cache: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(cache, fh, ensure_ascii=False, indent=2)


def chunked(sequence: List[str], chunk_size: int) -> Iterable[List[str]]:
    for i in range(0, len(sequence), chunk_size):
        yield sequence[i : i + chunk_size]


def translate_chunk(
    translator: Translator, chunk: List[str]
) -> List[str]:
    try:
        translations = translator.translate(chunk, dest="ja")
    except Exception:
        translations = []
        for text in chunk:
            try:
                translations.append(translator.translate(text, dest="ja"))
            except Exception:
                translations.append(text)
    result: List[str] = []
    for item in translations:
        if hasattr(item, "text"):
            result.append(item.text)
        else:
            result.append(str(item))
    return result


def translate_pending(
    strings: List[str], translator: Translator, cache: dict, force: bool
) -> None:
    to_translate = []
    seen = set()
    for text in strings:
        if not text:
            continue
        if not force and text in cache:
            continue
        if text in seen:
            continue
        seen.add(text)
        to_translate.append(text)

    for chunk in chunked(to_translate, 10):
        translated_chunk = translate_chunk(translator, chunk)
        for original, translated in zip(chunk, translated_chunk):
            cache[original] = translated or original


def build_entry(entry: dict, translator: Translator, cache: dict, force: bool) -> dict:
    title_en = entry.get("title_en") or ""
    title_ja = entry.get("title_ja")
    if not title_ja or title_ja == title_en:
        translate_pending([title_en], translator, cache, force)
        title_ja = cache.get(title_en, title_en)

    tags_en = entry.get("tags_en") or []
    translate_pending(tags_en, translator, cache, force)
    tags_ja = [cache.get(tag, tag) for tag in tags_en]

    return {
        "title_en": title_en,
        "title_ja": title_ja,
        "image_url": entry.get("image_url"),
        "source_url": entry.get("source_url"),
        "site": entry.get("site"),
        "source_name": entry.get("source_name"),
        "price": entry.get("price"),
        "is_free": entry.get("is_free"),
        "tags_en": tags_en,
        "tags_ja": tags_ja,
    }


def main() -> None:
    args = parse_args()
    if not args.input.exists():
        raise SystemExit(f"{args.input} が見つかりません。")

    data = json.loads(args.input.read_text(encoding="utf-8"))
    translator = Translator()
    cache = load_cache(args.cache)
    output = []
    start = max(0, args.start)
    total = len(data)
    remaining = total - start
    if remaining <= 0:
        raise SystemExit(f"開始位置 {start} はデータ件数 {total} を超えています。")
    limit = args.limit or remaining
    slice_end = min(start + limit, total)

    for entry in data[start:slice_end]:
        image_url = (entry.get("image_url") or "").split("?")[0].lower()
        if image_url.endswith(".gif"):
            continue
        output.append(build_entry(entry, translator, cache, args.force))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as fh:
        json.dump(output, fh, ensure_ascii=False, indent=2)

    save_cache(args.cache, cache)
    print(f"出力: {args.output} ({len(output)} 件)。キャッシュ: {args.cache} に保存。")


if __name__ == "__main__":
    main()
