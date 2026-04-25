#!/usr/bin/env python3
"""Export repository TOEFL vocabulary data into the web PWA seed JSON."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import tempfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from export_ios_seed import (
    normalize_attempt,
    normalize_confusion_pair,
    normalize_review_state,
    read_csv_rows,
    read_jsonl,
)


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "web" / "data" / "seed_words.json"
SOURCE_FILES = [
    "data/master_words.csv",
    "data/review_queue.csv",
    "data/wrong_answers.jsonl",
    "data/confusion_pairs.csv",
]
REQUIRED_WORD_FIELDS = [
    "word",
    "entry_type",
    "pos",
    "core_meaning_ko",
    "alt_meanings_ko",
    "accepted_paraphrases_ko",
    "grading_notes",
    "common_confusions_ko",
    "evidence_hint",
    "example_en",
    "example_ko",
]


def warn(message: str) -> None:
    print(f"Warning: {message}", file=sys.stderr)


def normalize_word_key(word: str) -> str:
    return " ".join(word.strip().casefold().split())


def ensure_optional_sources(root: Path) -> None:
    for relative_path in SOURCE_FILES[1:]:
        if not (root / relative_path).exists():
            warn(f"{relative_path} is missing; continuing without it.")


def compute_source_hash(root: Path) -> str:
    digest = hashlib.sha256()
    for relative_path in SOURCE_FILES:
        path = root / relative_path
        digest.update(relative_path.encode("utf-8"))
        digest.update(b"\0")
        if path.exists():
            digest.update(path.read_bytes())
        else:
            digest.update(b"<missing>")
        digest.update(b"\0")
    return digest.hexdigest()


def build_confusion_indexes(confusion_rows: list[dict[str, str]]) -> tuple[list[dict[str, Any]], dict[str, list[str]]]:
    confusion_pairs: list[dict[str, Any]] = []
    hints_by_word: dict[str, list[str]] = defaultdict(list)

    for row in confusion_rows:
        normalized = normalize_confusion_pair(row)
        if normalized is None:
            continue

        confusion_pairs.append(normalized)
        word_a = normalized["word_a"]
        word_b = normalized["word_b"]
        reason = str(normalized.get("reason") or "").strip()
        example_hint = str(normalized.get("example_hint") or "").strip()
        detail_parts = [part for part in [reason, example_hint] if part]
        detail = f" ({'; '.join(detail_parts)})" if detail_parts else ""
        hints_by_word[normalize_word_key(word_a)].append(f"혼동 주의: {word_b}{detail}")
        hints_by_word[normalize_word_key(word_b)].append(f"혼동 주의: {word_a}{detail}")

    return confusion_pairs, hints_by_word


def append_confusion_hints(existing: str, hints: list[str]) -> str:
    result = str(existing or "").strip()
    for hint in hints:
        if hint and hint not in result:
            result = f"{result}; {hint}" if result else hint
    return result


def build_payload(root: Path) -> tuple[dict[str, Any], dict[str, int]]:
    data_dir = root / "data"
    master_path = data_dir / "master_words.csv"
    if not master_path.exists():
        raise FileNotFoundError(f"Required source file is missing: {master_path}")

    ensure_optional_sources(root)
    master_rows = read_csv_rows(master_path)
    review_rows = read_csv_rows(data_dir / "review_queue.csv")
    wrong_rows = read_jsonl(data_dir / "wrong_answers.jsonl")
    confusion_rows = read_csv_rows(data_dir / "confusion_pairs.csv")

    reviews_by_word = {
        normalize_word_key(row.get("word", "")): normalize_review_state(row)
        for row in review_rows
        if row.get("word", "").strip()
    }

    attempts_by_word: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for attempt in wrong_rows:
        word = str(attempt.get("word") or "").strip()
        if word:
            attempts_by_word[normalize_word_key(word)].append(normalize_attempt(attempt))

    confusion_pairs, confusion_hints_by_word = build_confusion_indexes(confusion_rows)

    seen_words: set[str] = set()
    words: list[dict[str, Any]] = []
    review_state_count = 0
    wrong_attempt_count = 0

    for row_number, row in enumerate(master_rows, start=2):
        raw_word = row.get("word", "")
        word = raw_word.strip()
        if not word:
            continue

        word_key = normalize_word_key(word)
        if word_key in seen_words:
            warn(f"duplicate word in master_words.csv at row {row_number}: {word!r}; keeping first row.")
            continue
        seen_words.add(word_key)

        entry: dict[str, Any] = {key: str(value or "") for key, value in row.items()}
        entry["word"] = word
        for field in REQUIRED_WORD_FIELDS:
            entry.setdefault(field, "")
        if not entry["entry_type"]:
            entry["entry_type"] = "word"

        hints = confusion_hints_by_word.get(word_key, [])
        entry["common_confusions_ko"] = append_confusion_hints(entry.get("common_confusions_ko", ""), hints)

        review_state = reviews_by_word.get(word_key)
        attempts = attempts_by_word.get(word_key, [])
        if review_state:
            review_state_count += 1
        wrong_attempt_count += len(attempts)

        entry["review_state"] = review_state
        entry["wrong_attempts"] = attempts
        words.append(entry)

    payload = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_hash": compute_source_hash(root),
        "source_files": SOURCE_FILES,
        "words": words,
        "confusion_pairs": confusion_pairs,
    }

    stats = {
        "words": len(words),
        "review_states": review_state_count,
        "wrong_attempts": wrong_attempt_count,
    }
    return payload, stats


def atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_name: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as file:
            temp_name = file.name
            json.dump(payload, file, ensure_ascii=False, indent=2)
            file.write("\n")
        Path(temp_name).replace(path)
    finally:
        if temp_name:
            temp_path = Path(temp_name)
            if temp_path.exists():
                temp_path.unlink()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT, help="Repository root containing data/")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="web seed_words.json output path")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    root = args.root.resolve()
    output = args.output.resolve()

    payload, stats = build_payload(root)
    atomic_write_json(output, payload)

    print(f"Exported words: {stats['words']}")
    print(f"Review states merged: {stats['review_states']}")
    print(f"Wrong attempts merged: {stats['wrong_attempts']}")
    print(f"Output: {output}")
    print(f"Source hash: {payload['source_hash']}")


if __name__ == "__main__":
    main()
