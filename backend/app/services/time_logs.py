from __future__ import annotations

import hashlib
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Iterator

from ..db.repositories import (
    ActivityRepository,
    IdempotencyReceiptRepository,
    ProjectRepository,
    TaskRepository,
    TimeLogRepository,
)
from ..schemas import (
    ReviewWeekRange,
    TimeLogMutationResult,
    TimeLogRead,
    TimeLogUndoRequest,
    TimeLogUpdate,
)
from .focus import IdempotencyConflict, IdempotencyInProgress


class TimeLogNotFound(Exception):
    pass


class TimeLogReferenceConflict(Exception):
    pass


class TimeLogVersionConflict(Exception):
    def __init__(self, current: TimeLogRead) -> None:
        super().__init__("The TimeLog changed after it was loaded")
        self.current = current


class InvalidTimeLogState(Exception):
    def __init__(self, current: TimeLogRead) -> None:
        super().__init__("The TimeLog cannot be changed in its current state")
        self.current = current


class TimeLogRevisionNotFound(Exception):
    pass


class TimeLogService:
    def __init__(self, connection: sqlite3.Connection, user_id: int) -> None:
        self.connection = connection
        self.user_id = user_id
        self.logs = TimeLogRepository(connection, user_id)
        self.receipts = IdempotencyReceiptRepository(connection, user_id)
        self.activities = ActivityRepository(connection, user_id)
        self.projects = ProjectRepository(connection, user_id)
        self.tasks = TaskRepository(connection, user_id)

    def update(
        self,
        time_log_id: int,
        request: TimeLogUpdate,
        *,
        idempotency_key: str,
    ) -> TimeLogMutationResult:
        operation = "time_log.update"
        payload = {"time_log_id": time_log_id, **request.model_dump(mode="json")}
        with self._savepoint("time_log_update"):
            replay = self._begin_or_replay(operation, payload, idempotency_key)
            if replay is not None:
                return replay
            current = self._get(time_log_id, include_deleted=True)
            self._require_version(current, request.expected_version)
            if current.deleted_at is not None:
                raise InvalidTimeLogState(current)

            updates = self._validated_updates(current, request)
            changed = self.logs.update_if_version(
                time_log_id,
                request.expected_version,
                updates,
            )
            if changed is None:
                raise TimeLogVersionConflict(self._get(time_log_id, include_deleted=True))
            result = self._finish_mutation(
                operation=operation,
                idempotency_key=idempotency_key,
                before=current,
                after=changed,
                action="update",
                reason=request.reason,
            )
            return result

    def delete(
        self,
        time_log_id: int,
        *,
        expected_version: int,
        idempotency_key: str,
    ) -> TimeLogMutationResult:
        operation = "time_log.delete"
        payload = {"time_log_id": time_log_id, "expected_version": expected_version}
        with self._savepoint("time_log_delete"):
            replay = self._begin_or_replay(operation, payload, idempotency_key)
            if replay is not None:
                return replay
            current = self._get(time_log_id, include_deleted=True)
            self._require_version(current, expected_version)
            if current.deleted_at is not None:
                raise InvalidTimeLogState(current)
            changed = self.logs.update_if_version(
                time_log_id,
                expected_version,
                {"deleted_at": _utc_now()},
            )
            if changed is None:
                raise TimeLogVersionConflict(self._get(time_log_id, include_deleted=True))
            return self._finish_mutation(
                operation=operation,
                idempotency_key=idempotency_key,
                before=current,
                after=changed,
                action="delete",
            )

    def undo(
        self,
        time_log_id: int,
        revision_id: int,
        request: TimeLogUndoRequest,
        *,
        idempotency_key: str,
    ) -> TimeLogMutationResult:
        operation = "time_log.undo"
        payload = {
            "time_log_id": time_log_id,
            "revision_id": revision_id,
            **request.model_dump(mode="json"),
        }
        with self._savepoint("time_log_undo"):
            replay = self._begin_or_replay(operation, payload, idempotency_key)
            if replay is not None:
                return replay
            current = self._get(time_log_id, include_deleted=True)
            self._require_version(current, request.expected_version)
            try:
                revision = self.logs.get_revision(time_log_id, revision_id)
            except LookupError as exc:
                raise TimeLogRevisionNotFound from exc
            target = TimeLogRead.model_validate_json(revision.before_json)
            updates = self._snapshot_updates(target)
            self._validate_links(updates)
            changed = self.logs.update_if_version(
                time_log_id,
                request.expected_version,
                updates,
            )
            if changed is None:
                raise TimeLogVersionConflict(self._get(time_log_id, include_deleted=True))
            action = (
                "restore"
                if current.deleted_at is not None and changed.deleted_at is None
                else "undo"
            )
            return self._finish_mutation(
                operation=operation,
                idempotency_key=idempotency_key,
                before=current,
                after=changed,
                action=action,
            )

    def _validated_updates(
        self,
        current: TimeLogRead,
        request: TimeLogUpdate,
    ) -> dict[str, object]:
        changed_fields = request.model_fields_set - {"expected_version", "reason"}
        updates = {
            field: value
            for field, value in request.model_dump(mode="json").items()
            if field in changed_fields
        }
        if "duration_seconds" in changed_fields:
            seconds = int(updates["duration_seconds"])
            updates["duration_minutes"] = (seconds + 30) // 60
        elif "duration_minutes" in changed_fields:
            minutes = int(updates["duration_minutes"])
            if minutes <= 0:
                raise ValueError("duration_minutes must be positive without exact seconds")
            updates["duration_seconds"] = minutes * 60

        merged = self._snapshot_updates(current)
        merged.update(updates)
        if (merged["start_time"] is None) != (merged["end_time"] is None):
            raise ValueError("start_time and end_time must be provided together")
        self._validate_links(merged)

        if "activity_id" in changed_fields:
            activity_id = updates["activity_id"]
            if activity_id is None:
                pass
            else:
                activity = self.activities.get(int(activity_id))
                if "activity_name" not in changed_fields:
                    updates["activity_name"] = activity.name
                if "activity_type" not in changed_fields:
                    updates["activity_type"] = activity.activity_type
                    updates["type_source"] = activity.type_source
        if "task_id" in changed_fields:
            task_id = updates["task_id"]
            updates["task_title"] = (
                None if task_id is None else self.tasks.get(int(task_id)).title
            )
        if "activity_type" in changed_fields:
            updates["type_source"] = "user_corrected"
        return updates

    def _validate_links(self, values: dict[str, object]) -> None:
        project_id = values.get("project_id")
        activity_id = values.get("activity_id")
        task_id = values.get("task_id")
        try:
            if project_id is not None:
                self.projects.get(int(project_id))
            activity = (
                None if activity_id is None else self.activities.get(int(activity_id))
            )
            task = None if task_id is None else self.tasks.get(int(task_id), include_archived=True)
        except LookupError as exc:
            raise TimeLogReferenceConflict from exc
        if task is not None:
            if project_id != task.project_id:
                raise TimeLogReferenceConflict
            if activity is not None and activity.project_id not in {None, task.project_id}:
                raise TimeLogReferenceConflict
        elif activity is not None and activity.project_id is not None:
            if project_id != activity.project_id:
                raise TimeLogReferenceConflict

    def _finish_mutation(
        self,
        *,
        operation: str,
        idempotency_key: str,
        before: TimeLogRead,
        after: TimeLogRead,
        action: str,
        reason: str = "",
    ) -> TimeLogMutationResult:
        revision_id = self.logs.append_revision(
            time_log_id=after.id,
            action=action,
            before=before,
            after=after,
            reason=reason,
        )
        for project_id in {before.project_id, after.project_id}:
            self.logs.recalculate_project_last_activity(project_id)
        weeks = self.logs.invalidate_reviews_for_dates(
            {before.date.isoformat(), after.date.isoformat()}
        )
        result = TimeLogMutationResult(
            time_log=after,
            revision_id=revision_id,
            affected_review_weeks=[
                ReviewWeekRange.model_validate(item) for item in weeks
            ],
        )
        receipt = self.receipts.get(_normalize_key(idempotency_key))
        if receipt is None:
            raise RuntimeError("TimeLog mutation receipt was not started")
        self.receipts.complete(
            receipt.id,
            response_status=200,
            response_json=result.model_dump_json(),
        )
        return result

    def _begin_or_replay(
        self,
        operation: str,
        payload: dict[str, object],
        idempotency_key: str,
    ) -> TimeLogMutationResult | None:
        key = _normalize_key(idempotency_key)
        request_hash = _request_hash(operation, payload)
        receipt = self.receipts.get(key)
        if receipt is not None:
            if receipt.operation != operation or receipt.request_hash != request_hash:
                raise IdempotencyConflict
            if receipt.status == "completed" and receipt.response_json is not None:
                return TimeLogMutationResult.model_validate_json(receipt.response_json)
            raise IdempotencyInProgress
        self.receipts.begin(
            idempotency_key=key,
            operation=operation,
            request_hash=request_hash,
            created_at=_utc_now(),
        )
        return None

    def _get(self, time_log_id: int, *, include_deleted: bool) -> TimeLogRead:
        try:
            return self.logs.get(time_log_id, include_deleted=include_deleted)
        except LookupError as exc:
            raise TimeLogNotFound from exc

    @staticmethod
    def _require_version(current: TimeLogRead, expected_version: int) -> None:
        if current.version != expected_version:
            raise TimeLogVersionConflict(current)

    @staticmethod
    def _snapshot_updates(time_log: TimeLogRead) -> dict[str, object]:
        values = time_log.model_dump(mode="json")
        return {
            field: values[field]
            for field in (
                "activity_id",
                "project_id",
                "task_id",
                "date",
                "start_time",
                "end_time",
                "duration_minutes",
                "duration_seconds",
                "activity_name",
                "activity_type",
                "type_source",
                "task_title",
                "note",
                "deleted_at",
            )
        }

    @contextmanager
    def _savepoint(self, name: str) -> Iterator[None]:
        self.connection.execute(f"SAVEPOINT {name}")
        try:
            yield
        except Exception:
            self.connection.execute(f"ROLLBACK TO SAVEPOINT {name}")
            self.connection.execute(f"RELEASE SAVEPOINT {name}")
            raise
        self.connection.execute(f"RELEASE SAVEPOINT {name}")


def _normalize_key(value: str) -> str:
    normalized = value.strip()
    if not normalized or len(normalized) > 200:
        raise ValueError("Idempotency-Key must contain 1-200 visible characters")
    return normalized


def _request_hash(operation: str, payload: dict[str, object]) -> str:
    normalized = json.dumps(
        {"operation": operation, "payload": payload},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace(
        "+00:00", "Z"
    )
