from __future__ import annotations

import hashlib
import json
import math
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import Callable, Iterator, Sequence, TypeVar
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel

from ..db.repositories import (
    ActivityRepository,
    FocusSessionRepository,
    FocusTimeLogInsert,
    IdempotencyReceiptRepository,
    StoredFocusSession,
    TaskRepository,
    TimeLogRepository,
    UserRepository,
)
from ..schemas import (
    FocusSessionCommand,
    FocusSessionCommandResponse,
    FocusSessionCreate,
    FocusSessionRead,
    FocusSessionStatus,
)


class FocusSessionNotFound(Exception):
    pass


class FocusReferenceConflict(Exception):
    pass


class InvalidAccountTimezone(Exception):
    pass


class TaskNotRunnable(Exception):
    pass


class ActivityAlreadyRunning(Exception):
    def __init__(self, session_id: int) -> None:
        super().__init__("The Activity already has a running FocusSession")
        self.session_id = session_id


class FocusVersionConflict(Exception):
    def __init__(self, current: FocusSessionRead) -> None:
        super().__init__("The FocusSession changed after it was loaded")
        self.current = current


class InvalidFocusTransition(Exception):
    def __init__(self, current: FocusSessionRead) -> None:
        super().__init__(f"FocusSession is already {current.status}")
        self.current = current


class IdempotencyConflict(Exception):
    pass


class IdempotencyInProgress(Exception):
    pass


ModelT = TypeVar("ModelT", bound=BaseModel)
UtcNow = Callable[[], datetime]


@dataclass(frozen=True)
class _RawDateSlice:
    date: date
    seconds: float
    start_time: str
    end_time: str


@dataclass(frozen=True)
class _AllocatedDateSlice:
    date: str
    seconds: int
    minutes: int
    start_time: str
    end_time: str


