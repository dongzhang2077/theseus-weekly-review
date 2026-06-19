from __future__ import annotations

import sqlite3

from ...schemas import (
    ActivityCreate,
    ActivityRead,
    DailyReflectionCreate,
    DailyReflectionRead,
    GoalCreate,
    GoalRead,
    ProjectCreate,
    ProjectRead,
)
from ._common import require_row, validate_row


class GoalRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def create(self, goal: GoalCreate) -> GoalRead:
        cursor = self.connection.execute(
            """
            INSERT INTO goals (title, description, priority, active_status)
            VALUES (:title, :description, :priority, :active_status)
            """,
            goal.model_dump(mode="json"),
        )
        return self.get(cursor.lastrowid)

    def get(self, goal_id: int) -> GoalRead:
        row = self.connection.execute("SELECT * FROM goals WHERE id = ?", (goal_id,)).fetchone()
        return validate_row(GoalRead, require_row(row, "Goal", goal_id))

    def list(self) -> list[GoalRead]:
        rows = self.connection.execute("SELECT * FROM goals ORDER BY priority, id").fetchall()
        return [validate_row(GoalRead, row) for row in rows]


class ProjectRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def create(self, project: ProjectCreate) -> ProjectRead:
        cursor = self.connection.execute(
            """
            INSERT INTO projects (
                goal_id, title, stage, deadline, weekly_min_minutes,
                weekly_target_minutes, status, last_activity_date
            ) VALUES (
                :goal_id, :title, :stage, :deadline, :weekly_min_minutes,
                :weekly_target_minutes, :status, :last_activity_date
            )
            """,
            project.model_dump(mode="json"),
        )
        return self.get(cursor.lastrowid)

    def get(self, project_id: int) -> ProjectRead:
        row = self.connection.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        return validate_row(ProjectRead, require_row(row, "Project", project_id))

    def list(self) -> list[ProjectRead]:
        rows = self.connection.execute("SELECT * FROM projects ORDER BY id").fetchall()
        return [validate_row(ProjectRead, row) for row in rows]


class ActivityRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def create(self, activity: ActivityCreate) -> ActivityRead:
        cursor = self.connection.execute(
            """
            INSERT INTO activities (project_id, name, description, activity_type, type_source)
            VALUES (:project_id, :name, :description, :activity_type, :type_source)
            """,
            activity.model_dump(mode="json"),
        )
        return self.get(cursor.lastrowid)

    def get(self, activity_id: int) -> ActivityRead:
        row = self.connection.execute("SELECT * FROM activities WHERE id = ?", (activity_id,)).fetchone()
        return validate_row(ActivityRead, require_row(row, "Activity", activity_id))

    def list(self) -> list[ActivityRead]:
        rows = self.connection.execute("SELECT * FROM activities ORDER BY id").fetchall()
        return [validate_row(ActivityRead, row) for row in rows]


class DailyReflectionRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def create(self, reflection: DailyReflectionCreate) -> DailyReflectionRead:
        cursor = self.connection.execute(
            """
            INSERT INTO daily_reflections (date, small_win, mood_note, free_note)
            VALUES (:date, :small_win, :mood_note, :free_note)
            """,
            reflection.model_dump(mode="json"),
        )
        return self.get(cursor.lastrowid)

    def get(self, reflection_id: int) -> DailyReflectionRead:
        row = self.connection.execute(
            "SELECT * FROM daily_reflections WHERE id = ?", (reflection_id,)
        ).fetchone()
        return validate_row(DailyReflectionRead, require_row(row, "DailyReflection", reflection_id))

    def list_between(self, start_date: str, end_date: str) -> list[DailyReflectionRead]:
        rows = self.connection.execute(
            """
            SELECT * FROM daily_reflections
            WHERE date BETWEEN ? AND ?
            ORDER BY date, id
            """,
            (start_date, end_date),
        ).fetchall()
        return [validate_row(DailyReflectionRead, row) for row in rows]
