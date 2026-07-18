from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

import backend.app.db.connection as connection_module
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
    assert version == 4
    assert violations == []


def test_v2_database_adds_auth_tables_without_rewriting_personal_data(tmp_path) -> None:
    database_path = tmp_path / "owned-v2.db"
    connection = sqlite3.connect(database_path)
    connection.executescript(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            display_name TEXT NOT NULL,
            timezone TEXT NOT NULL DEFAULT 'UTC',
            locale TEXT NOT NULL DEFAULT 'en',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE goals (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            priority INTEGER NOT NULL DEFAULT 1,
            active_status INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO users (id, display_name) VALUES (4, 'Existing profile');
        INSERT INTO goals (id, user_id, title) VALUES (7, 4, 'Existing goal');
        PRAGMA user_version = 2;
        """
    )
    connection.close()

    database = Database(database_path)
    database.initialize()
    database.initialize()

    with database.session() as migrated:
        user = migrated.execute(
            "SELECT id, display_name FROM users WHERE id = 4"
        ).fetchone()
        goal = migrated.execute(
            "SELECT id, user_id, title FROM goals WHERE id = 7"
        ).fetchone()
        auth_tables = {
            row["name"]
            for row in migrated.execute(
                """
                SELECT name FROM sqlite_master
                WHERE type = 'table' AND name IN ('auth_credentials', 'auth_sessions')
                """
            ).fetchall()
        }
        credential_count = migrated.execute(
            "SELECT COUNT(*) FROM auth_credentials"
        ).fetchone()[0]
        version = migrated.execute("PRAGMA user_version").fetchone()[0]
        violations = migrated.execute("PRAGMA foreign_key_check").fetchall()

    assert tuple(user) == (4, "Existing profile")
    assert tuple(goal) == (7, 4, "Existing goal")
    assert auth_tables == {"auth_credentials", "auth_sessions"}
    assert credential_count == 0
    assert version == 4
    assert violations == []


def test_v3_database_removes_recovery_code_without_rewriting_account(tmp_path) -> None:
    database_path = tmp_path / "auth-v3.db"
    connection = sqlite3.connect(database_path)
    connection.executescript(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            display_name TEXT NOT NULL,
            timezone TEXT NOT NULL DEFAULT 'UTC',
            locale TEXT NOT NULL DEFAULT 'en',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE auth_credentials (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            subject TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL COLLATE NOCASE UNIQUE,
            password_hash TEXT NOT NULL,
            recovery_code_hash TEXT NOT NULL,
            failed_attempts INTEGER NOT NULL DEFAULT 0,
            locked_until TEXT,
            password_changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO users (id, display_name) VALUES (8, 'Existing account');
        INSERT INTO auth_credentials (
            user_id, subject, email, password_hash, recovery_code_hash
        ) VALUES (
            8,
            '12345678-1234-1234-1234-123456789abc',
            'existing@example.com',
            '$argon2id$preserved-password-hash',
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        );
        PRAGMA user_version = 3;
        """
    )
    connection.close()

    database = Database(database_path)
    database.initialize()
    database.initialize()

    with database.session() as migrated:
        columns = {
            row["name"]
            for row in migrated.execute("PRAGMA table_info(auth_credentials)").fetchall()
        }
        account = migrated.execute(
            "SELECT user_id, email, password_hash FROM auth_credentials"
        ).fetchone()
        version = migrated.execute("PRAGMA user_version").fetchone()[0]
        violations = migrated.execute("PRAGMA foreign_key_check").fetchall()

    assert "recovery_code_hash" not in columns
    assert tuple(account) == (
        8,
        "existing@example.com",
        "$argon2id$preserved-password-hash",
    )
    assert version == 4
    assert violations == []


def test_v3_migration_failure_rolls_back_schema_and_account(
    tmp_path,
    monkeypatch,
) -> None:
    database_path = tmp_path / "broken-auth-v3.db"
    connection = sqlite3.connect(database_path)
    connection.executescript(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            display_name TEXT NOT NULL
        );
        CREATE TABLE auth_credentials (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            subject TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            recovery_code_hash TEXT NOT NULL
        );
        INSERT INTO users (id, display_name) VALUES (8, 'Preserved account');
        INSERT INTO auth_credentials (
            user_id, subject, email, password_hash, recovery_code_hash
        ) VALUES (
            8,
            '12345678-1234-1234-1234-123456789abc',
            'preserved@example.com',
            '$argon2id$preserved-password-hash',
            'preserved-recovery-code-hash'
        );
        PRAGMA user_version = 3;
        """
    )
    connection.close()
    broken_schema = tmp_path / "broken-schema.sql"
    broken_schema.write_text(
        """
        CREATE TABLE migration_marker (id INTEGER PRIMARY KEY);
        PRAGMA user_version = 4;
        THIS IS NOT VALID SQL;
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(connection_module, "SCHEMA_PATH", broken_schema)

    with pytest.raises(sqlite3.OperationalError):
        Database(database_path).initialize()

    check = sqlite3.connect(database_path)
    columns = {
        row[1] for row in check.execute("PRAGMA table_info(auth_credentials)").fetchall()
    }
    account = check.execute(
        "SELECT email, recovery_code_hash FROM auth_credentials WHERE user_id = 8"
    ).fetchone()
    marker = check.execute(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'migration_marker'"
    ).fetchone()[0]
    version = check.execute("PRAGMA user_version").fetchone()[0]
    check.close()

    assert "recovery_code_hash" in columns
    assert account == ("preserved@example.com", "preserved-recovery-code-hash")
    assert marker == 0
    assert version == 3
