from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, HTTPException, status

from review_engine.rules import analyze_week

from ..schemas import (
    WeeklyReviewGenerateRequest,
    WeeklyReviewRead,
    WeeklyReviewRequest,
    WeeklyReviewResult,
)
from ..services import ReviewService, WeeklyPlanNotFound
from ..services.review_writer import ReviewWriterError
from .dependencies import get_connection


router = APIRouter(prefix="/reviews/weekly", tags=["weekly-reviews"])


@router.post("/analyze", response_model=WeeklyReviewResult)
async def analyze_weekly_review(request: WeeklyReviewRequest) -> WeeklyReviewResult:
    payload = request.model_dump(mode="json")
    return WeeklyReviewResult.model_validate(analyze_week(payload))


@router.post("/generate", response_model=WeeklyReviewRead)
async def generate_weekly_review(
    request: WeeklyReviewGenerateRequest,
    connection: sqlite3.Connection = Depends(get_connection),
) -> WeeklyReviewRead:
    try:
        return ReviewService(connection).generate(request)
    except WeeklyPlanNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except sqlite3.IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The weekly review could not be persisted",
        ) from exc
    except ReviewWriterError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
