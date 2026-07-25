from __future__ import annotations

import sqlite3
from datetime import date, datetime, timezone

from ..db.repositories import TaskRepository
from ..schemas import TaskCreate, TaskCreationSource, TaskRead, TaskStatus, TaskUpdate


class TaskNotFound(Exception):
    pass


class InvalidTaskTransition(Exception):
    pass


class TaskVersionConflict(Exception):
    def __init__(self, current: TaskRead) -> None:
        super().__init__("The task changed after it was loaded")
        self.current = current


ALLOWED_TASK_TRANSITIONS: dict[TaskStatus, set[TaskStatus]] = {
    "open": {"in_progress", "completed", "cancelled"},
    "in_progress": {"open", "completed", "cancelled"},
    "completed": {"in_progress"},
    "cancelled": {"open"},
}


class TaskService:
    def __init__(self, connection: sqlite3.Connection, user_id: int) -> None:
        self.repository = TaskRepository(connection, user_id)

    def create(
        self,
        task: TaskCreate,
        *,
        created_source: TaskCreationSource = "user",
    ) -> TaskRead:
        return self.repository.create(task, created_source=created_source)

    def get(self, task_id: int, *, include_archived: bool = False) -> TaskRead:
        try:
            return self.repository.get(task_id, include_archived=include_archived)
        except LookupError as exc:
            raise TaskNotFound from exc

    def list(
        self,
        *,
        project_id: int | None = None,
        statuses: list[TaskStatus] | None = None,
        include_archived: bool = False,
        due_from: date | None = None,
        due_to: date | None = None,
    ) -> list[TaskRead]:
        return self.repository.list(
            project_id=project_id,
            statuses=statuses,
            include_archived=include_archived,
            due_from=due_from.isoformat() if due_from else None,
            due_to=due_to.isoformat() if due_to else None,
        )

    def update(self, task_id: int, patch: TaskUpdate) -> TaskRead:
        current = self.get(task_id, include_archived=True)
        if patch.expected_version != current.version:
            raise TaskVersionConflict(current)
        updates = patch.model_dump(
            mode="json",
            exclude={"expected_version", "archived"},
            exclude_unset=True,
        )
        if "description" in updates and updates["description"] is None:
            updates["description"] = ""

        if "status" in updates:
            next_status = updates["status"]
            if next_status != current.status:
                self._validate_transition(current.status, next_status)
                if next_status == "completed":
                    updates["completed_at"] = _utc_now()
                elif current.status == "completed":
                    updates["completed_at"] = None

        if "archived" in patch.model_fields_set:
            updates["archived_at"] = (
                _utc_now() if patch.archived and current.archived_at is None else None
            ) if patch.archived is not None else current.archived_at
            if patch.archived and current.archived_at is not None:
                updates["archived_at"] = current.archived_at.isoformat().replace("+00:00", "Z")

        updated = self.repository.update_if_version(
            task_id,
            patch.expected_version,
            updates,
        )
        if updated is not None:
            return updated

        try:
            latest = self.repository.get(task_id, include_archived=True)
        except LookupError as exc:
            raise TaskNotFound from exc
        raise TaskVersionConflict(latest)

    @staticmethod
    def _validate_transition(current: TaskStatus, target: TaskStatus) -> None:
        if target not in ALLOWED_TASK_TRANSITIONS[current]:
            raise InvalidTaskTransition(
                f"Task cannot move from {current} to {target}"
            )


def _utc_now() -> str:
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )
