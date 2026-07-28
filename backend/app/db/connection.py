from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


SCHEMA_PATH = Path(__file__).with_name("schema.sql")
V6_MIGRATION_PATH = Path(__file__).with_name("migrations") / "v6.sql"
V7_MIGRATION_PATH = Path(__file__).with_name("migrations") / "v7.sql"
V8_MIGRATION_PATH = Path(__file__).with_name("migrations") / "v8.sql"
V9_MIGRATION_PATH = Path(__file__).with_name("migrations") / "v9.sql"
V10_MIGRATION_PATH = Path(__file__).with_name("migrations") / "v10.sql"
V11_MIGRATION_PATH = Path(__file__).with_name("migrations") / "v11.sql"
SCHEMA_VERSION = 11

LEGACY_TABLES = (
    "weekly_reviews",
    "daily_reflections",
    "time_logs",
    "planned_items",
    "activities",
    "weekly_plans",
    "projects",
    "goals",
)

LEGACY_INDEXES = (
    "idx_projects_goal_id",
    "idx_projects_status",
    "idx_activities_project_id",
    "idx_activities_type",
    "idx_weekly_plans_dates",
    "idx_planned_items_plan_id",
    "idx_planned_items_project_id",
    "idx_time_logs_date",
    "idx_time_logs_project_id",
    "idx_time_logs_activity_id",
    "idx_time_logs_activity_type",
    "idx_weekly_reviews_dates",
)


