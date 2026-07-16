#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.app.db import Database  # noqa: E402
from backend.app.db.repositories import UserRepository  # noqa: E402
from backend.app.schemas import LocalUserCreate, WeeklyReviewGenerateRequest  # noqa: E402
from backend.app.services import ReviewService  # noqa: E402
from backend.app.services.review_writer import (  # noqa: E402
    TemplateSupportiveReviewWriter,
)
from backend.app.services.sample_import import (  # noqa: E402
    DEFAULT_SAMPLE_PATH,
    import_sample_week,
    load_sample_payload,
)


DEFAULT_USER_NAME = "Theseus Demo"


@dataclass(frozen=True)
class DemoPreparation:
    database: str
    user_id: int
    user_name: str
    week_start: str
    week_end: str
    review_id: int
    review_writer: str
    goals: int
    projects: int
    weekly_plans: int
    planned_items: int
    time_logs: int
    daily_reflections: int


def prepare_demo(
    database_path: str | Path,
    *,
    user_name: str = DEFAULT_USER_NAME,
    sample_path: str | Path = DEFAULT_SAMPLE_PATH,
) -> DemoPreparation:
    """Load one sanitized user week and store a secret-free supportive review."""

    resolved_database = Path(database_path).expanduser().resolve()
    payload = load_sample_payload(sample_path)
    plan = payload["weekly_plan"]
    database = Database(resolved_database)
    database.initialize()

    with database.session() as connection:
        users = UserRepository(connection)
        user = next(
            (candidate for candidate in users.list() if candidate.display_name == user_name),
            None,
        )
        if user is None:
            user = users.create(
                LocalUserCreate(
                    display_name=user_name,
                    timezone="America/Los_Angeles",
                    locale="en-CA",
                )
            )

        imported = import_sample_week(connection, user.id, payload)
        writer = TemplateSupportiveReviewWriter()
        review = ReviewService(connection, user.id, writer=writer).generate(
            WeeklyReviewGenerateRequest(
                week_start=plan["week_start"],
                week_end=plan["week_end"],
                mode="supportive_text",
            )
        )

    return DemoPreparation(
        database=str(resolved_database),
        user_id=user.id,
        user_name=user.display_name,
        week_start=str(plan["week_start"]),
        week_end=str(plan["week_end"]),
        review_id=review.id,
        review_writer=writer.model_name,
        **asdict(imported),
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Prepare a sanitized, persisted Theseus database for the 2026-07-18 demo."
        )
    )
    parser.add_argument(
        "--database",
        help=(
            "SQLite destination. When omitted, a new database is created under /tmp."
        ),
    )
    parser.add_argument("--user-name", default=DEFAULT_USER_NAME)
    parser.add_argument("--sample", default=str(DEFAULT_SAMPLE_PATH))
    return parser.parse_args()


def _new_temporary_database() -> Path:
    handle = tempfile.NamedTemporaryFile(
        prefix="theseus-midterm-demo-",
        suffix=".db",
        dir="/tmp",
        delete=False,
    )
    handle.close()
    return Path(handle.name)


def main() -> None:
    args = parse_args()
    database_path = Path(args.database) if args.database else _new_temporary_database()
    prepared = prepare_demo(
        database_path,
        user_name=args.user_name,
        sample_path=args.sample,
    )
    print(json.dumps(asdict(prepared), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
