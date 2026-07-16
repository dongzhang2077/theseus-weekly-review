from pathlib import Path

import pytest
from pydantic import ValidationError

from backend.app.db import Database
from backend.app.services.sample_import import import_sample_week, load_sample_payload


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
