from __future__ import annotations

import sqlite3

from ...schemas import LocalUserCreate, LocalUserRead
from ._common import require_row, validate_row


class UserRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def create(self, user: LocalUserCreate) -> LocalUserRead:
        cursor = self.connection.execute(
            """
            INSERT INTO users (display_name, timezone, locale)
            VALUES (:display_name, :timezone, :locale)
            """,
            user.model_dump(mode="json"),
        )
        return self.get(cursor.lastrowid)

    def get(self, user_id: int) -> LocalUserRead:
        row = self.connection.execute(
            "SELECT * FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        return validate_row(LocalUserRead, require_row(row, "User", user_id))

    def list(self) -> list[LocalUserRead]:
        rows = self.connection.execute(
            "SELECT * FROM users ORDER BY id"
        ).fetchall()
        return [validate_row(LocalUserRead, row) for row in rows]