class FocusService:
    def __init__(
        self,
        connection: sqlite3.Connection,
        user_id: int,
        *,
        now_provider: UtcNow | None = None,
    ) -> None:
        self.connection = connection
        self.user_id = user_id
        self.now_provider = now_provider or (lambda: datetime.now(timezone.utc))
        self.sessions = FocusSessionRepository(connection, user_id)
        self.receipts = IdempotencyReceiptRepository(connection, user_id)
        self.activities = ActivityRepository(connection, user_id)
        self.tasks = TaskRepository(connection, user_id)
        self.time_logs = TimeLogRepository(connection, user_id)

    def start(
        self,
        request: FocusSessionCreate,
        *,
        idempotency_key: str,
    ) -> FocusSessionRead:
        key = _normalize_idempotency_key(idempotency_key)
        operation = "focus.start"
        request_hash = _request_hash(
            operation,
            request.model_dump(mode="json"),
        )
        with self._savepoint("focus_start"):
            replay = self._replay(
                key,
                operation,
                request_hash,
                FocusSessionRead,
            )
            if replay is not None:
                return replay

            now = self._now()
            receipt = self.receipts.begin(
                idempotency_key=key,
                operation=operation,
                request_hash=request_hash,
                created_at=_format_utc(now),
            )
            try:
                account = UserRepository(self.connection).get(self.user_id)
                ZoneInfo(account.timezone)
            except (LookupError, ZoneInfoNotFoundError, ValueError) as exc:
                raise InvalidAccountTimezone from exc

            try:
                activity = self.activities.get(request.activity_id)
            except LookupError as exc:
                raise FocusReferenceConflict from exc

            running = self.sessions.find_running_for_activity(activity.id)
            if running is not None:
                raise ActivityAlreadyRunning(running.id)

            task = None
            project_id = activity.project_id
            if request.task_id is not None:
                try:
                    task = self.tasks.get(request.task_id, include_archived=True)
                except LookupError as exc:
                    raise FocusReferenceConflict from exc
                if task.archived_at is not None or task.status in {"completed", "cancelled"}:
                    raise TaskNotRunnable
                if activity.project_id is not None and activity.project_id != task.project_id:
                    raise FocusReferenceConflict
                project_id = task.project_id
                if task.status == "open":
                    transitioned = self.tasks.update_if_version(
                        task.id,
                        task.version,
                        {
                            "status": "in_progress",
                            "completed_at": None,
                        },
                    )
                    if transitioned is None:
                        raise RuntimeError("The Task changed while Focus was starting")
                    task = transitioned

            try:
                stored = self.sessions.create(
                    activity_id=activity.id,
                    task_id=task.id if task else None,
                    project_id=project_id,
                    activity_name=activity.name,
                    activity_type=activity.activity_type,
                    type_source=activity.type_source,
                    task_title=task.title if task else None,
                    timezone_name=account.timezone,
                    started_at=_format_utc(now),
                )
            except sqlite3.IntegrityError as exc:
                running = self.sessions.find_running_for_activity(activity.id)
                if running is not None:
                    raise ActivityAlreadyRunning(running.id) from exc
                raise

            response = self._read(stored, now)
            self.receipts.complete(
                receipt.id,
                response_status=201,
                response_json=response.model_dump_json(),
            )
            return response

    def get(self, session_id: int) -> FocusSessionRead:
        try:
            stored = self.sessions.get(session_id)
        except LookupError as exc:
            raise FocusSessionNotFound from exc
        return self._read(stored, self._now())

    def list(
        self,
        *,
        statuses: Sequence[FocusSessionStatus] | None = None,
    ) -> list[FocusSessionRead]:
        now = self._now()
        return [
            self._read(session, now)
            for session in self.sessions.list(statuses=statuses)
        ]

    def command(
        self,
        session_id: int,
        request: FocusSessionCommand,
        *,
        idempotency_key: str,
    ) -> FocusSessionCommandResponse:
        key = _normalize_idempotency_key(idempotency_key)
        operation = f"focus.{request.command}"
        request_hash = _request_hash(
            operation,
            {
                "session_id": session_id,
                **request.model_dump(mode="json"),
            },
        )
        with self._savepoint("focus_command"):
            replay = self._replay(
                key,
                operation,
                request_hash,
                FocusSessionCommandResponse,
            )
            if replay is not None:
                return replay

            now = self._now()
            receipt = self.receipts.begin(
                idempotency_key=key,
                operation=operation,
                request_hash=request_hash,
                created_at=_format_utc(now),
            )
            try:
                stored = self.sessions.get(session_id)
            except LookupError as exc:
                raise FocusSessionNotFound from exc

            current = self._read(stored, now)
            if request.expected_version != current.version:
                raise FocusVersionConflict(current)
            if current.status != "running":
                raise InvalidFocusTransition(current)

            ended_at = _format_utc(now)
            if request.command == "cancel":
                self.sessions.close_open_segment(session_id, ended_at)
                cancelled = self.sessions.cancel_if_version(
                    session_id,
                    request.expected_version,
                    cancelled_at=ended_at,
                )
                if cancelled is None:
                    raise FocusVersionConflict(self.get(session_id))
                response = FocusSessionCommandResponse(
                    session=self._read(cancelled, now),
                    time_logs=[],
                )
            else:
                response = self._end(
                    stored,
                    expected_version=request.expected_version,
                    now=now,
                )

            self.receipts.complete(
                receipt.id,
                response_status=200,
                response_json=response.model_dump_json(),
            )
            return response

    def _end(
        self,
        stored: StoredFocusSession,
        *,
        expected_version: int,
        now: datetime,
    ) -> FocusSessionCommandResponse:
        if stored.current_run_started_at is None:
            raise RuntimeError("A running FocusSession has no open segment")
        started_at = _parse_utc(stored.current_run_started_at)
        slices = _allocate_date_slices(started_at, now, stored.timezone)
        total_seconds = sum(item.seconds for item in slices)
        ended_at = _format_utc(now)
        self.sessions.close_open_segment(stored.id, ended_at)
        logs = [
            self.time_logs.create_from_focus(
                FocusTimeLogInsert(
                    focus_session_id=stored.id,
                    activity_id=stored.activity_id,
                    project_id=stored.project_id,
                    task_id=stored.task_id,
                    date=item.date,
                    start_time=item.start_time,
                    end_time=item.end_time,
                    duration_minutes=item.minutes,
                    duration_seconds=item.seconds,
                    activity_name=stored.activity_name,
                    activity_type=stored.activity_type,
                    type_source=stored.type_source,
                    task_title=stored.task_title,
                )
            )
            for item in slices
        ]
        completed = self.sessions.complete_if_version(
            stored.id,
            expected_version,
            accumulated_seconds=total_seconds,
            completed_at=ended_at,
        )
        if completed is None:
            raise FocusVersionConflict(self.get(stored.id))
        return FocusSessionCommandResponse(
            session=self._read(completed, now),
            time_logs=logs,
        )

    def _read(
        self,
        stored: StoredFocusSession,
        as_of: datetime,
    ) -> FocusSessionRead:
        elapsed_seconds = stored.accumulated_seconds
        if stored.status == "running" and stored.current_run_started_at is not None:
            started_at = _parse_utc(stored.current_run_started_at)
            elapsed_seconds = max(0, math.floor((as_of - started_at).total_seconds()))
        return FocusSessionRead.model_validate(
            {
                **stored.__dict__,
                "elapsed_seconds": elapsed_seconds,
            }
        )

    def _replay(
        self,
        key: str,
        operation: str,
        request_hash: str,
        model: type[ModelT],
    ) -> ModelT | None:
        receipt = self.receipts.get(key)
        if receipt is None:
            return None
        if receipt.operation != operation or receipt.request_hash != request_hash:
            raise IdempotencyConflict
        if receipt.status == "completed" and receipt.response_json is not None:
            return model.model_validate_json(receipt.response_json)
        raise IdempotencyInProgress

    def _now(self) -> datetime:
        value = self.now_provider()
        if value.tzinfo is None:
            raise ValueError("FocusService clock must return a timezone-aware datetime")
        return value.astimezone(timezone.utc)

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


