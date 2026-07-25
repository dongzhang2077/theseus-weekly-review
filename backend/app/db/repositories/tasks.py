from __future__ import annotations

import sqlite3
from collections.abc import Sequence

from ...schemas import TaskCreate, TaskCreationSource, TaskRead
from ._common import require_row, validate_row


class TaskRepository:
    def __init__(self, connection: sqlite3.Connection, user_id: int) -> None:
        self.connection = connection
        self.user_id = user_id

    def create(
        self,
        task: TaskCreate,
        *,
        created_source: TaskCreationSource = "user",
    ) -> TaskRead:
        values = {
            **task.model_dump(mode="json"),
            "user_id": self.user_id,
            "created_source": created_source,
        }
        cursor = self.connection.execute(
            """
            INSERT INTO tasks (
                user_id, project_id, title, description, priority,
                estimated_minutes, due_date, created_source
            ) VALUES (
                :user_id, :project_id, :title, :description, :priority,
                :estimated_minutes, :due_date, :created_source
            )
            """,
            values,
        )
        return self.get(cursor.lastrowid, include_archived=True)

    def get(self, task_id: int, *, include_archived: bool = False) -> TaskRead:
        archived_clause = "" if include_archived else "AND archived_at IS NULL"
        row = self.connection.execute(
            f"""
            SELECT * FROM tasks
            WHERE id = ? AND user_id = ? {archived_clause}
            """,
            (task_id, self.user_id),
        ).fetchone()
        return validate_row(TaskRead, require_row(row, "Task", task_id))

    def list(
        self,
        *,
        project_id: int | None = None,
        statuses: Sequence[str] | None = None,
        include_archived: bool = False,
        due_from: str | None = None,
        due_to: str | None = None,
    ) -> list[TaskRead]:
        clauses = ["user_id = :user_id"]
        parameters: dict[str, object] = {"user_id": self.user_id}
        if project_id is not None:
            clauses.append("project_id = :project_id")
            parameters["project_id"] = project_id
        if statuses:
            placeholders: list[str] = []
            for index, task_status in enumerate(statuses):
                key = f"status_{index}"
                placeholders.append(f":{key}")
                parameters[key] = task_status
            clauses.append(f"status IN ({', '.join(placeholders)})")
        if not include_archived:
            clauses.append("archived_at IS NULL")
        if due_from is not None:
            clauses.append("due_date >= :due_from")
            parameters["due_from"] = due_from
        if due_to is not None:
            clauses.append("due_date <= :due_to")
            parameters["due_to"] = due_to

        rows = self.connection.execute(
            f"""
            SELECT * FROM tasks
            WHERE {' AND '.join(clauses)}
            ORDER BY
                CASE WHEN archived_at IS NULL THEN 0 ELSE 1 END,
                CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
                due_date,
                priority,
                id
            """,
            parameters,
        ).fetchall()
        return [validate_row(TaskRead, row) for row in rows]

    def update_if_version(
        self,
        task_id: int,
        expected_version: int,
        updates: dict[str, object],
    ) -> TaskRead | None:
        allowed = {
            "title",
            "description",
            "priority",
            "estimated_minutes",
            "due_date",
            "status",
            "completed_at",
            "archived_at",
        }
        if not updates or not set(updates) <= allowed:
            raise ValueError("Task update contains unsupported fields")
        assignments = [f"{field} = :{field}" for field in updates]
        assignments.extend(
            (
                "version = version + 1",
                "updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
            )
        )
        values = {
            **updates,
            "id": task_id,
            "user_id": self.user_id,
            "expected_version": expected_version,
        }
        cursor = self.connection.execute(
            f"""
            UPDATE tasks
            SET {', '.join(assignments)}
            WHERE id = :id
              AND user_id = :user_id
              AND version = :expected_version
            """,
            values,
        )
        if cursor.rowcount != 1:
            return None
        return self.get(task_id, include_archived=True)

    def has_running_focus_session(self, task_id: int) -> bool:
        row = self.connection.execute(
            """
            SELECT 1
            FROM focus_sessions
            WHERE user_id = ? AND task_id = ? AND status = 'running'
            LIMIT 1
            """,
            (self.user_id, task_id),
        ).fetchone()
        return row is not None
