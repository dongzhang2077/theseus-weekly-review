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
    assert version == 9
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
    assert version == 9
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
    assert version == 9
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


def test_v4_database_adds_task_foundation_without_rewriting_personal_data(
    tmp_path,
) -> None:
    database_path = tmp_path / "owned-v4.db"
    connection = sqlite3.connect(database_path)
    connection.executescript(
        """
        PRAGMA foreign_keys = ON;
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            display_name TEXT NOT NULL,
            timezone TEXT NOT NULL DEFAULT 'UTC',
            locale TEXT NOT NULL DEFAULT 'en',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE projects (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            goal_id INTEGER,
            title TEXT NOT NULL,
            stage TEXT NOT NULL DEFAULT 'startup',
            deadline TEXT,
            weekly_min_minutes INTEGER NOT NULL DEFAULT 0,
            weekly_target_minutes INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'active',
            last_activity_date TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE activities (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            activity_type TEXT NOT NULL,
            type_source TEXT NOT NULL DEFAULT 'user_selected',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE weekly_plans (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            week_start TEXT NOT NULL,
            week_end TEXT NOT NULL,
            planned_capacity_minutes INTEGER NOT NULL DEFAULT 0,
            slack_target_percent INTEGER NOT NULL DEFAULT 20,
            note TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE planned_items (
            id INTEGER PRIMARY KEY,
            weekly_plan_id INTEGER NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
            project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
            title TEXT NOT NULL,
            planned_minutes INTEGER NOT NULL,
            priority INTEGER NOT NULL DEFAULT 1,
            is_completed INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE time_logs (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            activity_id INTEGER REFERENCES activities(id) ON DELETE SET NULL,
            project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
            date TEXT NOT NULL,
            start_time TEXT,
            end_time TEXT,
            duration_minutes INTEGER NOT NULL,
            activity_name TEXT NOT NULL,
            activity_type TEXT NOT NULL,
            type_source TEXT NOT NULL DEFAULT 'user_selected',
            note TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO users (id, display_name) VALUES (4, 'Existing account');
        INSERT INTO projects (id, user_id, title) VALUES (5, 4, 'Existing project');
        INSERT INTO activities (
            id, user_id, project_id, name, activity_type
        ) VALUES (6, 4, 5, 'Existing activity', 'consuming');
        INSERT INTO weekly_plans (
            id, user_id, week_start, week_end
        ) VALUES (7, 4, '2026-07-20', '2026-07-26');
        INSERT INTO planned_items (
            id, weekly_plan_id, project_id, title, planned_minutes
        ) VALUES (8, 7, 5, 'Existing block', 60);
        INSERT INTO time_logs (
            id, user_id, activity_id, project_id, date, duration_minutes,
            activity_name, activity_type
        ) VALUES (
            9, 4, 6, 5, '2026-07-22', 30, 'Existing activity', 'consuming'
        );
        PRAGMA user_version = 4;
        """
    )
    connection.close()

    database = Database(database_path)
    database.initialize()
    database.initialize()

    with database.session() as migrated:
        version = migrated.execute("PRAGMA user_version").fetchone()[0]
        activity = migrated.execute(
            "SELECT id, version FROM activities WHERE id = 6"
        ).fetchone()
        item = migrated.execute(
            "SELECT id, task_id, title FROM planned_items WHERE id = 8"
        ).fetchone()
        time_log = migrated.execute(
            "SELECT id, task_id, task_title FROM time_logs WHERE id = 9"
        ).fetchone()
        task_columns = {
            row["name"] for row in migrated.execute("PRAGMA table_info(tasks)")
        }
        violations = migrated.execute("PRAGMA foreign_key_check").fetchall()

    assert version == 9
    assert tuple(activity) == (6, 1)
    assert tuple(item) == (8, None, "Existing block")
    assert tuple(time_log) == (9, None, None)
    assert {"project_id", "status", "archived_at", "version"} <= task_columns
    assert violations == []


