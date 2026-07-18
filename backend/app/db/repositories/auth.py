from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone

from ...schemas import AccountRead, AccountRegister, AccountUpdate


@dataclass(frozen=True)
class StoredAuthIdentity:
    account: AccountRead
    subject: str
    password_hash: str
    failed_attempts: int
    locked_until: datetime | None


@dataclass(frozen=True)
class StoredAuthSession:
    id: str
    user_id: int
    token_hash: str
    csrf_hash: str
    expires_at: datetime
    revoked_at: datetime | None
    replaced_by_id: str | None

    def is_active(self, now: datetime) -> bool:
        return self.revoked_at is None and self.expires_at > now


class AuthRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def create_account(
        self,
        registration: AccountRegister,
        *,
        subject: str,
        password_hash: str,
    ) -> StoredAuthIdentity:
        cursor = self.connection.execute(
            """
            INSERT INTO users (display_name, timezone, locale)
            VALUES (:display_name, :timezone, :locale)
            """,
            registration.model_dump(
                mode="json",
                include={"display_name", "timezone", "locale"},
            ),
        )
        user_id = int(cursor.lastrowid)
        self.connection.execute(
            """
            INSERT INTO auth_credentials (user_id, subject, email, password_hash)
            VALUES (?, ?, ?, ?)
            """,
            (
                user_id,
                subject,
                str(registration.email),
                password_hash,
            ),
        )
        identity = self.get_by_user_id(user_id)
        if identity is None:
            raise RuntimeError("The newly created account could not be read")
        return identity

    def get_by_email(self, email: str) -> StoredAuthIdentity | None:
        return self._identity_from_row(
            self.connection.execute(
                f"{_IDENTITY_SELECT} WHERE credential.email = ? COLLATE NOCASE",
                (email,),
            ).fetchone()
        )

    def get_by_subject(self, subject: str) -> StoredAuthIdentity | None:
        return self._identity_from_row(
            self.connection.execute(
                f"{_IDENTITY_SELECT} WHERE credential.subject = ?",
                (subject,),
            ).fetchone()
        )

    def get_by_user_id(self, user_id: int) -> StoredAuthIdentity | None:
        return self._identity_from_row(
            self.connection.execute(
                f"{_IDENTITY_SELECT} WHERE credential.user_id = ?",
                (user_id,),
            ).fetchone()
        )

    def record_failed_attempt(
        self,
        user_id: int,
        *,
        failed_attempts: int,
        locked_until: datetime | None,
    ) -> None:
        self.connection.execute(
            """
            UPDATE auth_credentials
            SET failed_attempts = ?, locked_until = ?, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
            """,
            (
                failed_attempts,
                _serialize_datetime(locked_until) if locked_until else None,
                user_id,
            ),
        )

    def clear_failed_attempts(self, user_id: int) -> None:
        self.connection.execute(
            """
            UPDATE auth_credentials
            SET failed_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
            """,
            (user_id,),
        )

    def update_password(
        self,
        user_id: int,
        *,
        password_hash: str,
    ) -> None:
        self.connection.execute(
            """
            UPDATE auth_credentials
            SET password_hash = ?, failed_attempts = 0,
                locked_until = NULL, password_changed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
            """,
            (password_hash, user_id),
        )

    def update_password_hash(self, user_id: int, password_hash: str) -> None:
        self.connection.execute(
            """
            UPDATE auth_credentials
            SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
            """,
            (password_hash, user_id),
        )

    def update_email(self, user_id: int, email: str) -> AccountRead:
        self.connection.execute(
            """
            UPDATE auth_credentials
            SET email = ?, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
            """,
            (email, user_id),
        )
        self.connection.execute(
            "UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (user_id,),
        )
        return self._require_account(user_id)

    def update_profile(self, user_id: int, update: AccountUpdate) -> AccountRead:
        values = update.model_dump(exclude_unset=True)
        self.connection.execute(
            """
            UPDATE users
            SET display_name = COALESCE(:display_name, display_name),
                timezone = COALESCE(:timezone, timezone),
                locale = COALESCE(:locale, locale),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :user_id
            """,
            {
                "display_name": values.get("display_name"),
                "timezone": values.get("timezone"),
                "locale": values.get("locale"),
                "user_id": user_id,
            },
        )
        return self._require_account(user_id)

    def delete_account(self, user_id: int) -> None:
        cursor = self.connection.execute("DELETE FROM users WHERE id = ?", (user_id,))
        if cursor.rowcount != 1:
            raise LookupError(f"User {user_id} was not found")

    def create_session(
        self,
        *,
        session_id: str,
        user_id: int,
        token_hash: str,
        csrf_hash: str,
        expires_at: datetime,
        user_agent: str,
    ) -> StoredAuthSession:
        self.connection.execute(
            """
            INSERT INTO auth_sessions (
                id, user_id, token_hash, csrf_hash, expires_at, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                session_id,
                user_id,
                token_hash,
                csrf_hash,
                _serialize_datetime(expires_at),
                user_agent[:512],
            ),
        )
        session = self.get_session(session_id)
        if session is None:
            raise RuntimeError("The newly created auth session could not be read")
        return session

    def get_session(self, session_id: str) -> StoredAuthSession | None:
        row = self.connection.execute(
            """
            SELECT id, user_id, token_hash, csrf_hash, expires_at,
                   revoked_at, replaced_by_id
            FROM auth_sessions
            WHERE id = ?
            """,
            (session_id,),
        ).fetchone()
        if row is None:
            return None
        return StoredAuthSession(
            id=row["id"],
            user_id=int(row["user_id"]),
            token_hash=row["token_hash"],
            csrf_hash=row["csrf_hash"],
            expires_at=_parse_datetime(row["expires_at"]),
            revoked_at=(
                _parse_datetime(row["revoked_at"])
                if row["revoked_at"] is not None
                else None
            ),
            replaced_by_id=row["replaced_by_id"],
        )

    def touch_session(self, session_id: str) -> None:
        self.connection.execute(
            "UPDATE auth_sessions SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?",
            (session_id,),
        )

    def revoke_session(
        self,
        session_id: str,
        *,
        replaced_by_id: str | None = None,
    ) -> None:
        self.connection.execute(
            """
            UPDATE auth_sessions
            SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
                replaced_by_id = COALESCE(replaced_by_id, ?)
            WHERE id = ?
            """,
            (replaced_by_id, session_id),
        )

    def revoke_all_sessions(self, user_id: int) -> None:
        self.connection.execute(
            """
            UPDATE auth_sessions
            SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
            WHERE user_id = ?
            """,
            (user_id,),
        )

    def purge_expired_sessions(self, now: datetime) -> None:
        self.connection.execute(
            "DELETE FROM auth_sessions WHERE expires_at <= ?",
            (_serialize_datetime(now),),
        )

    def _require_account(self, user_id: int) -> AccountRead:
        identity = self.get_by_user_id(user_id)
        if identity is None:
            raise LookupError(f"User {user_id} was not found")
        return identity.account

    @staticmethod
    def _identity_from_row(row: sqlite3.Row | None) -> StoredAuthIdentity | None:
        if row is None:
            return None
        return StoredAuthIdentity(
            account=AccountRead.model_validate(
                {
                    "id": row["user_id"],
                    "email": row["email"],
                    "display_name": row["display_name"],
                    "timezone": row["timezone"],
                    "locale": row["locale"],
                    "created_at": row["user_created_at"],
                    "updated_at": row["user_updated_at"],
                }
            ),
            subject=row["subject"],
            password_hash=row["password_hash"],
            failed_attempts=int(row["failed_attempts"]),
            locked_until=(
                _parse_datetime(row["locked_until"])
                if row["locked_until"] is not None
                else None
            ),
        )


_IDENTITY_SELECT = """
    SELECT user.id AS user_id, user.display_name, user.timezone, user.locale,
           user.created_at AS user_created_at,
           user.updated_at AS user_updated_at,
           credential.subject, credential.email, credential.password_hash,
           credential.failed_attempts,
           credential.locked_until
    FROM auth_credentials AS credential
    JOIN users AS user ON user.id = credential.user_id
"""


def _serialize_datetime(value: datetime) -> str:
    normalized = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return normalized.astimezone(timezone.utc).isoformat()


def _parse_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
