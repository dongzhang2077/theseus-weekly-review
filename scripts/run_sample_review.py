#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SAMPLE_PATH = ROOT / "data" / "sample" / "sample_week.json"
sys.path.insert(0, str(ROOT))

from review_engine.rules import analyze_week  # noqa: E402


def main() -> None:
    payload = json.loads(SAMPLE_PATH.read_text(encoding="utf-8"))
    result = analyze_week(payload)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
