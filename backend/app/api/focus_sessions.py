from __future__ import annotations

import sqlite3
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from ..schemas import (
    AccountRead,
    FocusSessionCommand,
    FocusSessionCommandResponse,
    FocusSessionCreate,
    FocusSessionRead,
    FocusSessionStatus,
)
from ..services import (
    ActivityAlreadyRunning,
    FocusReferenceConflict,
    FocusService,
    FocusSessionNotFound,
    FocusVersionConflict,
    IdempotencyConflict,
    IdempotencyInProgress,
    InvalidAccountTimezone,
    InvalidFocusTransition,
    TaskNotRunnable,
)
from .dependencies import get_connection, get_current_user


router = APIRouter(prefix="/focus-sessions", tags=["focus-sessions"])
IdempotencyKey = Annotated[
    str,
    Header(
        alias="Idempotency-Key",
        min_length=1,
        max_length=200,
        pattern=r".*\S.*",
    ),
]


@router.post(
    "",
    response_model=FocusSessionRead,
    status_code=status.HTTP_201_CREATED,
)
async def start_focus_session(
    request: FocusSessionCreate,
    idempotency_key: IdempotencyKey,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> FocusSessionRead:
    try:
        return FocusService(connection, user.id).start(
            request,
            idempotency_key=idempotency_key,
        )
    except ActivityAlreadyRunning as exc:
        raise _conflict(
            "activity_already_open",
            "This Activity already has a running session",
            current={"session_id": exc.session_id},
        ) from exc
    except FocusReferenceConflict as exc:
        raise _conflict(
            "focus_reference_conflict",
            "The Activity, Task, and Project must belong to this account",
        ) from exc
    except TaskNotRunnable as exc:
        raise _conflict(
            "task_not_runnable",
            "Reopen or restore this Task before starting Focus",
        ) from exc
    except InvalidAccountTimezone as exc:
        raise _conflict(
            "invalid_account_timezone",
            "Correct the account timezone before starting Focus",
        ) from exc
    except (IdempotencyConflict, IdempotencyInProgress) as exc:
        raise _idempotency_conflict(exc) from exc
    except sqlite3.IntegrityError as exc:
        raise _conflict(
            "focus_conflict",
            "The FocusSession could not be started",
        ) from exc


@router.get("", response_model=list[FocusSessionRead])
async def list_focus_sessions(
    state_filter: Annotated[
        Literal["open"] | None,
        Query(alias="state"),
    ] = None,
    session_statuses: Annotated[
        list[FocusSessionStatus] | None,
        Query(alias="status"),
    ] = None,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> list[FocusSessionRead]:
    if state_filter == "open":
        if session_statuses and "running" not in session_statuses:
            return []
        session_statuses = ["running"]
    return FocusService(connection, user.id).list(statuses=session_statuses)


@router.get("/{session_id}", response_model=FocusSessionRead)
async def get_focus_session(
    session_id: int,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> FocusSessionRead:
    try:
        return FocusService(connection, user.id).get(session_id)
    except FocusSessionNotFound as exc:
        raise _not_found(session_id) from exc


@router.post(
    "/{session_id}/commands",
    response_model=FocusSessionCommandResponse,
)
async def command_focus_session(
    session_id: int,
    request: FocusSessionCommand,
    idempotency_key: IdempotencyKey,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> FocusSessionCommandResponse:
    try:
        return FocusService(connection, user.id).command(
            session_id,
            request,
            idempotency_key=idempotency_key,
        )
    except FocusSessionNotFound as exc:
        raise _not_found(session_id) from exc
    except FocusVersionConflict as exc:
        raise _conflict(
            "version_conflict",
            "The FocusSession changed after it was loaded",
            current=exc.current.model_dump(mode="json"),
        ) from exc
    except InvalidFocusTransition as exc:
        raise _conflict(
            "invalid_focus_transition",
            f"This FocusSession is already {exc.current.status}",
            current=exc.current.model_dump(mode="json"),
        ) from exc
    except InvalidAccountTimezone as exc:
        raise _conflict(
            "invalid_session_timezone",
            "The captured FocusSession timezone is invalid",
        ) from exc
    except (IdempotencyConflict, IdempotencyInProgress) as exc:
        raise _idempotency_conflict(exc) from exc
    except sqlite3.IntegrityError as exc:
        raise _conflict(
            "focus_conflict",
            "The FocusSession command could not be completed",
        ) from exc


def _not_found(session_id: int) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={
            "code": "focus_session_not_found",
            "message": f"FocusSession {session_id} was not found",
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


def _idempotency_conflict(
    error: IdempotencyConflict | IdempotencyInProgress,
) -> HTTPException:
    if isinstance(error, IdempotencyInProgress):
        return _conflict(
            "idempotency_in_progress",
            "A matching command is still in progress",
        )
    return _conflict(
        "idempotency_conflict",
        "This Idempotency-Key was already used for another command",
    )
