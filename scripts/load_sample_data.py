#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from dataclasses import asdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.app.db import Database  # noqa: E402
from backend.app.services.sample_import import (  # noqa: E402
    DEFAULT_SAMPLE_PATH,
    import_sample_week,
    load_sample_payload,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Load the sanitized Theseus sample week.")
    parser.add_argument("--database", required=True, help="Path to the SQLite database")
    parser.add_argument(
        "--sample",
        default=str(DEFAULT_SAMPLE_PATH),
        help="Path to a sample_week.json payload",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    database = Database(args.database)
    database.initialize()
    payload = load_sample_payload(args.sample)
    with database.session() as connection:
        result = import_sample_week(connection, payload)
    print(asdict(result))


if __name__ == "__main__":
    main()
