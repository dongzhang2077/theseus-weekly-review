from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, HTTPException, status

from ..db.repositories import TimeLogRepository
from ..schemas import LocalUserRead, TimeLogCreate, TimeLogRead
from .dependencies import get_connection, get_local_user


router = APIRouter(prefix="/time-logs", tags=["time-logs"])


@router.post("", response_model=TimeLogRead, status_code=status.HTTP_201_CREATED)
async def create_time_log(
    time_log: TimeLogCreate,
    user: LocalUserRead = Depends(get_local_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> TimeLogRead:
    try:
        return TimeLogRepository(connection, user.id).create(time_log)
    except sqlite3.IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The time log could not be persisted",
        ) from exc


@router.get("", response_model=list[TimeLogRead])
async def list_time_logs(
    user: LocalUserRead = Depends(get_local_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> list[TimeLogRead]:
    return TimeLogRepository(connection, user.id).list()
