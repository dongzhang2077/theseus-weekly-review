import sqlite3

import pytest

from backend.app.db import Database


EXPECTED_TABLES = {
    "activities",
    "daily_reflections",
    "goals",
    "planned_items",
    "projects",
    "time_logs",
    "weekly_plans",
    "weekly_reviews",
}


def test_schema_initializes_all_core_tables(database: Database) -> None:
    with database.session() as connection:
        tables = {
            row["name"]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }
        foreign_keys = connection.execute("PRAGMA foreign_keys").fetchone()[0]

    assert EXPECTED_TABLES <= tables
    assert foreign_keys == 1


def test_schema_rejects_invalid_foreign_keys_and_enums(database: Database) -> None:
    with pytest.raises(sqlite3.IntegrityError), database.session() as connection:
        connection.execute(
            "INSERT INTO projects (goal_id, title) VALUES (?, ?)",
            (999, "Missing goal"),
        )

    with pytest.raises(sqlite3.IntegrityError), database.session() as connection:
        connection.execute(
            """
            INSERT INTO time_logs (date, duration_minutes, activity_name, activity_type)
            VALUES ('2026-06-10', 30, 'Invalid type', 'unknown')
            """
        )


def test_session_rolls_back_failed_transaction(database: Database) -> None:
    with pytest.raises(RuntimeError), database.session() as connection:
        connection.execute("INSERT INTO goals (title) VALUES ('Rolled back')")
        raise RuntimeError("force rollback")

    with database.session() as connection:
        count = connection.execute("SELECT COUNT(*) FROM goals").fetchone()[0]
    assert count == 0