class Database:
    def __init__(self, path: str | Path) -> None:
        self.path = str(path)

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=5.0, check_same_thread=False)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 5000")
        return connection

    def initialize(self) -> None:
        if self.path != ":memory:":
            Path(self.path).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as connection:
            tables = {
                row["name"]
                for row in connection.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table'"
                ).fetchall()
            }
            version = connection.execute("PRAGMA user_version").fetchone()[0]
            if "goals" in tables and "users" not in tables:
                self._migrate_legacy_schema(connection)
            elif not tables:
                self._apply_schema(connection)
            elif version == 2:
                self._migrate_v2_schema(connection)
            elif version == 3:
                self._migrate_v3_schema(connection)
            elif version == 4:
                self._migrate_v4_schema(connection)
            elif version == 5:
                self._migrate_v5_schema(connection)
            elif version == 6:
                self._migrate_v6_schema(connection)
            elif version == 7:
                self._migrate_v7_schema(connection)
            elif version == 8:
                self._migrate_v8_schema(connection)
            elif version == 9:
                self._migrate_v9_schema(connection)
            elif version == 10:
                self._migrate_v10_schema(connection)
            elif version == SCHEMA_VERSION:
                self._apply_schema(connection)
            else:
                raise RuntimeError(
                    "Unsupported Theseus schema version "
                    f"{version}; expected 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, or {SCHEMA_VERSION}"
                )
            version = connection.execute("PRAGMA user_version").fetchone()[0]
            if version == 9:
                self._migrate_v9_schema(connection)
                version = connection.execute("PRAGMA user_version").fetchone()[0]
            if version == 10:
                self._migrate_v10_schema(connection)
                version = connection.execute("PRAGMA user_version").fetchone()[0]
            if version != SCHEMA_VERSION:
                raise RuntimeError(
                    f"Unsupported Theseus schema version {version}; expected {SCHEMA_VERSION}"
                )

    def _migrate_v2_schema(self, connection: sqlite3.Connection) -> None:
        self._run_atomic_migration(
            connection,
            self._v5_extension_sql(connection)
            + self._v6_extension_sql(connection)
            + self._v7_extension_sql(connection)
            + self._v8_extension_sql(connection)
            + self._v9_extension_sql(connection)
            + SCHEMA_PATH.read_text(encoding="utf-8")
            + "\nPRAGMA user_version = 9;\n",
            "The Theseus v2 database could not be migrated safely",
        )

    def _migrate_v3_schema(self, connection: sqlite3.Connection) -> None:
        self._run_atomic_migration(
            connection,
            "ALTER TABLE auth_credentials DROP COLUMN recovery_code_hash;\n"
            + self._v5_extension_sql(connection)
            + self._v6_extension_sql(connection)
            + self._v7_extension_sql(connection)
            + self._v8_extension_sql(connection)
            + self._v9_extension_sql(connection)
            + SCHEMA_PATH.read_text(encoding="utf-8")
            + "\nPRAGMA user_version = 9;\n",
            "The Theseus v3 database could not be migrated safely",
        )

    def _migrate_v4_schema(self, connection: sqlite3.Connection) -> None:
        self._run_atomic_migration(
            connection,
            self._v5_extension_sql(connection)
            + self._v6_extension_sql(connection)
            + self._v7_extension_sql(connection)
            + self._v8_extension_sql(connection)
            + self._v9_extension_sql(connection)
            + SCHEMA_PATH.read_text(encoding="utf-8")
            + "\nPRAGMA user_version = 9;\n",
            "The Theseus v4 database could not be migrated safely",
        )

    def _migrate_v5_schema(self, connection: sqlite3.Connection) -> None:
        self._run_atomic_migration(
            connection,
            self._v6_extension_sql(connection)
            + self._v7_extension_sql(connection)
            + self._v8_extension_sql(connection)
            + self._v9_extension_sql(connection)
            + SCHEMA_PATH.read_text(encoding="utf-8")
            + "\nPRAGMA user_version = 9;\n",
            "The Theseus v5 database could not be migrated safely",
        )

    def _migrate_v6_schema(self, connection: sqlite3.Connection) -> None:
        self._run_atomic_migration(
            connection,
            self._v7_extension_sql(connection)
            + self._v8_extension_sql(connection)
            + self._v9_extension_sql(connection)
            + SCHEMA_PATH.read_text(encoding="utf-8")
            + "\nPRAGMA user_version = 9;\n",
            "The Theseus v6 database could not be migrated safely",
        )

    def _migrate_v7_schema(self, connection: sqlite3.Connection) -> None:
        self._run_atomic_migration(
            connection,
            self._v8_extension_sql(connection)
            + self._v9_extension_sql(connection)
            + SCHEMA_PATH.read_text(encoding="utf-8")
            + "\nPRAGMA user_version = 9;\n",
            "The Theseus v7 database could not be migrated safely",
        )

    def _migrate_v8_schema(self, connection: sqlite3.Connection) -> None:
        self._run_atomic_migration(
            connection,
            self._v9_extension_sql(connection)
            + SCHEMA_PATH.read_text(encoding="utf-8")
            + "\nPRAGMA user_version = 9;\n",
            "The Theseus v8 database could not be migrated safely",
        )

    def _migrate_v9_schema(self, connection: sqlite3.Connection) -> None:
        self._run_atomic_migration(
            connection,
            V10_MIGRATION_PATH.read_text(encoding="utf-8") + "\n",
            "The Theseus v9 database could not be migrated safely",
        )

    def _migrate_v10_schema(self, connection: sqlite3.Connection) -> None:
        self._run_atomic_migration(
            connection,
            V11_MIGRATION_PATH.read_text(encoding="utf-8") + "\n",
            "The Theseus v10 database could not be migrated safely",
        )

    @staticmethod
    def _v5_extension_sql(connection: sqlite3.Connection) -> str:
        additions = {
            "activities": (
                ("version", "INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)"),
            ),
            "planned_items": (
                ("task_id", "INTEGER REFERENCES tasks(id) ON DELETE SET NULL"),
            ),
            "time_logs": (
                ("task_id", "INTEGER REFERENCES tasks(id) ON DELETE SET NULL"),
                ("task_title", "TEXT"),
            ),
        }
        statements: list[str] = []
        existing_tables = {
            row["name"]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }
        for table, columns in additions.items():
            if table not in existing_tables:
                continue
            existing_columns = {
                row["name"]
                for row in connection.execute(f"PRAGMA table_info({table})").fetchall()
            }
            statements.extend(
                f"ALTER TABLE {table} ADD COLUMN {name} {definition};"
                for name, definition in columns
                if name not in existing_columns
            )
        return "\n".join(statements) + ("\n" if statements else "")

    def _apply_schema(self, connection: sqlite3.Connection) -> None:
        version = connection.execute("PRAGMA user_version").fetchone()[0]
        migration_sql = (
            SCHEMA_PATH.read_text(encoding="utf-8")
            + self._v8_extension_sql(connection)
            + self._v9_extension_sql(connection)
        )
        if version == 0:
            migration_sql += (
                V10_MIGRATION_PATH.read_text(encoding="utf-8")
                + "\n"
                + V11_MIGRATION_PATH.read_text(encoding="utf-8")
                + "\n"
            )
        else:
            migration_sql += f"\nPRAGMA user_version = {SCHEMA_VERSION};\n"
        self._run_atomic_migration(
            connection,
            migration_sql,
            "The Theseus database schema could not be applied safely",
        )

    @staticmethod
    def _v6_extension_sql(connection: sqlite3.Connection) -> str:
        time_logs_exists = connection.execute(
            """
            SELECT 1
            FROM sqlite_master
            WHERE type = 'table' AND name = 'time_logs'
            """
        ).fetchone()
        if time_logs_exists is None:
            return ""
        return V6_MIGRATION_PATH.read_text(encoding="utf-8") + "\n"

    @staticmethod
    def _v7_extension_sql(connection: sqlite3.Connection) -> str:
        existing_tables = {
            row["name"]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }
        if "time_logs" not in existing_tables:
            return ""
        migration_sql = V7_MIGRATION_PATH.read_text(encoding="utf-8")
        if "weekly_reviews" not in existing_tables:
            migration_sql = migration_sql.replace(
                "ALTER TABLE weekly_reviews\nADD COLUMN stale_at TEXT;\n\n",
                "",
            )
        return migration_sql + "\n"

    @staticmethod
    def _v8_extension_sql(connection: sqlite3.Connection) -> str:
        preferences_exists = connection.execute(
            """
            SELECT 1
            FROM sqlite_master
            WHERE type = 'table' AND name = 'preferences'
            """
        ).fetchone()
        if preferences_exists is not None:
            return ""
        return V8_MIGRATION_PATH.read_text(encoding="utf-8") + "\n"

    @staticmethod
    def _v9_extension_sql(connection: sqlite3.Connection) -> str:
        credentials_exist = connection.execute(
            """
            SELECT 1
            FROM sqlite_master
            WHERE type = 'table' AND name = 'integration_credentials'
            """
        ).fetchone()
        if credentials_exist is not None:
            return ""
        return V9_MIGRATION_PATH.read_text(encoding="utf-8") + "\n"

    @staticmethod
    def _run_atomic_migration(
        connection: sqlite3.Connection,
        migration_sql: str,
        integrity_error: str,
    ) -> None:
        try:
            # executescript otherwise commits statements independently. Leaving the
            # explicit transaction open lets the integrity check decide the outcome.
            connection.executescript(f"BEGIN IMMEDIATE;\n{migration_sql}")
            violations = connection.execute("PRAGMA foreign_key_check").fetchall()
            if violations:
                raise RuntimeError(integrity_error)
        except Exception:
            connection.rollback()
            raise
        connection.commit()

    def _migrate_legacy_schema(self, connection: sqlite3.Connection) -> None:
        schema_sql = (
            SCHEMA_PATH.read_text(encoding="utf-8")
            + "\n"
            + V8_MIGRATION_PATH.read_text(encoding="utf-8")
            + "\n"
            + V9_MIGRATION_PATH.read_text(encoding="utf-8")
            + "\nPRAGMA user_version = 9;\n"
        )
        rename_sql = "\n".join(
            f"ALTER TABLE {table} RENAME TO {table}_legacy;"
            for table in LEGACY_TABLES
        )
        drop_index_sql = "\n".join(
            f"DROP INDEX IF EXISTS {index};" for index in LEGACY_INDEXES
        )
        drop_legacy_sql = "\n".join(
            f"DROP TABLE {table}_legacy;" for table in LEGACY_TABLES
        )
        migration_sql = f"""
            {rename_sql}
            {drop_index_sql}
            {schema_sql}

            INSERT INTO users (id, display_name, timezone, locale)
            VALUES (1, 'Local User', 'UTC', 'en');

            INSERT INTO goals (
                id, user_id, title, description, priority, active_status,
                created_at, updated_at
            )
            SELECT id, 1, title, description, priority, active_status,
                   created_at, updated_at
            FROM goals_legacy;

            INSERT INTO projects (
                id, user_id, goal_id, title, stage, deadline,
                weekly_min_minutes, weekly_target_minutes, status,
                last_activity_date, created_at, updated_at
            )
            SELECT id, 1, goal_id, title, stage, deadline,
                   weekly_min_minutes, weekly_target_minutes, status,
                   last_activity_date, created_at, updated_at
            FROM projects_legacy;

            INSERT INTO activities (
                id, user_id, project_id, name, description, activity_type,
                type_source, created_at, updated_at
            )
            SELECT id, 1, project_id, name, description, activity_type,
                   type_source, created_at, updated_at
            FROM activities_legacy;

            INSERT INTO weekly_plans (
                id, user_id, week_start, week_end, planned_capacity_minutes,
                slack_target_percent, note, created_at, updated_at
            )
            SELECT id, 1, week_start, week_end, planned_capacity_minutes,
                   slack_target_percent, note, created_at, updated_at
            FROM weekly_plans_legacy;

            INSERT INTO planned_items (
                id, weekly_plan_id, project_id, title, planned_minutes,
                priority, is_completed, created_at, updated_at
            )
            SELECT id, weekly_plan_id, project_id, title, planned_minutes,
                   priority, is_completed, created_at, updated_at
            FROM planned_items_legacy;

            INSERT INTO time_logs (
                id, user_id, activity_id, project_id, date, start_time,
                end_time, duration_minutes, duration_seconds, activity_name,
                activity_type, type_source, note, created_at, updated_at
            )
            SELECT id, 1, activity_id, project_id, date, start_time,
                   end_time, duration_minutes, duration_minutes * 60,
                   activity_name, activity_type, type_source, note,
                   created_at, updated_at
            FROM time_logs_legacy;

            INSERT INTO daily_reflections (
                id, user_id, date, small_win, mood_note, free_note,
                created_at, updated_at
            )
            SELECT id, 1, date, small_win, mood_note, free_note,
                   created_at, updated_at
            FROM daily_reflections_legacy;

            INSERT INTO weekly_reviews (
                id, user_id, week_start, week_end, wins_json, insights_json,
                next_steps_json, risk_flags_json, evidence_json,
                generated_text, model_name, created_at, updated_at
            )
            SELECT id, 1, week_start, week_end, wins_json, insights_json,
                   next_steps_json, risk_flags_json, evidence_json,
                   generated_text, model_name, created_at, updated_at
            FROM weekly_reviews_legacy;

            {drop_legacy_sql}
        """
        connection.execute("PRAGMA foreign_keys = OFF")
        connection.execute("PRAGMA legacy_alter_table = ON")
        try:
            self._run_atomic_migration(
                connection,
                migration_sql,
                "The legacy Theseus database could not be migrated safely",
            )
        finally:
            connection.execute("PRAGMA legacy_alter_table = OFF")
            connection.execute("PRAGMA foreign_keys = ON")

    @contextmanager
    def session(self) -> Iterator[sqlite3.Connection]:
        connection = self.connect()
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()
