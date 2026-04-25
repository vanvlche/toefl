#!/usr/bin/env python3
"""Run the local TOEFL vocabulary PWA server with automatic seed exports."""

from __future__ import annotations

import argparse
import functools
import http.server
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
DATA_SOURCES = [
    "data/master_words.csv",
    "data/review_queue.csv",
    "data/wrong_answers.jsonl",
    "data/confusion_pairs.csv",
    "decks/**/*.txt",
]


class NoStoreDataHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        pathname = urlparse(self.path).path
        if pathname.startswith("/web/data/"):
            self.send_header("Cache-Control", "no-store, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()


def run_export(root: Path) -> None:
    export_script = root / "scripts" / "export_web_seed.py"
    subprocess.run([sys.executable, str(export_script)], cwd=root, check=True)


def start_watcher(root: Path, interval: float) -> subprocess.Popen[str]:
    watch_script = root / "scripts" / "watch_web_seed.py"
    return subprocess.Popen(
        [sys.executable, str(watch_script), "--interval", str(interval), "--skip-initial"],
        cwd=root,
        text=True,
    )


def print_startup(host: str, port: int) -> None:
    print(f"Local URL: http://localhost:{port}/web/")
    print(f"LAN usage: open http://<this-computer-ip>:{port}/web/ from another device on the same network.")
    print("Watched source files:")
    for source in DATA_SOURCES:
        print(f"  - {source}")
    print("Raw deck files must be imported into data/master_words.csv before they can appear in the PWA.")
    print(f"Serving on {host}:{port}; press Ctrl+C to stop.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="0.0.0.0", help="HTTP bind host")
    parser.add_argument("--port", type=int, default=8765, help="HTTP port")
    parser.add_argument("--interval", type=float, default=1.5, help="Seed watcher polling interval")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    root = ROOT.resolve()

    run_export(root)
    watcher = start_watcher(root, max(args.interval, 0.2))
    handler = functools.partial(NoStoreDataHandler, directory=str(root))
    server = http.server.ThreadingHTTPServer((args.host, args.port), handler)

    print_startup(args.host, args.port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping web dev server...")
    finally:
        server.shutdown()
        server.server_close()
        watcher.terminate()
        try:
            watcher.wait(timeout=5)
        except subprocess.TimeoutExpired:
            watcher.kill()
            watcher.wait(timeout=5)


if __name__ == "__main__":
    main()
