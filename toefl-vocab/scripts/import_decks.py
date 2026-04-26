#!/usr/bin/env python3
"""Import raw TOEFL deck files into canonical master_words.csv deck tags."""

from __future__ import annotations

import argparse
import csv
import re
import sys
import tempfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
DECK_FILE_RE = re.compile(r"^D([0-9]+)_voca(?:\.(txt|csv|md))?$")
REQUIRED_COLUMNS = [
    "deck_ids",
    "deck_tags",
    "primary_deck_id",
    "source_files",
    "import_notes",
]
DECK_METADATA_COLUMNS = [
    "deck_id",
    "source_file",
    "display_name",
    "word_count",
    "imported_at",
    "notes",
]


@dataclass
class ParsedEntry:
    word: str
    meaning: str
    line_number: int
    raw_line: str
    needs_meaning_review: bool = False


@dataclass
class DeckParseResult:
    deck_id: str
    deck_number: int
    path: Path
    entries: list[ParsedEntry] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    skipped_lines: list[str] = field(default_factory=list)
    raw_duplicate_count: int = 0

    @property
    def source_file(self) -> str:
        return self.path.relative_to(ROOT).as_posix()

    @property
    def unique_word_count(self) -> int:
        return len({normalize_word_key(entry.word) for entry in self.entries})


@dataclass
class ImportStats:
    scanned_files: int = 0
    new_rows: int = 0
    updated_rows: int = 0
    duplicate_words_merged: int = 0
    lines_requiring_review: int = 0
    skipped_lines: int = 0


def normalize_word_key(word: str) -> str:
    return " ".join(str(word or "").strip().casefold().split())


def deck_sort_key(deck_id: str) -> tuple[int, str]:
    match = re.fullmatch(r"D([0-9]+)", str(deck_id or "").strip())
    if match:
        return int(match.group(1)), ""
    return sys.maxsize, str(deck_id or "")


def split_tokens(value: str | None) -> list[str]:
    if not value:
        return []
    tokens = re.split(r"[;,]", str(value))
    return [token.strip() for token in tokens if token.strip()]


def merge_tokens(existing: str | None, additions: Iterable[str], *, sort_decks: bool = False) -> str:
    merged: list[str] = []
    seen: set[str] = set()
    for token in [*split_tokens(existing), *additions]:
        key = token.casefold()
        if not token or key in seen:
            continue
        seen.add(key)
        merged.append(token)
    if sort_decks:
        merged.sort(key=deck_sort_key)
    return ";".join(merged)


def append_note(existing: str | None, note: str) -> str:
    return merge_tokens(existing, [note])


def is_header(parts: list[str]) -> bool:
    if not parts:
        return False
    first = parts[0].strip().casefold()
    second = parts[1].strip().casefold() if len(parts) > 1 else ""
    return (
        first in {"word", "단어"}
        and second in {"meaning", "meanings", "뜻", "의미", "definition", "definitions"}
    ) or "word,meaning" == ",".join(part.strip().casefold() for part in parts[:2])


def strip_markdown_bullet(line: str) -> str:
    return re.sub(r"^\s*[-*]\s+", "", line).strip()


def parse_line(line: str, line_number: int) -> tuple[ParsedEntry | None, str | None]:
    stripped = line.strip()
    if not stripped or stripped.startswith("#"):
        return None, None

    content = strip_markdown_bullet(stripped)
    if content.casefold() in {"word", "word meaning", "word,meaning", "단어", "단어 뜻"}:
        return None, None

    if "\t" in content:
        parts = [part.strip() for part in content.split("\t")]
        if is_header(parts):
            return None, None
        if parts and parts[0]:
            return ParsedEntry(parts[0], parts[1] if len(parts) > 1 else "", line_number, line, len(parts) < 2 or not parts[1]), None

    if "," in content:
        try:
            parts = next(csv.reader([content]))
        except csv.Error as exc:
            return None, f"{line_number}: CSV 파싱 실패: {exc}; raw={line!r}"
        parts = [part.strip() for part in parts]
        if is_header(parts):
            return None, None
        if len(parts) >= 2 and parts[0]:
            return ParsedEntry(parts[0], parts[1], line_number, line, not parts[1]), None

    separator_match = (
        re.match(r"^(.+?)\s+[-–—]\s+(.+)$", content)
        or re.match(r"^(.+?)\s*[:=]\s+(.+)$", content)
        or re.match(r"^(.+?)\s+[:=]\s*(.+)$", content)
    )
    if separator_match:
        word = separator_match.group(1).strip()
        meaning = separator_match.group(2).strip()
        if is_header([word, meaning]):
            return None, None
        if word:
            return ParsedEntry(word, meaning, line_number, line, not meaning), None

    word_only = content.strip()
    if word_only:
        warning = None
        if len(word_only.split()) > 4:
            warning = f"{line_number}: separator 없는 긴 항목입니다. 뜻 없이 review 대상으로 가져옵니다: {word_only!r}"
        return ParsedEntry(word_only, "", line_number, line, True), warning

    return None, f"{line_number}: 해석할 수 없는 줄을 건너뜁니다: {line!r}"


