from __future__ import annotations

import sqlite3
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..schemas import AccountRead, TaskCreate, TaskRead, TaskStatus, TaskUpdate
from ..services import (
    InvalidTaskTransition,
    TaskNotFound,
    TaskService,
    TaskVersionConflict,
)
from .dependencies import get_connection, get_current_user


router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task(
    task: TaskCreate,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> TaskRead:
    try:
        return TaskService(connection, user.id).create(task)
    except sqlite3.IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "task_project_conflict",
                "message": "The task Project is not available for this account",
            },
        ) from exc


@router.get("", response_model=list[TaskRead])
async def list_tasks(
    project_id: int | None = None,
    task_statuses: Annotated[list[TaskStatus] | None, Query(alias="status")] = None,
    include_archived: bool = False,
    due_from: date | None = None,
    due_to: date | None = None,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> list[TaskRead]:
    return TaskService(connection, user.id).list(
        project_id=project_id,
        statuses=task_statuses,
        include_archived=include_archived,
        due_from=due_from,
        due_to=due_to,
    )


@router.get("/{task_id}", response_model=TaskRead)
async def get_task(
    task_id: int,
    include_archived: bool = False,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> TaskRead:
    try:
        return TaskService(connection, user.id).get(
            task_id,
            include_archived=include_archived,
        )
    except TaskNotFound as exc:
        raise _not_found(task_id) from exc


@router.patch("/{task_id}", response_model=TaskRead)
async def update_task(
    task_id: int,
    patch: TaskUpdate,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> TaskRead:
    try:
        return TaskService(connection, user.id).update(task_id, patch)
    except TaskNotFound as exc:
        raise _not_found(task_id) from exc
    except InvalidTaskTransition as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "invalid_task_transition",
                "message": str(exc),
            },
        ) from exc
    except TaskVersionConflict as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "version_conflict",
                "message": "The task changed after it was loaded",
                "current": exc.current.model_dump(mode="json"),
            },
        ) from exc
    except sqlite3.IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "task_conflict",
                "message": "The task could not be updated",
            },
        ) from exc


def _not_found(task_id: int) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={
            "code": "task_not_found",
            "message": f"Task {task_id} was not found",
        },
    )
