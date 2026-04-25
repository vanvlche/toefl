#!/usr/bin/env python3
"""Export repository TOEFL vocabulary data into the iOS seed JSON bundle."""

from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "ios" / "TOEFLVocabApp" / "TOEFLVocabApp" / "Resources" / "seed_words.json"


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []

    with path.open("r", encoding="utf-8-sig", newline="") as file:
        return [dict(row) for row in csv.DictReader(file)]


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []

    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as file:
        for line_number, line in enumerate(file, start=1):
            stripped = line.strip()
            if not stripped:
                continue
            try:
                rows.append(json.loads(stripped))
            except json.JSONDecodeError as exc:
                raise ValueError(f"{path}:{line_number}: invalid JSONL row") from exc
    return rows


def as_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def as_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def normalize_review_state(row: dict[str, str]) -> dict[str, Any]:
    return {
        "word": row.get("word", ""),
        "next_review_date": row.get("next_review_date", ""),
        "interval_days": as_int(row.get("interval_days"), 1),
        "ease": as_float(row.get("ease"), 2.5),
        "consecutive_correct": as_int(row.get("consecutive_correct"), 0),
        "total_wrong": as_int(row.get("total_wrong"), 0),
        "last_seen": row.get("last_seen", ""),
        "last_verdict": row.get("last_verdict", ""),
        "priority": as_int(row.get("priority"), 1),
        "notes": row.get("notes", ""),
    }


def normalize_attempt(row: dict[str, Any]) -> dict[str, Any]:
    gold_meaning = str(row.get("gold_meaning") or "")
    notes = str(row.get("notes") or "")
    rationale = str(row.get("rationale") or "")
    evidence = str(row.get("evidence") or "")
    accepted_range = str(row.get("accepted_range") or "")

    return {
        **row,
        "timestamp": row.get("timestamp", ""),
        "session_id": row.get("session_id", ""),
        "word": row.get("word", ""),
        "user_answer": row.get("user_answer", ""),
        "gold_meaning": gold_meaning,
        "verdict": row.get("verdict", "wrong"),
        "error_types": row.get("error_types") or [],
        "reason_ko": row.get("reason_ko") or rationale or notes,
        "evidence_ko": row.get("evidence_ko") or evidence or "wrong_answers.jsonl 기존 기록에 상세 근거가 없습니다.",
        "accepted_range_ko": row.get("accepted_range_ko") or accepted_range or gold_meaning,
        "correction_ko": row.get("correction_ko") or f"정답 범위: {gold_meaning}",
        "confidence": row.get("confidence") or "medium",
        "source_file": row.get("source_file", ""),
    }


def normalize_confusion_pair(row: dict[str, str]) -> dict[str, Any] | None:
    word_a = row.get("word_a", "").strip()
    word_b = row.get("word_b", "").strip()
    if not word_a or not word_b:
        return None

    return {
        "word_a": word_a,
        "word_b": word_b,
        "reason": row.get("reason", ""),
        "count": as_int(row.get("count"), 0),
        "last_seen": row.get("last_seen", ""),
        "example_hint": row.get("example_hint", ""),
    }


def build_payload(root: Path) -> dict[str, Any]:
    data_dir = root / "data"
    master_rows = read_csv_rows(data_dir / "master_words.csv")
    review_rows = read_csv_rows(data_dir / "review_queue.csv")
    wrong_rows = read_jsonl(data_dir / "wrong_answers.jsonl")
    confusion_rows = read_csv_rows(data_dir / "confusion_pairs.csv")

    reviews_by_word = {
        row.get("word", "").strip(): normalize_review_state(row)
        for row in review_rows
        if row.get("word", "").strip()
    }

    attempts_by_word: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for attempt in wrong_rows:
        word = str(attempt.get("word") or "").strip()
        if word:
            attempts_by_word[word].append(normalize_attempt(attempt))

    words: list[dict[str, Any]] = []
    for row in master_rows:
        word = row.get("word", "").strip()
        if not word:
            continue

        words.append(
            {
                **row,
                "review_state": reviews_by_word.get(word),
                "wrong_attempts": attempts_by_word.get(word, []),
            }
        )

    confusion_pairs = [
        normalized
        for row in confusion_rows
        if (normalized := normalize_confusion_pair(row)) is not None
    ]

    return {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_files": [
            "data/master_words.csv",
            "data/review_queue.csv",
            "data/wrong_answers.jsonl",
            "data/confusion_pairs.csv",
        ],
        "words": words,
        "confusion_pairs": confusion_pairs,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT, help="Repository root containing data/")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="seed_words.json output path")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    root = args.root.resolve()
    output = args.output.resolve()

    payload = build_payload(root)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Wrote {output}")
    print(f"Words: {len(payload['words'])}")
    print(f"Confusion pairs: {len(payload['confusion_pairs'])}")


if __name__ == "__main__":
    main()
