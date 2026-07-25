from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Sequence

from ...schemas import ActivityType, ActivityTypeSource, FocusSessionStatus


@dataclass(frozen=True)
class StoredFocusSession:
    id: int
    user_id: int
    activity_id: int
    task_id: int | None
    project_id: int | None
    activity_name: str
    activity_type: ActivityType
    type_source: ActivityTypeSource
    task_title: str | None
    timezone: str
    status: FocusSessionStatus
    accumulated_seconds: int
    version: int
    started_at: str
    completed_at: str | None
    cancelled_at: str | None
    created_at: str
    updated_at: str
    current_run_started_at: str | None


@dataclass(frozen=True)
class StoredIdempotencyReceipt:
    id: int
    user_id: int
    idempotency_key: str
    operation: str
    request_hash: str
    status: str
    response_status: int | None
    response_json: str | None
    created_at: str
    expires_at: str | None


class FocusSessionRepository:
    def __init__(self, connection: sqlite3.Connection, user_id: int) -> None:
        self.connection = connection
        self.user_id = user_id

    def create(
        self,
        *,
        activity_id: int,
        task_id: int | None,
        project_id: int | None,
        activity_name: str,
        activity_type: ActivityType,
        type_source: ActivityTypeSource,
        task_title: str | None,
        timezone_name: str,
        started_at: str,
    ) -> StoredFocusSession:
        values = {
            "user_id": self.user_id,
            "activity_id": activity_id,
            "task_id": task_id,
            "project_id": project_id,
            "activity_name": activity_name,
            "activity_type": activity_type,
            "type_source": type_source,
            "task_title": task_title,
            "timezone": timezone_name,
            "started_at": started_at,
        }
        cursor = self.connection.execute(
            """
            INSERT INTO focus_sessions (
                user_id, activity_id, task_id, project_id, activity_name,
                activity_type, type_source, task_title, timezone, status,
                accumulated_seconds, version, started_at, created_at, updated_at
            ) VALUES (
                :user_id, :activity_id, :task_id, :project_id, :activity_name,
                :activity_type, :type_source, :task_title, :timezone, 'running',
                0, 1, :started_at, :started_at, :started_at
            )
            """,
            values,
        )
        session_id = int(cursor.lastrowid)
        self.connection.execute(
            """
            INSERT INTO focus_session_segments (
                focus_session_id, started_at, created_at
            ) VALUES (?, ?, ?)
            """,
            (session_id, started_at, started_at),
        )
        return self.get(session_id)

    def get(self, session_id: int) -> StoredFocusSession:
        row = self.connection.execute(
            """
            SELECT
                session.*,
                segment.started_at AS current_run_started_at
            FROM focus_sessions AS session
            LEFT JOIN focus_session_segments AS segment
              ON segment.focus_session_id = session.id
             AND segment.ended_at IS NULL
            WHERE session.id = ? AND session.user_id = ?
            """,
            (session_id, self.user_id),
        ).fetchone()
        if row is None:
            raise LookupError(f"FocusSession {session_id} was not found")
        return _stored_session(row)

    def list(
        self,
        *,
        statuses: Sequence[FocusSessionStatus] | None = None,
    ) -> list[StoredFocusSession]:
        clauses = ["session.user_id = :user_id"]
        values: dict[str, object] = {"user_id": self.user_id}
        if statuses:
            placeholders: list[str] = []
            for index, item in enumerate(statuses):
                key = f"status_{index}"
                placeholders.append(f":{key}")
                values[key] = item
            clauses.append(f"session.status IN ({', '.join(placeholders)})")
        rows = self.connection.execute(
            f"""
            SELECT
                session.*,
                segment.started_at AS current_run_started_at
            FROM focus_sessions AS session
            LEFT JOIN focus_session_segments AS segment
              ON segment.focus_session_id = session.id
             AND segment.ended_at IS NULL
            WHERE {' AND '.join(clauses)}
            ORDER BY
                CASE WHEN session.status = 'running' THEN 0 ELSE 1 END,
                session.started_at,
                session.id
            """,
            values,
        ).fetchall()
        return [_stored_session(row) for row in rows]

    def find_running_for_activity(
        self,
        activity_id: int,
    ) -> StoredFocusSession | None:
        row = self.connection.execute(
            """
            SELECT id
            FROM focus_sessions
            WHERE user_id = ? AND activity_id = ? AND status = 'running'
            """,
            (self.user_id, activity_id),
        ).fetchone()
        return None if row is None else self.get(int(row["id"]))

    def close_open_segment(self, session_id: int, ended_at: str) -> None:
        cursor = self.connection.execute(
            """
            UPDATE focus_session_segments
            SET ended_at = ?
            WHERE focus_session_id = ? AND ended_at IS NULL
            """,
            (ended_at, session_id),
        )
        if cursor.rowcount != 1:
            raise RuntimeError("A running FocusSession must have one open segment")

    def complete_if_version(
        self,
        session_id: int,
        expected_version: int,
        *,
        accumulated_seconds: int,
        completed_at: str,
    ) -> StoredFocusSession | None:
        cursor = self.connection.execute(
            """
            UPDATE focus_sessions
            SET status = 'completed',
                accumulated_seconds = :accumulated_seconds,
                completed_at = :completed_at,
                version = version + 1,
                updated_at = :completed_at
            WHERE id = :id
              AND user_id = :user_id
              AND status = 'running'
              AND version = :expected_version
            """,
            {
                "id": session_id,
                "user_id": self.user_id,
                "expected_version": expected_version,
                "accumulated_seconds": accumulated_seconds,
                "completed_at": completed_at,
            },
        )
        return None if cursor.rowcount != 1 else self.get(session_id)

    def cancel_if_version(
        self,
        session_id: int,
        expected_version: int,
        *,
        cancelled_at: str,
    ) -> StoredFocusSession | None:
        cursor = self.connection.execute(
            """
            UPDATE focus_sessions
            SET status = 'cancelled',
                cancelled_at = :cancelled_at,
                version = version + 1,
                updated_at = :cancelled_at
            WHERE id = :id
              AND user_id = :user_id
              AND status = 'running'
              AND version = :expected_version
            """,
            {
                "id": session_id,
                "user_id": self.user_id,
                "expected_version": expected_version,
                "cancelled_at": cancelled_at,
            },
        )
        return None if cursor.rowcount != 1 else self.get(session_id)


