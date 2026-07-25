from __future__ import annotations

import sqlite3

from ..db.repositories import ActivityRepository
from ..schemas import ActivityCreate, ActivityRead, ActivityTypeSource, ActivityUpdate


class ActivityNotFound(Exception):
    pass


class ActivityInUse(Exception):
    pass


class ActivityVersionConflict(Exception):
    def __init__(self, current: ActivityRead) -> None:
        super().__init__("The activity changed after it was loaded")
        self.current = current


class ActivityService:
    def __init__(self, connection: sqlite3.Connection, user_id: int) -> None:
        self.repository = ActivityRepository(connection, user_id)

    def create(
        self,
        activity: ActivityCreate,
        *,
        type_source: ActivityTypeSource = "user_selected",
    ) -> ActivityRead:
        return self.repository.create(activity, type_source=type_source)

    def get(self, activity_id: int) -> ActivityRead:
        try:
            return self.repository.get(activity_id)
        except LookupError as exc:
            raise ActivityNotFound from exc

    def list(self, *, project_id: int | None = None) -> list[ActivityRead]:
        return self.repository.list(project_id=project_id)

    def update(self, activity_id: int, patch: ActivityUpdate) -> ActivityRead:
        current = self.get(activity_id)
        if patch.expected_version != current.version:
            raise ActivityVersionConflict(current)

        updates = patch.model_dump(
            mode="json",
            exclude={"expected_version"},
            exclude_unset=True,
        )
        if "description" in updates and updates["description"] is None:
            updates["description"] = ""
        if (
            "project_id" in updates
            and updates["project_id"] != current.project_id
            and self.repository.has_open_focus_session(activity_id)
        ):
            raise ActivityInUse
        if (
            "activity_type" in updates
            and updates["activity_type"] != current.activity_type
        ):
            updates["type_source"] = "user_corrected"

        updated = self.repository.update_if_version(
            activity_id,
            patch.expected_version,
            updates,
        )
        if updated is not None:
            return updated

        try:
            latest = self.repository.get(activity_id)
        except LookupError as exc:
            raise ActivityNotFound from exc
        raise ActivityVersionConflict(latest)
