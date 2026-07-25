from __future__ import annotations

import sqlite3

from ...schemas import (
    ActivityCreate,
    ActivityRead,
    ActivityTypeSource,
    DailyReflectionCreate,
    DailyReflectionRead,
    GoalCreate,
    GoalRead,
    ProjectCreate,
    ProjectRead,
)
from ._common import require_row, validate_row


class GoalRepository:
    def __init__(self, connection: sqlite3.Connection, user_id: int) -> None:
        self.connection = connection
        self.user_id = user_id

    def create(self, goal: GoalCreate) -> GoalRead:
        cursor = self.connection.execute(
            """
            INSERT INTO goals (user_id, title, description, priority, active_status)
            VALUES (:user_id, :title, :description, :priority, :active_status)
            """,
            {**goal.model_dump(mode="json"), "user_id": self.user_id},
        )
        return self.get(cursor.lastrowid)

    def get(self, goal_id: int) -> GoalRead:
        row = self.connection.execute(
            "SELECT * FROM goals WHERE id = ? AND user_id = ?",
            (goal_id, self.user_id),
        ).fetchone()
        return validate_row(GoalRead, require_row(row, "Goal", goal_id))

    def list(self) -> list[GoalRead]:
        rows = self.connection.execute(
            "SELECT * FROM goals WHERE user_id = ? ORDER BY priority, id",
            (self.user_id,),
        ).fetchall()
        return [validate_row(GoalRead, row) for row in rows]


class ProjectRepository:
    def __init__(self, connection: sqlite3.Connection, user_id: int) -> None:
        self.connection = connection
        self.user_id = user_id

    def create(self, project: ProjectCreate) -> ProjectRead:
        cursor = self.connection.execute(
            """
            INSERT INTO projects (
                user_id, goal_id, title, stage, deadline, weekly_min_minutes,
                weekly_target_minutes, status, last_activity_date
            ) VALUES (
                :user_id, :goal_id, :title, :stage, :deadline, :weekly_min_minutes,
                :weekly_target_minutes, :status, :last_activity_date
            )
            """,
            {**project.model_dump(mode="json"), "user_id": self.user_id},
        )
        return self.get(cursor.lastrowid)

    def get(self, project_id: int) -> ProjectRead:
        row = self.connection.execute(
            "SELECT * FROM projects WHERE id = ? AND user_id = ?",
            (project_id, self.user_id),
        ).fetchone()
        return validate_row(ProjectRead, require_row(row, "Project", project_id))

    def list(self) -> list[ProjectRead]:
        rows = self.connection.execute(
            "SELECT * FROM projects WHERE user_id = ? ORDER BY id",
            (self.user_id,),
        ).fetchall()
        return [validate_row(ProjectRead, row) for row in rows]


class ActivityRepository:
    def __init__(self, connection: sqlite3.Connection, user_id: int) -> None:
        self.connection = connection
        self.user_id = user_id

    def create(
        self,
        activity: ActivityCreate,
        *,
        type_source: ActivityTypeSource = "user_selected",
    ) -> ActivityRead:
        values = {
            **activity.model_dump(mode="json", exclude={"type_source"}),
            "user_id": self.user_id,
            "type_source": type_source,
        }
        cursor = self.connection.execute(
            """
            INSERT INTO activities (
                user_id, project_id, name, description, activity_type, type_source
            ) VALUES (
                :user_id, :project_id, :name, :description, :activity_type, :type_source
            )
            """,
            values,
        )
        return self.get(cursor.lastrowid)

    def get(self, activity_id: int) -> ActivityRead:
        row = self.connection.execute(
            "SELECT * FROM activities WHERE id = ? AND user_id = ?",
            (activity_id, self.user_id),
        ).fetchone()
        return validate_row(ActivityRead, require_row(row, "Activity", activity_id))

    def list(self, *, project_id: int | None = None) -> list[ActivityRead]:
        project_clause = "" if project_id is None else "AND project_id = :project_id"
        rows = self.connection.execute(
            f"""
            SELECT * FROM activities
            WHERE user_id = :user_id {project_clause}
            ORDER BY name COLLATE NOCASE, id
            """,
            {"user_id": self.user_id, "project_id": project_id},
        ).fetchall()
        return [validate_row(ActivityRead, row) for row in rows]

    def update_if_version(
        self,
        activity_id: int,
        expected_version: int,
        updates: dict[str, object],
    ) -> ActivityRead | None:
        allowed = {
            "project_id",
            "name",
            "description",
            "activity_type",
            "type_source",
        }
        if not updates or not set(updates) <= allowed:
            raise ValueError("Activity update contains unsupported fields")
        assignments = [f"{field} = :{field}" for field in updates]
        assignments.extend(
            (
                "version = version + 1",
                "updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
            )
        )
        values = {
            **updates,
            "id": activity_id,
            "user_id": self.user_id,
            "expected_version": expected_version,
        }
        cursor = self.connection.execute(
            f"""
            UPDATE activities
            SET {', '.join(assignments)}
            WHERE id = :id
              AND user_id = :user_id
              AND version = :expected_version
            """,
            values,
        )
        if cursor.rowcount != 1:
            return None
        return self.get(activity_id)

    def has_open_focus_session(self, activity_id: int) -> bool:
        focus_table = self.connection.execute(
            """
            SELECT 1
            FROM sqlite_master
            WHERE type = 'table' AND name = 'focus_sessions'
            """
        ).fetchone()
        if focus_table is None:
            return False
        row = self.connection.execute(
            """
            SELECT 1
            FROM focus_sessions
            WHERE user_id = ?
              AND activity_id = ?
              AND status = 'running'
            LIMIT 1
            """,
            (self.user_id, activity_id),
        ).fetchone()
        return row is not None


class DailyReflectionRepository:
    def __init__(self, connection: sqlite3.Connection, user_id: int) -> None:
        self.connection = connection
        self.user_id = user_id

    def create(self, reflection: DailyReflectionCreate) -> DailyReflectionRead:
        cursor = self.connection.execute(
            """
            INSERT INTO daily_reflections (user_id, date, small_win, mood_note, free_note)
            VALUES (:user_id, :date, :small_win, :mood_note, :free_note)
            """,
            {**reflection.model_dump(mode="json"), "user_id": self.user_id},
        )
        return self.get(cursor.lastrowid)

    def get(self, reflection_id: int) -> DailyReflectionRead:
        row = self.connection.execute(
            "SELECT * FROM daily_reflections WHERE id = ? AND user_id = ?",
            (reflection_id, self.user_id),
        ).fetchone()
        return validate_row(DailyReflectionRead, require_row(row, "DailyReflection", reflection_id))

    def list_between(self, start_date: str, end_date: str) -> list[DailyReflectionRead]:
        rows = self.connection.execute(
            """
            SELECT * FROM daily_reflections
            WHERE user_id = ? AND date BETWEEN ? AND ?
            ORDER BY date, id
            """,
            (self.user_id, start_date, end_date),
        ).fetchall()
        return [validate_row(DailyReflectionRead, row) for row in rows]
