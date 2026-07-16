from __future__ import annotations

import sqlite3

from ..db.repositories import TimeLogRepository
from ..schemas import (
    MobileTimeLogImportRecord,
    MobileTimeLogImportRequest,
    MobileTimeLogImportSummary,
    TimeLogCreate,
)


ACTIVITY_TYPE_ALIASES = {
    "consume": "consuming",
    "consuming": "consuming",
    "destroy": "destroy",
    "neutral": "neutral",
    "restore": "restore",
}


def import_mobile_time_logs(
    payload: MobileTimeLogImportRequest,
    connection: sqlite3.Connection,
    user_id: int,
) -> MobileTimeLogImportSummary:
    repository = TimeLogRepository(connection, user_id)
    imported = 0
    skipped = 0
    needs_mapping = 0
    seen_source_ids: set[str] = set()

    for record in payload.time_logs:
        if record.source_record_id:
            if record.source_record_id in seen_source_ids:
                skipped += 1
                continue
            seen_source_ids.add(record.source_record_id)

        activity_type = _normalize_activity_type(record.activity_type)
        if activity_type is None:
            skipped += 1
            needs_mapping += 1
            continue

        try:
            repository.create(_as_time_log(record, activity_type))
        except sqlite3.IntegrityError:
            skipped += 1
            needs_mapping += 1
            continue

        imported += 1
        if record.project_id is None:
            needs_mapping += 1

    return MobileTimeLogImportSummary(
        imported=imported,
        skipped=skipped,
        needs_mapping=needs_mapping,
    )


def _normalize_activity_type(value: str) -> str | None:
    normalized = value.strip().lower().replace("-", "_").replace(" ", "_")
    return ACTIVITY_TYPE_ALIASES.get(normalized)


def _as_time_log(record: MobileTimeLogImportRecord, activity_type: str) -> TimeLogCreate:
    return TimeLogCreate(
        activity_id=record.activity_id,
        project_id=record.project_id,
        date=record.date,
        start_time=record.start_time,
        end_time=record.end_time,
        duration_minutes=record.duration_minutes,
        activity_name=record.activity_name,
        activity_type=activity_type,
        type_source=record.type_source,
        note=record.note,
    )