def scan_deck_files(root: Path, deck_filter: str | None = None) -> list[tuple[str, int, Path]]:
    decks_dir = root / "decks"
    if not decks_dir.exists():
        return []

    normalized_filter = deck_filter.upper() if deck_filter else None
    matches: list[tuple[str, int, Path]] = []
    for path in decks_dir.iterdir():
        if not path.is_file():
            continue
        match = DECK_FILE_RE.fullmatch(path.name)
        if not match:
            continue
        deck_number = int(match.group(1))
        deck_id = f"D{deck_number}"
        if normalized_filter and deck_id != normalized_filter:
            continue
        matches.append((deck_id, deck_number, path))

    return sorted(matches, key=lambda item: (item[1], item[2].name))


def parse_deck(deck_id: str, deck_number: int, path: Path) -> DeckParseResult:
    result = DeckParseResult(deck_id=deck_id, deck_number=deck_number, path=path)
    by_word: dict[str, ParsedEntry] = {}

    with path.open("r", encoding="utf-8-sig", newline="") as file:
        for line_number, line in enumerate(file, start=1):
            entry, warning = parse_line(line.rstrip("\n"), line_number)
            if warning:
                result.warnings.append(warning)
            if entry is None:
                if line.strip() and warning:
                    result.skipped_lines.append(warning)
                continue

            key = normalize_word_key(entry.word)
            existing = by_word.get(key)
            if existing:
                result.raw_duplicate_count += 1
                if not existing.meaning and entry.meaning:
                    existing.meaning = entry.meaning
                    existing.needs_meaning_review = False
                result.warnings.append(f"{line_number}: raw deck 중복 단어 병합: {entry.word!r}")
                continue
            by_word[key] = entry

    result.entries = list(by_word.values())
    return result


