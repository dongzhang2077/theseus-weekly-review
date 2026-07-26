from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime

from ...schemas import IntegrationCredentialRead, IntegrationPairCreate


@dataclass(frozen=True)
class StoredIntegrationAuth:
    credential_id: int
    user_id: int
    token_hash: str
    channel_type: str
    external_identity_hash: str
    scopes: tuple[str, ...]
    expires_at: str
    revoked_at: str | None


@dataclass(frozen=True)
class StoredIntegrationReceipt:
    request_hash: str


class IntegrationRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def create_pair(
        self,
        user_id: int,
        request: IntegrationPairCreate,
        *,
        token_prefix: str,
        token_hash: str,
        identity_hash: str,
        expires_at: datetime,
        created_at: datetime,
    ) -> IntegrationCredentialRead:
        cursor = self.connection.execute(
            """
            INSERT INTO integration_credentials (
                user_id, label, token_prefix, token_hash, expires_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                request.label,
                token_prefix,
                token_hash,
                expires_at.isoformat(),
                created_at.isoformat(),
            ),
        )
        credential_id = int(cursor.lastrowid)
        self.connection.executemany(
            """
            INSERT INTO integration_credential_scopes (credential_id, scope)
            VALUES (?, ?)
            """,
            [(credential_id, scope) for scope in request.scopes],
        )
        self.connection.execute(
            """
            INSERT INTO channel_bindings (
                user_id, credential_id, channel_type,
                external_identity_hash, created_at
            ) VALUES (?, ?, ?, ?, ?)
            """,
            (
                user_id,
                credential_id,
                request.channel_type,
                identity_hash,
                created_at.isoformat(),
            ),
        )
        return self.get(user_id, credential_id)

    def get(self, user_id: int, credential_id: int) -> IntegrationCredentialRead:
        row = self.connection.execute(
            """
            SELECT credential.*, binding.channel_type
            FROM integration_credentials AS credential
            JOIN channel_bindings AS binding
              ON binding.credential_id = credential.id
            WHERE credential.id = ? AND credential.user_id = ?
            """,
            (credential_id, user_id),
        ).fetchone()
        if row is None:
            raise LookupError("Integration credential was not found")
        return self._read(row)

    def list(self, user_id: int) -> list[IntegrationCredentialRead]:
        rows = self.connection.execute(
            """
            SELECT credential.*, binding.channel_type
            FROM integration_credentials AS credential
            JOIN channel_bindings AS binding
              ON binding.credential_id = credential.id
            WHERE credential.user_id = ?
            ORDER BY credential.created_at DESC, credential.id DESC
            """,
            (user_id,),
        ).fetchall()
        return [self._read(row) for row in rows]

    def find_auth(self, token_hash: str) -> StoredIntegrationAuth | None:
        row = self.connection.execute(
            """
            SELECT credential.id, credential.user_id, credential.token_hash,
                   credential.expires_at, credential.revoked_at,
                   binding.channel_type, binding.external_identity_hash,
                   binding.revoked_at AS binding_revoked_at
            FROM integration_credentials AS credential
            JOIN channel_bindings AS binding
              ON binding.credential_id = credential.id
            WHERE credential.token_hash = ?
            """,
            (token_hash,),
        ).fetchone()
        if row is None or row["binding_revoked_at"] is not None:
            return None
        scopes = self._scopes(int(row["id"]))
        return StoredIntegrationAuth(
            credential_id=int(row["id"]),
            user_id=int(row["user_id"]),
            token_hash=str(row["token_hash"]),
            channel_type=str(row["channel_type"]),
            external_identity_hash=str(row["external_identity_hash"]),
            scopes=tuple(scopes),
            expires_at=str(row["expires_at"]),
            revoked_at=row["revoked_at"],
        )

    def revoke(self, user_id: int, credential_id: int, revoked_at: datetime) -> bool:
        cursor = self.connection.execute(
            """
            UPDATE integration_credentials
            SET revoked_at = ?
            WHERE id = ? AND user_id = ? AND revoked_at IS NULL
            """,
            (revoked_at.isoformat(), credential_id, user_id),
        )
        if cursor.rowcount:
            self.connection.execute(
                """
                UPDATE channel_bindings SET revoked_at = ?
                WHERE credential_id = ? AND user_id = ? AND revoked_at IS NULL
                """,
                (revoked_at.isoformat(), credential_id, user_id),
            )
        return bool(cursor.rowcount)

    def touch(self, credential_id: int, used_at: datetime) -> None:
        self.connection.execute(
            "UPDATE integration_credentials SET last_used_at = ? WHERE id = ?",
            (used_at.isoformat(), credential_id),
        )

    def get_receipt(
        self, credential_id: int, message_id_hash: str
    ) -> StoredIntegrationReceipt | None:
        row = self.connection.execute(
            """
            SELECT request_hash
            FROM integration_message_receipts
            WHERE credential_id = ? AND external_message_id_hash = ?
            """,
            (credential_id, message_id_hash),
        ).fetchone()
        if row is None:
            return None
        return StoredIntegrationReceipt(
            request_hash=str(row["request_hash"]),
        )

    def save_receipt(
        self,
        *,
        user_id: int,
        credential_id: int,
        message_id_hash: str,
        operation: str,
        request_hash: str,
        created_at: datetime,
    ) -> None:
        self.connection.execute(
            """
            INSERT INTO integration_message_receipts (
                user_id, credential_id, external_message_id_hash,
                operation, request_hash, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                credential_id,
                message_id_hash,
                operation,
                request_hash,
                created_at.isoformat(),
            ),
        )

    def _read(self, row: sqlite3.Row) -> IntegrationCredentialRead:
        return IntegrationCredentialRead(
            id=row["id"],
            user_id=row["user_id"],
            label=row["label"],
            channel_type=row["channel_type"],
            scopes=self._scopes(int(row["id"])),
            token_prefix=row["token_prefix"],
            expires_at=row["expires_at"],
            revoked_at=row["revoked_at"],
            last_used_at=row["last_used_at"],
            created_at=row["created_at"],
        )

    def _scopes(self, credential_id: int) -> list[str]:
        rows = self.connection.execute(
            """
            SELECT scope FROM integration_credential_scopes
            WHERE credential_id = ? ORDER BY scope
            """,
            (credential_id,),
        ).fetchall()
        return [str(row["scope"]) for row in rows]
