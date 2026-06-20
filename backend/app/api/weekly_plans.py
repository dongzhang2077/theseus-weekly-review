from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, HTTPException, status

from ..db.repositories import WeeklyPlanRepository
from ..schemas import WeeklyPlanCreate, WeeklyPlanRead
from .dependencies import get_connection


router = APIRouter(prefix="/weekly-plans", tags=["weekly-plans"])


@router.post("", response_model=WeeklyPlanRead, status_code=status.HTTP_201_CREATED)
async def create_weekly_plan(
    plan: WeeklyPlanCreate,
    connection: sqlite3.Connection = Depends(get_connection),
) -> WeeklyPlanRead:
    try:
        return WeeklyPlanRepository(connection).create(plan)
    except sqlite3.IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The weekly plan could not be persisted",
        ) from exc


@router.get("", response_model=list[WeeklyPlanRead])
async def list_weekly_plans(
    connection: sqlite3.Connection = Depends(get_connection),
) -> list[WeeklyPlanRead]:
    return WeeklyPlanRepository(connection).list()
