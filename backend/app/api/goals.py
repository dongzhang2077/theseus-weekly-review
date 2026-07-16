from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, HTTPException, status

from ..db.repositories import GoalRepository
from ..schemas import GoalCreate, GoalRead, LocalUserRead
from .dependencies import get_connection, get_local_user


router = APIRouter(prefix="/goals", tags=["goals"])


@router.post("", response_model=GoalRead, status_code=status.HTTP_201_CREATED)
async def create_goal(
    goal: GoalCreate,
    user: LocalUserRead = Depends(get_local_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> GoalRead:
    try:
        return GoalRepository(connection, user.id).create(goal)
    except sqlite3.IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The goal could not be persisted",
        ) from exc


@router.get("", response_model=list[GoalRead])
async def list_goals(
    user: LocalUserRead = Depends(get_local_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> list[GoalRead]:
    return GoalRepository(connection, user.id).list()
