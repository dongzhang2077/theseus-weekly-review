from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, HTTPException, status

from ..db.repositories import TimeLogRepository
from ..schemas import TimeLogCreate, TimeLogRead
from .dependencies import get_connection


router = APIRouter(prefix="/time-logs", tags=["time-logs"])


@router.post("", response_model=TimeLogRead, status_code=status.HTTP_201_CREATED)
async def create_time_log(
    time_log: TimeLogCreate,
    connection: sqlite3.Connection = Depends(get_connection),
) -> TimeLogRead:
    try:
        return TimeLogRepository(connection).create(time_log)
    except sqlite3.IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The time log could not be persisted",
        ) from exc


@router.get("", response_model=list[TimeLogRead])
async def list_time_logs(
    connection: sqlite3.Connection = Depends(get_connection),
) -> list[TimeLogRead]:
    return TimeLogRepository(connection).list()