class IdempotencyReceiptRepository:
    def __init__(self, connection: sqlite3.Connection, user_id: int) -> None:
        self.connection = connection
        self.user_id = user_id

    def get(self, idempotency_key: str) -> StoredIdempotencyReceipt | None:
        row = self.connection.execute(
            """
            SELECT *
            FROM idempotency_receipts
            WHERE user_id = ? AND idempotency_key = ?
            """,
            (self.user_id, idempotency_key),
        ).fetchone()
        return None if row is None else _stored_receipt(row)

    def begin(
        self,
        *,
        idempotency_key: str,
        operation: str,
        request_hash: str,
        created_at: str,
    ) -> StoredIdempotencyReceipt:
        cursor = self.connection.execute(
            """
            INSERT INTO idempotency_receipts (
                user_id, idempotency_key, operation, request_hash, status,
                created_at
            ) VALUES (?, ?, ?, ?, 'in_progress', ?)
            """,
            (
                self.user_id,
                idempotency_key,
                operation,
                request_hash,
                created_at,
            ),
        )
        row = self.connection.execute(
            "SELECT * FROM idempotency_receipts WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
        if row is None:
            raise RuntimeError("The idempotency receipt could not be read")
        return _stored_receipt(row)

    def complete(
        self,
        receipt_id: int,
        *,
        response_status: int,
        response_json: str,
    ) -> None:
        cursor = self.connection.execute(
            """
            UPDATE idempotency_receipts
            SET status = 'completed',
                response_status = ?,
                response_json = ?
            WHERE id = ? AND user_id = ? AND status = 'in_progress'
            """,
            (response_status, response_json, receipt_id, self.user_id),
        )
        if cursor.rowcount != 1:
            raise RuntimeError("The idempotency receipt could not be completed")


def _stored_session(row: sqlite3.Row) -> StoredFocusSession:
    values = dict(row)
    return StoredFocusSession(**values)


def _stored_receipt(row: sqlite3.Row) -> StoredIdempotencyReceipt:
    return StoredIdempotencyReceipt(**dict(row))
