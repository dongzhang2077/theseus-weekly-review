from __future__ import annotations

import sqlite3
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status

from ..schemas import AccountRead, AssistantContextRead
from ..services import AssistantContextService, InvalidAssistantContextWindow
from .dependencies import get_connection, get_current_user


router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.get("/context", response_model=AssistantContextRead)
async def get_assistant_context(
    week_start: date,
    week_end: date,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> AssistantContextRead:
    try:
        return AssistantContextService(connection, user).read(
            week_start=week_start,
            week_end=week_end,
        )
    except InvalidAssistantContextWindow as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "invalid_context_window",
                "message": "Assistant context must cover between 1 and 31 days",
            },
        ) from exc
