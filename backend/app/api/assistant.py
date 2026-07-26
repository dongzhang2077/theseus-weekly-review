from __future__ import annotations

import sqlite3
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status

from ..schemas import (
    AccountRead,
    AssistantContextRead,
    AssistantWeeklyPlanProposalRequest,
    ProposalRead,
)
from ..services import (
    AssistantContextService,
    AssistantProposalSourceNotFound,
    AssistantProposalSourceStale,
    AssistantProposalUnavailable,
    AssistantWeeklyPlanProposalService,
    IdempotencyConflict,
    IdempotencyInProgress,
    InvalidAssistantContextWindow,
)
from .dependencies import get_connection, get_current_user


router = APIRouter(prefix="/assistant", tags=["assistant"])
IdempotencyKey = Annotated[
    str,
    Header(
        alias="Idempotency-Key",
        min_length=1,
        max_length=200,
        pattern=r".*\S.*",
    ),
]


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


@router.post(
    "/proposals/weekly-adjustment",
    response_model=ProposalRead,
    status_code=status.HTTP_201_CREATED,
)
async def draft_weekly_plan_proposal(
    request: AssistantWeeklyPlanProposalRequest,
    idempotency_key: IdempotencyKey,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> ProposalRead:
    try:
        return AssistantWeeklyPlanProposalService(connection, user.id).draft(
            request,
            idempotency_key=idempotency_key,
        )
    except AssistantProposalSourceNotFound as exc:
        source = str(exc)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": f"{source}_not_found",
                "message": f"The requested {source.replace('_', ' ')} was not found",
            },
        ) from exc
    except AssistantProposalSourceStale as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "weekly_review_stale",
                "message": "Regenerate the weekly review before drafting a proposal",
            },
        ) from exc
    except AssistantProposalUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "weekly_adjustment_unavailable",
                "message": "The review contains no supported plan adjustment",
            },
        ) from exc
    except IdempotencyConflict as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "idempotency_conflict",
                "message": "Idempotency-Key was already used for another request",
            },
        ) from exc
    except IdempotencyInProgress as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "idempotency_in_progress",
                "message": "A request with this Idempotency-Key is still in progress",
            },
        ) from exc