def _normalize_idempotency_key(value: str) -> str:
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


def _format_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(
        timespec="milliseconds"
    ).replace("+00:00", "Z")


def _parse_utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _allocate_date_slices(
    started_at: datetime,
    ended_at: datetime,
    timezone_name: str,
) -> list[_AllocatedDateSlice]:
    try:
        local_zone = ZoneInfo(timezone_name)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise InvalidAccountTimezone from exc
    if ended_at < started_at:
        raise ValueError("FocusSession end cannot precede start")

    raw = _raw_date_slices(started_at, ended_at, local_zone)
    if not raw:
        local = started_at.astimezone(local_zone)
        raw = [
            _RawDateSlice(
                date=local.date(),
                seconds=0,
                start_time=_local_time(local),
                end_time=_local_time(ended_at.astimezone(local_zone)),
            )
        ]

    rounded_total = max(1, math.floor(sum(item.seconds for item in raw) + 0.5))
    seconds = [math.floor(item.seconds) for item in raw]
    remaining_seconds = rounded_total - sum(seconds)
    second_order = sorted(
        range(len(raw)),
        key=lambda index: (
            -(raw[index].seconds - math.floor(raw[index].seconds)),
            raw[index].date,
        ),
    )
    for index in second_order[:remaining_seconds]:
        seconds[index] += 1

    total_minutes = math.floor((rounded_total + 30) / 60)
    minutes = [item // 60 for item in seconds]
    remaining_minutes = total_minutes - sum(minutes)
    minute_order = sorted(
        range(len(raw)),
        key=lambda index: (-(seconds[index] % 60), raw[index].date),
    )
    for index in minute_order[:remaining_minutes]:
        minutes[index] += 1

    return [
        _AllocatedDateSlice(
            date=item.date.isoformat(),
            seconds=seconds[index],
            minutes=minutes[index],
            start_time=item.start_time,
            end_time=item.end_time,
        )
        for index, item in enumerate(raw)
        if seconds[index] > 0
    ]


def _raw_date_slices(
    started_at: datetime,
    ended_at: datetime,
    local_zone: ZoneInfo,
) -> list[_RawDateSlice]:
    result: list[_RawDateSlice] = []
    cursor = started_at.astimezone(timezone.utc)
    final = ended_at.astimezone(timezone.utc)
    while cursor < final:
        local_start = cursor.astimezone(local_zone)
        next_date = local_start.date() + timedelta(days=1)
        next_midnight = datetime.combine(
            next_date,
            time.min,
            tzinfo=local_zone,
        ).astimezone(timezone.utc)
        slice_end = min(final, next_midnight)
        local_end = slice_end.astimezone(local_zone)
        result.append(
            _RawDateSlice(
                date=local_start.date(),
                seconds=(slice_end - cursor).total_seconds(),
                start_time=_local_time(local_start),
                end_time=_local_time(local_end),
            )
        )
        cursor = slice_end
    return result


def _local_time(value: datetime) -> str:
    return value.timetz().replace(tzinfo=None).isoformat(timespec="seconds")
