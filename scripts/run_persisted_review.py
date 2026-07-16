#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.app.db import Database  # noqa: E402
from backend.app.db.repositories import UserRepository  # noqa: E402
from backend.app.schemas import WeeklyReviewGenerateRequest  # noqa: E402
from backend.app.services import ReviewService, WeeklyPlanNotFound  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate and persist a review from an initialized Theseus database."
    )
    parser.add_argument("--database", required=True, help="Path to the SQLite database")
    parser.add_argument("--user-id", required=True, type=int, help="Local user ID")
    parser.add_argument("--week-start", required=True, type=date.fromisoformat)
    parser.add_argument("--week-end", required=True, type=date.fromisoformat)
    parser.add_argument(
        "--mode",
        choices=("deterministic_first", "supportive_text"),
        default="deterministic_first",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    database = Database(args.database)
    database.initialize()
    request = WeeklyReviewGenerateRequest(
        week_start=args.week_start,
        week_end=args.week_end,
        mode=args.mode,
    )
    try:
        with database.session() as connection:
            try:
                UserRepository(connection).get(args.user_id)
            except LookupError as exc:
                raise SystemExit(f"Local user {args.user_id} was not found") from exc
            review = ReviewService(connection, args.user_id).generate(request)
    except WeeklyPlanNotFound as exc:
        raise SystemExit(str(exc)) from exc
    print(review.model_dump_json(indent=2))


if __name__ == "__main__":
    main()
