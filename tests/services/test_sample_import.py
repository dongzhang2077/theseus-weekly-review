import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from backend.app.db import Database
from backend.app.schemas import WeeklyReviewGenerateRequest
from backend.app.services import ReviewService
from backend.app.services.sample_import import import_sample_week, load_sample_payload


ROOT = Path(__file__).resolve().parents[2]
FINAL_DEFENSE_SAMPLE = ROOT / "data" / "sample" / "college_student_month.json"


def _counts(connection) -> dict[str, int]:
    tables = [
        "goals",
        "projects",
        "weekly_plans",
        "planned_items",
        "time_logs",
        "daily_reflections",
    ]
    return {
        table: connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        for table in tables
    }


def test_sample_import_loads_fixture_and_is_idempotent(connection, local_user) -> None:
    first = import_sample_week(connection, local_user.id)
    first_counts = _counts(connection)
    second = import_sample_week(connection, local_user.id)
    second_counts = _counts(connection)

    assert first == second
    assert first_counts == second_counts
    assert second_counts == {
        "goals": 2,
        "projects": 3,
        "weekly_plans": 1,
        "planned_items": 3,
        "time_logs": 5,
        "daily_reflections": 1,
    }


def test_sample_import_rolls_back_invalid_payload(connection, local_user) -> None:
    import_sample_week(connection, local_user.id)
    before = _counts(connection)
    invalid = load_sample_payload()
    invalid["weekly_plan"]["items"][0]["planned_minutes"] = 0

    with pytest.raises(ValidationError):
        import_sample_week(connection, local_user.id, invalid)

    assert _counts(connection) == before


def test_load_sample_data_script_can_run_twice(tmp_path) -> None:
    database_path = tmp_path / "theseus-demo.db"
    database = Database(database_path)
    database.initialize()

    with database.session() as connection:
        from backend.app.db.repositories import UserRepository
        from backend.app.schemas import LocalUserCreate

        user = UserRepository(connection).create(
            LocalUserCreate(display_name="Demo User")
        )
        import_sample_week(connection, user.id)
    with database.session() as connection:
        import_sample_week(connection, user.id)
        counts = _counts(connection)

    assert Path(database_path).exists()
    assert counts["time_logs"] == 5


def test_month_sample_import_is_idempotent_across_the_fixture_range(
    connection, local_user
) -> None:
    payload = load_sample_payload(FINAL_DEFENSE_SAMPLE)

    first = import_sample_week(connection, local_user.id, payload)
    first_counts = _counts(connection)
    second = import_sample_week(connection, local_user.id, payload)

    assert first == second
    assert _counts(connection) == first_counts
    assert first.goals == 3
    assert first.projects == 4
    assert first.weekly_plans == 1
    assert first.planned_items == 4
    assert first.time_logs >= 140
    assert first.daily_reflections == 8

    stored_range = connection.execute(
        "SELECT MIN(date), MAX(date), COUNT(DISTINCT date) FROM time_logs WHERE user_id = ?",
        (local_user.id,),
    ).fetchone()
    assert tuple(stored_range) == ("2026-07-01", "2026-08-01", 32)


def test_month_sample_is_sanitized_and_covers_student_life() -> None:
    payload = load_sample_payload(FINAL_DEFENSE_SAMPLE)
    names = {row["activity_name"] for row in payload["time_logs"]}
    activity_types = {row["activity_type"] for row in payload["time_logs"]}
    serialized = json.dumps(payload).casefold()

    assert payload["fixture_start"] == "2026-07-01"
    assert payload["fixture_end"] == "2026-08-01"
    assert {"consuming", "neutral", "restore", "destroy"} == activity_types
    assert {"Sleep", "Meals and break", "Cafe shift", "Sociology lecture"} <= names
    assert "software" not in serialized
    assert "theseus backend" not in serialized

    totals_by_date: dict[str, int] = {}
    for row in payload["time_logs"]:
        totals_by_date[row["date"]] = (
            totals_by_date.get(row["date"], 0) + row["duration_minutes"] * 60
        )
    assert any(0 < seconds < 2 * 60 * 60 for seconds in totals_by_date.values())
    assert any(2 * 60 * 60 <= seconds < 6 * 60 * 60 for seconds in totals_by_date.values())
    assert any(seconds >= 6 * 60 * 60 for seconds in totals_by_date.values())


def test_month_sample_rejects_an_inverted_fixture_range(connection, local_user) -> None:
    payload = load_sample_payload(FINAL_DEFENSE_SAMPLE)
    payload["fixture_start"] = "2026-08-01"
    payload["fixture_end"] = "2026-07-01"

    with pytest.raises(ValueError, match="fixture_end"):
        import_sample_week(connection, local_user.id, payload)


def test_month_sample_persists_an_evidence_backed_current_review(
    connection, local_user
) -> None:
    payload = load_sample_payload(FINAL_DEFENSE_SAMPLE)
    import_sample_week(connection, local_user.id, payload)

    review = ReviewService(connection, local_user.id).generate(
        WeeklyReviewGenerateRequest(
            week_start="2026-07-27",
            week_end="2026-08-02",
            mode="deterministic_first",
        )
    )

    assert review.id > 0
    assert review.evidence["summary"]["time_log_count"] >= 25
    assert review.evidence["summary"]["reflection_count"] == 2
    assert any(
        "Research paper and presentation" in flag.evidence
        for flag in review.risk_flags
    )
    stored = connection.execute(
        "SELECT COUNT(*) FROM weekly_reviews WHERE user_id = ? AND week_start = ?",
        (local_user.id, "2026-07-27"),
    ).fetchone()[0]
    assert stored == 1