def test_v4_migration_failure_rolls_back_all_added_columns(
    tmp_path,
    monkeypatch,
) -> None:
    database_path = tmp_path / "broken-v4.db"
    connection = sqlite3.connect(database_path)
    connection.executescript(
        """
        CREATE TABLE users (id INTEGER PRIMARY KEY, display_name TEXT NOT NULL);
        CREATE TABLE activities (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL
        );
        INSERT INTO users (id, display_name) VALUES (1, 'Preserved');
        INSERT INTO activities (id, user_id, name) VALUES (2, 1, 'Existing');
        PRAGMA user_version = 4;
        """
    )
    connection.close()
    broken_schema = tmp_path / "broken-v5-schema.sql"
    broken_schema.write_text(
        """
        CREATE TABLE migration_marker (id INTEGER PRIMARY KEY);
        PRAGMA user_version = 5;
        THIS IS NOT VALID SQL;
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(connection_module, "SCHEMA_PATH", broken_schema)

    with pytest.raises(sqlite3.OperationalError):
        Database(database_path).initialize()

    check = sqlite3.connect(database_path)
    activity_columns = {
        row[1] for row in check.execute("PRAGMA table_info(activities)").fetchall()
    }
    activity = check.execute(
        "SELECT id, user_id, name FROM activities WHERE id = 2"
    ).fetchone()
    marker = check.execute(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'migration_marker'"
    ).fetchone()[0]
    version = check.execute("PRAGMA user_version").fetchone()[0]
    check.close()

    assert "version" not in activity_columns
    assert activity == (2, 1, "Existing")
    assert marker == 0
    assert version == 4


def test_v5_database_adds_focus_foundation_and_preserves_time_logs(
    tmp_path,
) -> None:
    database_path = tmp_path / "owned-v5.db"
    connection = sqlite3.connect(database_path)
    connection.executescript(
        """
        PRAGMA foreign_keys = ON;
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            display_name TEXT NOT NULL,
            timezone TEXT NOT NULL DEFAULT 'UTC',
            locale TEXT NOT NULL DEFAULT 'en',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE projects (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            goal_id INTEGER,
            title TEXT NOT NULL,
            stage TEXT NOT NULL DEFAULT 'startup',
            deadline TEXT,
            weekly_min_minutes INTEGER NOT NULL DEFAULT 0,
            weekly_target_minutes INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'active',
            last_activity_date TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE tasks (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            project_id INTEGER NOT NULL REFERENCES projects(id),
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'open',
            priority INTEGER NOT NULL DEFAULT 3,
            estimated_minutes INTEGER,
            due_date TEXT,
            created_source TEXT NOT NULL DEFAULT 'user',
            completed_at TEXT,
            archived_at TEXT,
            version INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE activities (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            activity_type TEXT NOT NULL,
            type_source TEXT NOT NULL DEFAULT 'user_selected',
            version INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE time_logs (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            activity_id INTEGER REFERENCES activities(id) ON DELETE SET NULL,
            project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
            task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
            date TEXT NOT NULL,
            start_time TEXT,
            end_time TEXT,
            duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
            activity_name TEXT NOT NULL,
            activity_type TEXT NOT NULL,
            type_source TEXT NOT NULL DEFAULT 'user_selected',
            task_title TEXT,
            note TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO users (id, display_name, timezone)
        VALUES (4, 'Existing account', 'America/Los_Angeles');
        INSERT INTO projects (id, user_id, title)
        VALUES (5, 4, 'Existing project');
        INSERT INTO activities (
            id, user_id, project_id, name, activity_type
        ) VALUES (6, 4, 5, 'Existing activity', 'consuming');
        INSERT INTO time_logs (
            id, user_id, activity_id, project_id, date, duration_minutes,
            activity_name, activity_type
        ) VALUES (
            9, 4, 6, 5, '2026-07-22', 30, 'Existing activity', 'consuming'
        );
        PRAGMA user_version = 5;
        """
    )
    connection.close()

    database = Database(database_path)
    database.initialize()
    database.initialize()

    with database.session() as migrated:
        version = migrated.execute("PRAGMA user_version").fetchone()[0]
        tables = {
            row["name"]
            for row in migrated.execute(
                """
                SELECT name FROM sqlite_master
                WHERE type = 'table'
                  AND name IN (
                      'focus_sessions',
                      'focus_session_segments',
                      'idempotency_receipts'
                  )
                """
            ).fetchall()
        }
        time_log = migrated.execute(
            """
            SELECT id, duration_minutes, duration_seconds, focus_session_id
            FROM time_logs WHERE id = 9
            """
        ).fetchone()
        violations = migrated.execute("PRAGMA foreign_key_check").fetchall()

    assert version == 9
    assert tables == {
        "focus_sessions",
        "focus_session_segments",
        "idempotency_receipts",
    }
    assert tuple(time_log) == (9, 30, 1800, None)
    assert violations == []


def test_v5_migration_failure_rolls_back_time_log_rebuild(
    tmp_path,
    monkeypatch,
) -> None:
    database_path = tmp_path / "broken-v5.db"
    connection = sqlite3.connect(database_path)
    connection.executescript(
        """
        CREATE TABLE users (id INTEGER PRIMARY KEY, display_name TEXT NOT NULL);
        CREATE TABLE time_logs (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            task_id INTEGER,
            task_title TEXT,
            duration_minutes INTEGER NOT NULL
        );
        INSERT INTO users (id, display_name) VALUES (1, 'Preserved');
        INSERT INTO time_logs (id, user_id, duration_minutes)
        VALUES (2, 1, 30);
        PRAGMA user_version = 5;
        """
    )
    connection.close()
    broken_migration = tmp_path / "broken-v6.sql"
    broken_migration.write_text(
        """
        ALTER TABLE time_logs RENAME TO time_logs_v5;
        CREATE TABLE migration_marker (id INTEGER PRIMARY KEY);
        THIS IS NOT VALID SQL;
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(
        connection_module,
        "V6_MIGRATION_PATH",
        broken_migration,
    )

    with pytest.raises(sqlite3.OperationalError):
        Database(database_path).initialize()

    check = sqlite3.connect(database_path)
    columns = {
        row[1] for row in check.execute("PRAGMA table_info(time_logs)").fetchall()
    }
    time_log = check.execute(
        "SELECT id, user_id, duration_minutes FROM time_logs"
    ).fetchone()
    marker = check.execute(
        """
        SELECT COUNT(*) FROM sqlite_master
        WHERE type = 'table' AND name = 'migration_marker'
        """
    ).fetchone()[0]
    version = check.execute("PRAGMA user_version").fetchone()[0]
    check.close()

    assert "duration_seconds" not in columns
    assert time_log == (2, 1, 30)
    assert marker == 0
    assert version == 5


def test_v6_database_adds_correction_history_and_preserves_evidence(tmp_path) -> None:
    database_path = tmp_path / "focus-v6.db"
    _create_v6_database(database_path)

    database = Database(database_path)
    database.initialize()
    database.initialize()

    with database.session() as migrated:
        version = migrated.execute("PRAGMA user_version").fetchone()[0]
        time_log = migrated.execute(
            """
            SELECT id, duration_seconds, version, deleted_at
            FROM time_logs WHERE id = 9
            """
        ).fetchone()
        review = migrated.execute(
            "SELECT id, stale_at FROM weekly_reviews WHERE id = 10"
        ).fetchone()
        revision_table = migrated.execute(
            """
            SELECT 1 FROM sqlite_master
            WHERE type = 'table' AND name = 'time_log_revisions'
            """
        ).fetchone()
        violations = migrated.execute("PRAGMA foreign_key_check").fetchall()

    assert version == 9
    assert tuple(time_log) == (9, 1800, 1, None)
    assert tuple(review) == (10, None)
    assert revision_table is not None
    assert violations == []


def test_v6_migration_failure_rolls_back_correction_columns(
    tmp_path,
    monkeypatch,
) -> None:
    database_path = tmp_path / "broken-v6.db"
    _create_v6_database(database_path)
    broken_migration = tmp_path / "broken-v7.sql"
    broken_migration.write_text(
        """
        ALTER TABLE time_logs ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
        CREATE TABLE migration_marker (id INTEGER PRIMARY KEY);
        THIS IS NOT VALID SQL;
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(connection_module, "V7_MIGRATION_PATH", broken_migration)

    with pytest.raises(sqlite3.OperationalError):
        Database(database_path).initialize()

    check = sqlite3.connect(database_path)
    columns = {
        row[1] for row in check.execute("PRAGMA table_info(time_logs)").fetchall()
    }
    marker = check.execute(
        """
        SELECT COUNT(*) FROM sqlite_master
        WHERE type = 'table' AND name = 'migration_marker'
        """
    ).fetchone()[0]
    version = check.execute("PRAGMA user_version").fetchone()[0]
    check.close()

    assert "version" not in columns
    assert marker == 0
    assert version == 6


def test_v7_database_adds_trust_ledger_without_rewriting_account(tmp_path) -> None:
    database_path = tmp_path / "correction-v7.db"
    connection = sqlite3.connect(database_path)
    connection.executescript(
        connection_module.SCHEMA_PATH.read_text(encoding="utf-8")
    )
    connection.execute(
        "INSERT INTO users (id, display_name) VALUES (4, 'Existing account')"
    )
    connection.commit()
    connection.close()

    database = Database(database_path)
    database.initialize()
    database.initialize()

    with database.session() as migrated:
        version = migrated.execute("PRAGMA user_version").fetchone()[0]
        user = migrated.execute(
            "SELECT id, display_name FROM users WHERE id = 4"
        ).fetchone()
        ledger_tables = {
            row["name"]
            for row in migrated.execute(
                """
                SELECT name FROM sqlite_master
                WHERE type = 'table'
                  AND name IN (
                    'preferences',
                    'preference_revisions',
                    'proposals',
                    'proposal_decisions',
                    'agent_actions',
                    'proposal_outcomes'
                  )
                """
            ).fetchall()
        }
        violations = migrated.execute("PRAGMA foreign_key_check").fetchall()

    assert version == 9
    assert tuple(user) == (4, "Existing account")
    assert ledger_tables == {
        "preferences",
        "preference_revisions",
        "proposals",
        "proposal_decisions",
        "agent_actions",
        "proposal_outcomes",
    }
    assert violations == []


def test_v7_migration_failure_rolls_back_trust_ledger(
    tmp_path,
    monkeypatch,
) -> None:
    database_path = tmp_path / "broken-correction-v7.db"
    connection = sqlite3.connect(database_path)
    connection.executescript(
        connection_module.SCHEMA_PATH.read_text(encoding="utf-8")
    )
    connection.execute(
        "INSERT INTO users (id, display_name) VALUES (4, 'Preserved account')"
    )
    connection.commit()
    connection.close()
    broken_migration = tmp_path / "broken-v8.sql"
    broken_migration.write_text(
        """
        CREATE TABLE preferences (id INTEGER PRIMARY KEY);
        CREATE TABLE migration_marker (id INTEGER PRIMARY KEY);
        THIS IS NOT VALID SQL;
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(connection_module, "V8_MIGRATION_PATH", broken_migration)

    with pytest.raises(sqlite3.OperationalError):
        Database(database_path).initialize()

    check = sqlite3.connect(database_path)
    account = check.execute(
        "SELECT id, display_name FROM users WHERE id = 4"
    ).fetchone()
    preferences = check.execute(
        """
        SELECT COUNT(*) FROM sqlite_master
        WHERE type = 'table' AND name = 'preferences'
        """
    ).fetchone()[0]
    marker = check.execute(
        """
        SELECT COUNT(*) FROM sqlite_master
        WHERE type = 'table' AND name = 'migration_marker'
        """
    ).fetchone()[0]
    version = check.execute("PRAGMA user_version").fetchone()[0]
    check.close()

    assert account == (4, "Preserved account")
    assert preferences == 0
    assert marker == 0
    assert version == 7


def test_v8_database_adds_channel_identity_tables_without_rewriting_users(
    tmp_path,
) -> None:
    database_path = tmp_path / "owned-v8.db"
    database = Database(database_path)
    database.initialize()
    with database.session() as connection:
        connection.execute(
            """
            INSERT INTO users (id, display_name, timezone, locale)
            VALUES (41, 'Version Eight User', 'UTC', 'en')
            """
        )
        connection.executescript(
            """
            DROP TABLE integration_message_receipts;
            DROP TABLE channel_bindings;
            DROP TABLE integration_credential_scopes;
            DROP TABLE integration_credentials;
            PRAGMA user_version = 8;
            """
        )

    database.initialize()

    with database.session() as connection:
        version = connection.execute("PRAGMA user_version").fetchone()[0]
        user = connection.execute(
            "SELECT display_name FROM users WHERE id = 41"
        ).fetchone()
        tables = {
            row["name"]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }
        violations = connection.execute("PRAGMA foreign_key_check").fetchall()

    assert version == 9
    assert user["display_name"] == "Version Eight User"
    assert {
        "integration_credentials",
        "integration_credential_scopes",
        "channel_bindings",
        "integration_message_receipts",
    } <= tables
    assert violations == []


def _create_v6_database(database_path: Path) -> None:
    connection = sqlite3.connect(database_path)
    connection.executescript(
        """
        PRAGMA foreign_keys = ON;
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            display_name TEXT NOT NULL,
            timezone TEXT NOT NULL DEFAULT 'UTC',
            locale TEXT NOT NULL DEFAULT 'en',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE time_logs (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            activity_id INTEGER,
            project_id INTEGER,
            task_id INTEGER,
            focus_session_id INTEGER,
            date TEXT NOT NULL,
            start_time TEXT,
            end_time TEXT,
            duration_minutes INTEGER NOT NULL CHECK (duration_minutes >= 0),
            duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
            activity_name TEXT NOT NULL,
            activity_type TEXT NOT NULL,
            type_source TEXT NOT NULL DEFAULT 'user_selected',
            task_title TEXT,
            note TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE weekly_reviews (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            week_start TEXT NOT NULL,
            week_end TEXT NOT NULL,
            wins_json TEXT NOT NULL,
            insights_json TEXT NOT NULL,
            next_steps_json TEXT NOT NULL,
            risk_flags_json TEXT NOT NULL,
            evidence_json TEXT NOT NULL,
            generated_text TEXT NOT NULL,
            model_name TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (user_id, week_start, week_end)
        );
        INSERT INTO users (id, display_name) VALUES (4, 'Existing account');
        INSERT INTO time_logs (
            id, user_id, date, duration_minutes, duration_seconds,
            activity_name, activity_type
        ) VALUES (
            9, 4, '2026-07-25', 30, 1800, 'Existing focus', 'consuming'
        );
        INSERT INTO weekly_reviews (
            id, user_id, week_start, week_end, wins_json, insights_json,
            next_steps_json, risk_flags_json, evidence_json, generated_text
        ) VALUES (
            10, 4, '2026-07-20', '2026-07-26',
            '[]', '[]', '[]', '[]', '{}', 'Existing review'
        );
        PRAGMA user_version = 6;
        """
    )
    connection.close()
