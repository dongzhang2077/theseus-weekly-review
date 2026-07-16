from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Response, status

from ..db.repositories import WeeklyPlanRepository
from ..schemas import LocalUserRead, WeeklyPlanCreate, WeeklyPlanRead
from .dependencies import get_connection, get_local_user


router = APIRouter(prefix="/weekly-plans", tags=["weekly-plans"])


@router.post("", response_model=WeeklyPlanRead, status_code=status.HTTP_201_CREATED)
async def create_weekly_plan(
    plan: WeeklyPlanCreate,
    user: LocalUserRead = Depends(get_local_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> WeeklyPlanRead:
    try:
        return WeeklyPlanRepository(connection, user.id).create(plan)
    except sqlite3.IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The weekly plan could not be persisted",
        ) from exc


@router.get("", response_model=list[WeeklyPlanRead])
async def list_weekly_plans(
    user: LocalUserRead = Depends(get_local_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> list[WeeklyPlanRead]:
    return WeeklyPlanRepository(connection, user.id).list()


@router.put("/{plan_id}", response_model=WeeklyPlanRead)
async def replace_weekly_plan(
    plan_id: int,
    plan: WeeklyPlanCreate,
    user: LocalUserRead = Depends(get_local_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> WeeklyPlanRead:
    try:
        return WeeklyPlanRepository(connection, user.id).replace(plan_id, plan)
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Weekly plan {plan_id} was not found",
        ) from exc
    except sqlite3.IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The weekly plan could not be replaced",
        ) from exc


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_weekly_plan(
    plan_id: int,
    user: LocalUserRead = Depends(get_local_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> Response:
    try:
        WeeklyPlanRepository(connection, user.id).delete(plan_id)
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Weekly plan {plan_id} was not found",
        ) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
