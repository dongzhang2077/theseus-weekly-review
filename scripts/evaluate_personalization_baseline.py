#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.app.db.connection import SCHEMA_VERSION  # noqa: E402
from backend.app.db.repositories import UserRepository  # noqa: E402
from backend.app.services import PersonalizationEvaluationService  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Read a Theseus database and print an aggregate-only, "
            "consented-outcome evaluation snapshot."
        )
    )
    parser.add_argument(
        "--database",
        required=True,
        help="Path to an initialized Theseus SQLite database",
    )
    parser.add_argument(
        "--user-id",
        required=True,
        type=int,
        help="Owned account ID to evaluate",
    )
    return parser.parse_args()


def build_snapshot(database_path: str | Path, user_id: int) -> dict:
    resolved = Path(database_path).expanduser().resolve()
    if not resolved.is_file():
        raise SystemExit(f"Database was not found: {resolved}")

    connection = sqlite3.connect(
        f"{resolved.as_uri()}?mode=ro",
        uri=True,
    )
    connection.row_factory = sqlite3.Row
    try:
        connection.execute("PRAGMA query_only = ON")
        version = connection.execute("PRAGMA user_version").fetchone()[0]
        if version != SCHEMA_VERSION:
            raise SystemExit(
                f"Unsupported Theseus schema version {version}; "
                f"expected {SCHEMA_VERSION}"
            )
        try:
            UserRepository(connection).get(user_id)
        except LookupError:
            raise SystemExit(f"Account {user_id} was not found")
        return PersonalizationEvaluationService(
            connection,
            user_id,
        ).read().to_dict()
    finally:
        connection.close()


def main() -> None:
    args = parse_args()
    snapshot = build_snapshot(Path(args.database), args.user_id)
    print(json.dumps(snapshot, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
