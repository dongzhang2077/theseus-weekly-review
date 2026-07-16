from __future__ import annotations

import sqlite3
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, status

from ..db.repositories import UserRepository
from ..schemas import LocalUserRead


LOCAL_USER_HEADER = "X-Theseus-User-Id"


async def get_connection(request: Request) -> AsyncIterator[sqlite3.Connection]:
    with request.app.state.database.session() as connection:
        yield connection


async def get_local_user(
    user_id: Annotated[int, Header(alias=LOCAL_USER_HEADER, ge=1)],
    connection: sqlite3.Connection = Depends(get_connection),
) -> LocalUserRead:
    try:
        return UserRepository(connection).get(user_id)
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Local user {user_id} was not found",
        ) from exc
