from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, HTTPException, status

from ..db.repositories import UserRepository
from ..schemas import LocalUserCreate, LocalUserRead
from .dependencies import get_connection


router = APIRouter(prefix="/users", tags=["local-users"])


@router.post("", response_model=LocalUserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    user: LocalUserCreate,
    connection: sqlite3.Connection = Depends(get_connection),
) -> LocalUserRead:
    try:
        return UserRepository(connection).create(user)
    except sqlite3.IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The local user could not be persisted",
        ) from exc


@router.get("", response_model=list[LocalUserRead])
async def list_users(
    connection: sqlite3.Connection = Depends(get_connection),
) -> list[LocalUserRead]:
    return UserRepository(connection).list()


@router.get("/{user_id}", response_model=LocalUserRead)
async def get_user(
    user_id: int,
    connection: sqlite3.Connection = Depends(get_connection),
) -> LocalUserRead:
    try:
        return UserRepository(connection).get(user_id)
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Local user {user_id} was not found",
        ) from exc
