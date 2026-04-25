#!/usr/bin/env python3
"""Regenerate the web seed JSON when repository vocabulary data changes."""

from __future__ import annotations

import argparse
import hashlib
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_SOURCES = [
    "data/master_words.csv",
    "data/review_queue.csv",
    "data/wrong_answers.jsonl",
    "data/confusion_pairs.csv",
]


def source_paths(root: Path) -> list[Path]:
    paths = [root / relative_path for relative_path in DATA_SOURCES]
    decks_dir = root / "decks"
    if decks_dir.exists():
        paths.extend(sorted(decks_dir.glob("**/*.txt")))
    return paths


def relative_path(root: Path, path: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return path.as_posix()


def digest_file(path: Path) -> str:
    if not path.exists():
        return "<missing>"

    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def snapshot(root: Path) -> dict[str, str]:
    return {relative_path(root, path): digest_file(path) for path in source_paths(root)}


def changed_paths(previous: dict[str, str], current: dict[str, str]) -> list[str]:
    all_paths = sorted(set(previous) | set(current))
    return [path for path in all_paths if previous.get(path) != current.get(path)]


def run_export(root: Path) -> int:
    export_script = root / "scripts" / "export_web_seed.py"
    completed = subprocess.run([sys.executable, str(export_script)], cwd=root, check=False)
    return completed.returncode


def print_watched_paths(root: Path) -> None:
    print("Watching source files:")
    for path in source_paths(root):
        print(f"  - {relative_path(root, path)}")
    print("Raw deck files are triggers only; import them into data/master_words.csv before they appear in the PWA.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT, help="Repository root")
    parser.add_argument("--interval", type=float, default=1.5, help="Polling interval in seconds")
    parser.add_argument("--skip-initial", action="store_true", help="Do not run export on watcher startup")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    root = args.root.resolve()
    interval = max(args.interval, 0.2)

    print_watched_paths(root)
    if not args.skip_initial:
        print("Initial web seed export...")
        run_export(root)

    previous = snapshot(root)
    try:
        while True:
            time.sleep(interval)
            current = snapshot(root)
            changes = changed_paths(previous, current)
            if changes:
                print(f"Change detected: {', '.join(changes)}")
                if any(path.startswith("decks/") for path in changes):
                    print("Deck change noticed. Raw decks still need the existing import workflow to update data/master_words.csv.")
                run_export(root)
                current = snapshot(root)
            previous = current
    except KeyboardInterrupt:
        print("\nSeed watcher stopped.")


if __name__ == "__main__":
    main()
