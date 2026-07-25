from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, HTTPException, status

from ..schemas import AccountRead, ActivityCreate, ActivityRead, ActivityUpdate
from ..services import (
    ActivityInUse,
    ActivityNotFound,
    ActivityService,
    ActivityVersionConflict,
)
from .dependencies import get_connection, get_current_user


router = APIRouter(prefix="/activities", tags=["activities"])


@router.post("", response_model=ActivityRead, status_code=status.HTTP_201_CREATED)
async def create_activity(
    activity: ActivityCreate,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> ActivityRead:
    try:
        return ActivityService(connection, user.id).create(activity)
    except sqlite3.IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "activity_project_conflict",
                "message": "The activity Project is not available for this account",
            },
        ) from exc


@router.get("", response_model=list[ActivityRead])
async def list_activities(
    project_id: int | None = None,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> list[ActivityRead]:
    return ActivityService(connection, user.id).list(project_id=project_id)


@router.get("/{activity_id}", response_model=ActivityRead)
async def get_activity(
    activity_id: int,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> ActivityRead:
    try:
        return ActivityService(connection, user.id).get(activity_id)
    except ActivityNotFound as exc:
        raise _not_found(activity_id) from exc


@router.patch("/{activity_id}", response_model=ActivityRead)
async def update_activity(
    activity_id: int,
    patch: ActivityUpdate,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> ActivityRead:
    try:
        return ActivityService(connection, user.id).update(activity_id, patch)
    except ActivityNotFound as exc:
        raise _not_found(activity_id) from exc
    except ActivityInUse as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "activity_in_use",
                "message": "End this activity before changing its Project",
            },
        ) from exc
    except ActivityVersionConflict as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "version_conflict",
                "message": "The activity changed after it was loaded",
                "current": exc.current.model_dump(mode="json"),
            },
        ) from exc
    except sqlite3.IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "activity_project_conflict",
                "message": "The activity Project is not available for this account",
            },
        ) from exc


def _not_found(activity_id: int) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={
            "code": "activity_not_found",
            "message": f"Activity {activity_id} was not found",
        },
    )
