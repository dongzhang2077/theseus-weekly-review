#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SAMPLE_PATH = ROOT / "data" / "sample" / "sample_week.json"
sys.path.insert(0, str(ROOT))

from review_engine.rules import analyze_week  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the deterministic review engine against a sanitized sample week."
    )
    parser.add_argument(
        "--sample",
        default=str(SAMPLE_PATH),
        help="Path to a sample week JSON payload",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    payload = json.loads(Path(args.sample).read_text(encoding="utf-8"))
    result = analyze_week(payload)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
