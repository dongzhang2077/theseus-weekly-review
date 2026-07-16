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
    "users",
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


def test_schema_rejects_invalid_foreign_keys_and_enums(
    database: Database,
) -> None:
    with database.session() as connection:
        user_id = connection.execute(
            "INSERT INTO users (display_name) VALUES ('Constraint User')"
        ).lastrowid

    with pytest.raises(sqlite3.IntegrityError), database.session() as connection:
        connection.execute(
            "INSERT INTO projects (user_id, goal_id, title) VALUES (?, ?, ?)",
            (user_id, 999, "Missing goal"),
        )

    with pytest.raises(sqlite3.IntegrityError), database.session() as connection:
        connection.execute(
            """
            INSERT INTO time_logs (
                user_id, date, duration_minutes, activity_name, activity_type
            ) VALUES (?, '2026-06-10', 30, 'Invalid type', 'unknown')
            """,
            (user_id,),
        )


def test_session_rolls_back_failed_transaction(database: Database) -> None:
    with database.session() as connection:
        user_id = connection.execute(
            "INSERT INTO users (display_name) VALUES ('Rollback User')"
        ).lastrowid

    with pytest.raises(RuntimeError), database.session() as connection:
        connection.execute(
            "INSERT INTO goals (user_id, title) VALUES (?, 'Rolled back')",
            (user_id,),
        )
        raise RuntimeError("force rollback")

    with database.session() as connection:
        count = connection.execute("SELECT COUNT(*) FROM goals").fetchone()[0]
    assert count == 0


def test_schema_rejects_cross_user_references(database: Database) -> None:
    with database.session() as connection:
        first = connection.execute(
            "INSERT INTO users (display_name) VALUES ('First')"
        ).lastrowid
        second = connection.execute(
            "INSERT INTO users (display_name) VALUES ('Second')"
        ).lastrowid
        goal = connection.execute(
            "INSERT INTO goals (user_id, title) VALUES (?, 'Private goal')",
            (first,),
        ).lastrowid
        second_goal = connection.execute(
            "INSERT INTO goals (user_id, title) VALUES (?, 'Second goal')",
            (second,),
        ).lastrowid
        first_project = connection.execute(
            "INSERT INTO projects (user_id, goal_id, title) VALUES (?, ?, 'First project')",
            (first, goal),
        ).lastrowid
        second_project = connection.execute(
            "INSERT INTO projects (user_id, goal_id, title) VALUES (?, ?, 'Second project')",
            (second, second_goal),
        ).lastrowid
        second_activity = connection.execute(
            """
            INSERT INTO activities (
                user_id, project_id, name, activity_type
            ) VALUES (?, ?, 'Second activity', 'consuming')
            """,
            (second, second_project),
        ).lastrowid
        first_plan = connection.execute(
            """
            INSERT INTO weekly_plans (user_id, week_start, week_end)
            VALUES (?, '2026-06-08', '2026-06-14')
            """,
            (first,),
        ).lastrowid

        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                """
                INSERT INTO projects (user_id, goal_id, title)
                VALUES (?, ?, 'Cross-user project')
                """,
                (second, goal),
            )

        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                """
                INSERT INTO activities (user_id, project_id, name, activity_type)
                VALUES (?, ?, 'Cross-user activity', 'consuming')
                """,
                (first, second_project),
            )

        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                """
                INSERT INTO planned_items (
                    weekly_plan_id, project_id, title, planned_minutes
                ) VALUES (?, ?, 'Cross-user item', 30)
                """,
                (first_plan, second_project),
            )

        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                """
                INSERT INTO time_logs (
                    user_id, activity_id, project_id, date, duration_minutes,
                    activity_name, activity_type
                ) VALUES (
                    ?, ?, ?, '2026-06-10', 30,
                    'Cross-user log', 'consuming'
                )
                """,
                (first, second_activity, first_project),
            )


def test_date_uniqueness_is_scoped_to_each_user(database: Database) -> None:
    with database.session() as connection:
        first = connection.execute(
            "INSERT INTO users (display_name) VALUES ('First')"
        ).lastrowid
        second = connection.execute(
            "INSERT INTO users (display_name) VALUES ('Second')"
        ).lastrowid

        for user_id in (first, second):
            connection.execute(
                """
                INSERT INTO weekly_plans (user_id, week_start, week_end)
                VALUES (?, '2026-06-08', '2026-06-14')
                """,
                (user_id,),
            )
            connection.execute(
                """
                INSERT INTO daily_reflections (user_id, date)
                VALUES (?, '2026-06-10')
                """,
                (user_id,),
            )
            connection.execute(
                """
                INSERT INTO weekly_reviews (
                    user_id, week_start, week_end, wins_json, insights_json,
                    next_steps_json, risk_flags_json, evidence_json, generated_text
                ) VALUES (
                    ?, '2026-06-08', '2026-06-14', '[]', '[]',
                    '[]', '[]', '{}', 'Review'
                )
                """,
                (user_id,),
            )

        assert connection.execute("SELECT COUNT(*) FROM weekly_plans").fetchone()[0] == 2
        assert connection.execute("SELECT COUNT(*) FROM daily_reflections").fetchone()[0] == 2
        assert connection.execute("SELECT COUNT(*) FROM weekly_reviews").fetchone()[0] == 2
