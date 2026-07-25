from __future__ import annotations

import sqlite3
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from ..db.repositories import TimeLogRepository
from ..schemas import (
    AccountRead,
    TimeLogBatchCreate,
    TimeLogCreate,
    TimeLogMutationResult,
    TimeLogRead,
    TimeLogUndoRequest,
    TimeLogUpdate,
)
from ..services import (
    IdempotencyConflict,
    IdempotencyInProgress,
    InvalidTimeLogState,
    TimeLogNotFound,
    TimeLogReferenceConflict,
    TimeLogRevisionNotFound,
    TimeLogService,
    TimeLogVersionConflict,
)
from .dependencies import get_connection, get_current_user


router = APIRouter(prefix="/time-logs", tags=["time-logs"])
IdempotencyKey = Annotated[
    str,
    Header(
        alias="Idempotency-Key",
        min_length=1,
        max_length=200,
        pattern=r".*\S.*",
    ),
]


@router.post("", response_model=TimeLogRead, status_code=status.HTTP_201_CREATED)
async def create_time_log(
    time_log: TimeLogCreate,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> TimeLogRead:
    try:
        return TimeLogRepository(connection, user.id).create(time_log)
    except sqlite3.IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The time log could not be persisted",
        ) from exc


@router.post(
    "/batch",
    response_model=list[TimeLogRead],
    status_code=status.HTTP_201_CREATED,
)
async def create_time_log_batch(
    payload: TimeLogBatchCreate,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> list[TimeLogRead]:
    try:
        repository = TimeLogRepository(connection, user.id)
        return [repository.create(time_log) for time_log in payload.time_logs]
    except sqlite3.IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The time-log batch could not be persisted",
        ) from exc


@router.get("", response_model=list[TimeLogRead])
async def list_time_logs(
    date_from: date | None = None,
    date_to: date | None = None,
    project_id: int | None = None,
    task_id: int | None = None,
    activity_id: int | None = None,
    include_deleted: bool = False,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> list[TimeLogRead]:
    return TimeLogRepository(connection, user.id).list(
        date_from=None if date_from is None else date_from.isoformat(),
        date_to=None if date_to is None else date_to.isoformat(),
        project_id=project_id,
        task_id=task_id,
        activity_id=activity_id,
        include_deleted=include_deleted,
    )


@router.get("/{time_log_id}", response_model=TimeLogRead)
async def get_time_log(
    time_log_id: int,
    include_deleted: bool = False,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> TimeLogRead:
    try:
        return TimeLogRepository(connection, user.id).get(
            time_log_id,
            include_deleted=include_deleted,
        )
    except LookupError as exc:
        raise _not_found(time_log_id) from exc


@router.patch("/{time_log_id}", response_model=TimeLogMutationResult)
async def update_time_log(
    time_log_id: int,
    request: TimeLogUpdate,
    idempotency_key: IdempotencyKey,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> TimeLogMutationResult:
    try:
        return TimeLogService(connection, user.id).update(
            time_log_id,
            request,
            idempotency_key=idempotency_key,
        )
    except Exception as exc:
        raise _map_mutation_error(exc, time_log_id) from exc


@router.delete("/{time_log_id}", response_model=TimeLogMutationResult)
async def delete_time_log(
    time_log_id: int,
    expected_version: Annotated[int, Query(ge=1)],
    idempotency_key: IdempotencyKey,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> TimeLogMutationResult:
    try:
        return TimeLogService(connection, user.id).delete(
            time_log_id,
            expected_version=expected_version,
            idempotency_key=idempotency_key,
        )
    except Exception as exc:
        raise _map_mutation_error(exc, time_log_id) from exc


@router.post(
    "/{time_log_id}/revisions/{revision_id}/undo",
    response_model=TimeLogMutationResult,
)
async def undo_time_log_mutation(
    time_log_id: int,
    revision_id: int,
    request: TimeLogUndoRequest,
    idempotency_key: IdempotencyKey,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> TimeLogMutationResult:
    try:
        return TimeLogService(connection, user.id).undo(
            time_log_id,
            revision_id,
            request,
            idempotency_key=idempotency_key,
        )
    except Exception as exc:
        raise _map_mutation_error(exc, time_log_id) from exc


def _map_mutation_error(error: Exception, time_log_id: int) -> HTTPException:
    if isinstance(error, (TimeLogNotFound, TimeLogRevisionNotFound)):
        return _not_found(time_log_id)
    if isinstance(error, TimeLogVersionConflict):
        return _conflict(
            "version_conflict",
            "The TimeLog changed after it was loaded",
            current=error.current.model_dump(mode="json"),
        )
    if isinstance(error, InvalidTimeLogState):
        return _conflict(
            "invalid_state",
            "This TimeLog cannot be changed in its current state",
            current=error.current.model_dump(mode="json"),
        )
    if isinstance(error, TimeLogReferenceConflict):
        return _conflict(
            "time_log_reference_conflict",
            "The TimeLog links must belong to this account",
        )
    if isinstance(error, IdempotencyInProgress):
        return _conflict(
            "idempotency_in_progress",
            "A matching command is still in progress",
        )
    if isinstance(error, IdempotencyConflict):
        return _conflict(
            "idempotency_conflict",
            "This Idempotency-Key was already used for another command",
        )
    if isinstance(error, ValueError):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "invalid_time_log", "message": str(error)},
        )
    if isinstance(error, sqlite3.IntegrityError):
        return _conflict(
            "time_log_conflict",
            "The TimeLog mutation could not be persisted",
        )
    raise error


def _not_found(time_log_id: int) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={
            "code": "time_log_not_found",
            "message": f"TimeLog {time_log_id} was not found",
        },
    )


def _conflict(
    code: str,
    message: str,
    *,
    current: object | None = None,
) -> HTTPException:
    detail: dict[str, object] = {"code": code, "message": message}
    if current is not None:
        detail["current"] = current
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)
