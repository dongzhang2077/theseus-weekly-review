#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from dataclasses import asdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.app.db import Database  # noqa: E402
from backend.app.db.repositories import UserRepository  # noqa: E402
from backend.app.schemas import LocalUserCreate, LocalUserRead  # noqa: E402
from backend.app.services.sample_import import (  # noqa: E402
    DEFAULT_SAMPLE_PATH,
    import_sample_week,
    load_sample_payload,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Load the sanitized Theseus sample week.")
    parser.add_argument("--database", required=True, help="Path to the SQLite database")
    parser.add_argument("--user-id", type=int, help="Existing local user ID")
    parser.add_argument(
        "--user-name",
        default="Demo User",
        help="Local user name to create or reuse when --user-id is omitted",
    )
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
        user = _resolve_user(connection, args.user_id, args.user_name)
        result = import_sample_week(connection, user.id, payload)
    print({"user_id": user.id, **asdict(result)})


def _resolve_user(
    connection,
    user_id: int | None,
    display_name: str,
) -> LocalUserRead:
    users = UserRepository(connection)
    if user_id is not None:
        try:
            return users.get(user_id)
        except LookupError as exc:
            raise SystemExit(f"Local user {user_id} was not found") from exc
    for user in users.list():
        if user.display_name == display_name:
            return user
    return users.create(LocalUserCreate(display_name=display_name))


if __name__ == "__main__":
    main()
