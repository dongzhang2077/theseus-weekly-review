from __future__ import annotations

import sqlite3
from pathlib import Path

from backend.app.db import Database


LEGACY_SCHEMA = Path(__file__).parents[1] / "fixtures" / "schema_v1.sql"


def test_v1_database_migrates_to_local_user_ownership(tmp_path) -> None:
    database_path = tmp_path / "legacy.db"
    connection = sqlite3.connect(database_path)
    connection.executescript(LEGACY_SCHEMA.read_text(encoding="utf-8"))
    connection.executescript(
        """
        INSERT INTO goals (id, title) VALUES (3, 'Legacy goal');
        INSERT INTO projects (id, goal_id, title) VALUES (4, 3, 'Legacy project');
        INSERT INTO activities (
            id, project_id, name, activity_type, type_source
        ) VALUES (5, 4, 'Legacy activity', 'consuming', 'user_selected');
        INSERT INTO weekly_plans (
            id, week_start, week_end, planned_capacity_minutes
        ) VALUES (6, '2026-06-08', '2026-06-14', 1200);
        INSERT INTO planned_items (
            id, weekly_plan_id, project_id, title, planned_minutes
        ) VALUES (7, 6, 4, 'Legacy item', 120);
        INSERT INTO time_logs (
            id, activity_id, project_id, date, duration_minutes,
            activity_name, activity_type, type_source
        ) VALUES (
            8, 5, 4, '2026-06-10', 60,
            'Legacy activity', 'consuming', 'user_selected'
        );
        INSERT INTO daily_reflections (
            id, date, small_win
        ) VALUES (9, '2026-06-10', 'Kept moving');
        INSERT INTO weekly_reviews (
            id, week_start, week_end, wins_json, insights_json,
            next_steps_json, risk_flags_json, evidence_json, generated_text
        ) VALUES (
            10, '2026-06-08', '2026-06-14', '[]', '[]',
            '[]', '[]', '{}', 'Legacy review'
        );
        """
    )
    connection.commit()
    connection.close()

    database = Database(database_path)
    database.initialize()
    database.initialize()

    with database.session() as migrated:
        user = migrated.execute(
            "SELECT id, display_name FROM users"
        ).fetchone()
        owned_tables = (
            "goals",
            "projects",
            "activities",
            "weekly_plans",
            "time_logs",
            "daily_reflections",
            "weekly_reviews",
        )
        ownership = {
            table: migrated.execute(
                f"SELECT id, user_id FROM {table}"
            ).fetchone()
            for table in owned_tables
        }
        item = migrated.execute(
            "SELECT id, weekly_plan_id, project_id FROM planned_items"
        ).fetchone()
        version = migrated.execute("PRAGMA user_version").fetchone()[0]
        violations = migrated.execute("PRAGMA foreign_key_check").fetchall()

    assert tuple(user) == (1, "Local User")
    assert {table: tuple(row) for table, row in ownership.items()} == {
        "goals": (3, 1),
        "projects": (4, 1),
        "activities": (5, 1),
        "weekly_plans": (6, 1),
        "time_logs": (8, 1),
        "daily_reflections": (9, 1),
        "weekly_reviews": (10, 1),
    }
    assert tuple(item) == (7, 6, 4)
    assert version == 2
    assert violations == []