def read_master(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    if not path.exists():
        raise FileNotFoundError(f"필수 파일이 없습니다: {path}")
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        if not reader.fieldnames:
            raise ValueError(f"CSV header를 읽을 수 없습니다: {path}")
        return list(reader.fieldnames), [dict(row) for row in reader]


def ensure_columns(fieldnames: list[str], rows: list[dict[str, str]]) -> list[str]:
    updated = list(fieldnames)
    for column in REQUIRED_COLUMNS:
        if column not in updated:
            updated.append(column)
    for row in rows:
        for column in updated:
            row.setdefault(column, "")
    return updated


def same_meaning(left: str, right: str) -> bool:
    return normalize_word_key(left) == normalize_word_key(right)


def apply_decks_to_rows(
    fieldnames: list[str],
    rows: list[dict[str, str]],
    deck_results: list[DeckParseResult],
) -> ImportStats:
    stats = ImportStats(scanned_files=len(deck_results))
    rows_by_word: dict[str, dict[str, str]] = {}
    for row in rows:
        word = row.get("word", "").strip()
        if word:
            rows_by_word.setdefault(normalize_word_key(word), row)

    for deck in deck_results:
        for entry in deck.entries:
            word_key = normalize_word_key(entry.word)
            source_file = deck.source_file
            row = rows_by_word.get(word_key)
            if row:
                before = dict(row)
                existing_decks = [
                    *split_tokens(row.get("deck_ids")),
                    *split_tokens(row.get("deck_tags")),
                ]
                if row.get("deck_id"):
                    existing_decks.append(row["deck_id"])
                if row.get("primary_deck_id"):
                    existing_decks.append(row["primary_deck_id"])
                row["deck_ids"] = merge_tokens(";".join(existing_decks), [deck.deck_id], sort_decks=True)
                row["deck_tags"] = merge_tokens(row.get("deck_tags"), [deck.deck_id], sort_decks=True)
                row["source_files"] = merge_tokens(row.get("source_files"), [source_file])
                if not row.get("primary_deck_id"):
                    row["primary_deck_id"] = deck.deck_id

                core_meaning = row.get("core_meaning_ko", "").strip()
                if entry.meaning and not core_meaning:
                    row["core_meaning_ko"] = entry.meaning
                elif entry.meaning and core_meaning and not same_meaning(core_meaning, entry.meaning):
                    note = f"meaning_conflict:{deck.deck_id}:{entry.meaning}"
                    row["import_notes"] = append_note(row.get("import_notes"), note)

                if entry.needs_meaning_review and not row.get("core_meaning_ko", "").strip():
                    row["import_notes"] = append_note(row.get("import_notes"), f"needs_meaning_review:{deck.deck_id}")

                if row != before:
                    stats.updated_rows += 1
                stats.duplicate_words_merged += 1
                continue

            new_row = {column: "" for column in fieldnames}
            new_row["word"] = entry.word
            new_row["entry_type"] = "phrase" if " " in entry.word.strip() else "word"
            if "core_meaning_ko" in new_row:
                new_row["core_meaning_ko"] = entry.meaning
            if "status" in new_row:
                new_row["status"] = "active"
            if "source_session" in new_row:
                new_row["source_session"] = "deck_import"
            if "notes" in new_row:
                new_row["notes"] = "deck_import"
            new_row["deck_ids"] = deck.deck_id
            new_row["deck_tags"] = deck.deck_id
            new_row["primary_deck_id"] = deck.deck_id
            new_row["source_files"] = source_file
            if entry.needs_meaning_review:
                new_row["import_notes"] = "needs_meaning_review"
            rows.append(new_row)
            rows_by_word[word_key] = new_row
            stats.new_rows += 1

        stats.lines_requiring_review += sum(1 for entry in deck.entries if entry.needs_meaning_review and normalize_word_key(entry.word) in rows_by_word)
        stats.skipped_lines += len(deck.skipped_lines)

    return stats


def atomic_write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_name: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8",
            newline="",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as file:
            temp_name = file.name
            writer = csv.DictWriter(file, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(rows)
        Path(temp_name).replace(path)
    finally:
        if temp_name:
            temp_path = Path(temp_name)
            if temp_path.exists():
                temp_path.unlink()


def read_deck_metadata(path: Path) -> dict[str, dict[str, str]]:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        return {
            str(row.get("deck_id", "")).strip(): dict(row)
            for row in reader
            if str(row.get("deck_id", "")).strip()
        }


def build_deck_metadata_rows(deck_results: list[DeckParseResult], deck_csv_path: Path) -> list[dict[str, str]]:
    existing = read_deck_metadata(deck_csv_path)
    imported_at = datetime.now(timezone.utc).isoformat()

    for deck in deck_results:
        previous = existing.get(deck.deck_id, {})
        existing[deck.deck_id] = {
            "deck_id": deck.deck_id,
            "source_file": deck.source_file,
            "display_name": previous.get("display_name") or deck.deck_id,
            "word_count": str(deck.unique_word_count),
            "imported_at": imported_at,
            "notes": previous.get("notes", ""),
        }

    return [
        {column: row.get(column, "") for column in DECK_METADATA_COLUMNS}
        for _, row in sorted(existing.items(), key=lambda item: deck_sort_key(item[0]))
    ]


def write_report(root: Path, deck_results: list[DeckParseResult], stats: ImportStats, apply: bool) -> Path:
    report_path = root / "reports" / "deck_import_report.md"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Deck Import Report",
        "",
        f"- mode: {'apply' if apply else 'dry-run'}",
        f"- generated_at: {datetime.now(timezone.utc).isoformat()}",
        f"- scanned_deck_files: {stats.scanned_files}",
        f"- new_master_rows: {stats.new_rows}",
        f"- updated_existing_rows: {stats.updated_rows}",
        f"- duplicate_words_merged: {stats.duplicate_words_merged}",
        f"- lines_requiring_review: {stats.lines_requiring_review}",
        f"- skipped_or_ambiguous_lines: {stats.skipped_lines + sum(len(deck.warnings) for deck in deck_results)}",
        "",
        "## Decks",
        "",
    ]

    if not deck_results:
        lines.append("- 가져올 deck 파일이 없습니다.")
    for deck in deck_results:
        lines.extend(
            [
                f"### {deck.deck_id}",
                f"- source_file: `{deck.source_file}`",
                f"- parsed_unique_words: {deck.unique_word_count}",
                f"- raw_duplicate_words: {deck.raw_duplicate_count}",
                f"- needs_meaning_review: {sum(1 for entry in deck.entries if entry.needs_meaning_review)}",
            ]
        )
        if deck.warnings:
            lines.append("- warnings:")
            for warning in deck.warnings:
                lines.append(f"  - {warning}")
        else:
            lines.append("- warnings: 없음")
        lines.append("")

    report_path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    return report_path


def print_summary(deck_results: list[DeckParseResult], stats: ImportStats, report_path: Path, apply: bool) -> None:
    print("Deck import 요약")
    print(f"- 모드: {'적용' if apply else 'dry-run'}")
    print(f"- 스캔한 deck 파일: {stats.scanned_files}")
    for deck in deck_results:
        print(f"- {deck.deck_id}: {deck.unique_word_count}개 단어 ({deck.source_file})")
    print(f"- 새 master row: {stats.new_rows}")
    print(f"- 업데이트된 기존 row: {stats.updated_rows}")
    print(f"- 병합된 중복 단어: {stats.duplicate_words_merged}")
    print(f"- review 필요 line: {stats.lines_requiring_review}")
    print(f"- skipped/ambiguous line: {stats.skipped_lines + sum(len(deck.warnings) for deck in deck_results)}")
    print("- 출력 파일:")
    print(f"  - reports/deck_import_report.md")
    if apply:
        print("  - data/master_words.csv")
        print("  - data/decks.csv")
    else:
        print("  - data/master_words.csv (변경 없음)")
        print("  - data/decks.csv (변경 없음)")
    print(f"- report: {report_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="Parse and report without changing CSV data")
    mode.add_argument("--apply", action="store_true", help="Apply deck tags to canonical CSV data")
    parser.add_argument("--deck", help="Optional deck filter, for example D1")
    parser.add_argument("--verbose", action="store_true", help="Print per-line warnings")
    parser.add_argument("--root", type=Path, default=ROOT, help="Repository root")
    return parser.parse_args()


def normalize_deck_filter(value: str | None) -> str | None:
    if not value:
        return None
    match = re.fullmatch(r"[dD]([0-9]+)", value.strip())
    if not match:
        raise ValueError("--deck 값은 D1 같은 형식이어야 합니다.")
    return f"D{int(match.group(1))}"


def main() -> None:
    args = parse_args()
    root = args.root.resolve()
    apply = bool(args.apply)
    deck_filter = normalize_deck_filter(args.deck)

    master_path = root / "data" / "master_words.csv"
    deck_csv_path = root / "data" / "decks.csv"

    matches = scan_deck_files(root, deck_filter)
    deck_results = [parse_deck(deck_id, deck_number, path) for deck_id, deck_number, path in matches]

    fieldnames, rows = read_master(master_path)
    fieldnames = ensure_columns(fieldnames, rows)
    stats = apply_decks_to_rows(fieldnames, rows, deck_results)
    metadata_rows = build_deck_metadata_rows(deck_results, deck_csv_path)

    if args.verbose:
        for deck in deck_results:
            for warning in deck.warnings:
                print(f"[{deck.deck_id}] {warning}", file=sys.stderr)

    if apply:
        atomic_write_csv(master_path, fieldnames, rows)
        atomic_write_csv(deck_csv_path, DECK_METADATA_COLUMNS, metadata_rows)

    report_path = write_report(root, deck_results, stats, apply)
    print_summary(deck_results, stats, report_path, apply)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Deck import 실패: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
