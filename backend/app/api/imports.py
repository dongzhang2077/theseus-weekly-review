from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, status

from ..schemas import AccountRead, MobileTimeLogImportRequest, MobileTimeLogImportSummary
from ..services.mobile_import import import_mobile_time_logs
from .dependencies import get_connection, get_current_user


router = APIRouter(prefix="/imports", tags=["imports"])


@router.post(
    "/mobile-time-logs",
    response_model=MobileTimeLogImportSummary,
    status_code=status.HTTP_201_CREATED,
)
async def import_mobile_time_logs_endpoint(
    payload: MobileTimeLogImportRequest,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> MobileTimeLogImportSummary:
    return import_mobile_time_logs(payload, connection, user.id)
