from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import sqlite3
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from ..db.repositories import AuthRepository
from ..db.repositories.integrations import IntegrationRepository
from ..schemas import (
    AssistantContextRead,
    IntegrationCredentialRead,
    IntegrationPairCreate,
    IntegrationPairRead,
    IntegrationScope,
)
from .assistant import AssistantContextService


class IntegrationAccessDenied(Exception):
    pass


class IntegrationScopeDenied(Exception):
    pass


class IntegrationBindingConflict(Exception):
    pass


class IntegrationReplayConflict(Exception):
    pass


class IntegrationCredentialNotFound(Exception):
    pass


@dataclass(frozen=True)
class IntegrationAccessContext:
    credential_id: int
    user_id: int
    scopes: tuple[str, ...]


class IntegrationService:
    def __init__(
        self,
        connection: sqlite3.Connection,
        secret_key: str,
        *,
        user_id: int | None = None,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self.connection = connection
        self.secret_key = secret_key.encode("utf-8")
        self.user_id = user_id
        self.repository = IntegrationRepository(connection)
        self._clock = clock or (lambda: datetime.now(timezone.utc))

    def pair(self, request: IntegrationPairCreate) -> IntegrationPairRead:
        user_id = self._require_user()
        now = self._now()
        token = f"ths_int_{secrets.token_urlsafe(32)}"
        try:
            credential = self.repository.create_pair(
                user_id,
                request,
                token_prefix=token[:16],
                token_hash=_sha256(token),
                identity_hash=self._protected_hash(
                    "identity", request.channel_type, request.external_identity
                ),
                expires_at=now + timedelta(seconds=request.expires_in_seconds),
                created_at=now,
            )
        except sqlite3.IntegrityError as exc:
            raise IntegrationBindingConflict from exc
        return IntegrationPairRead(credential=credential, access_token=token)

    def list(self) -> list[IntegrationCredentialRead]:
        return self.repository.list(self._require_user())

    def revoke(self, credential_id: int) -> None:
        if not self.repository.revoke(
            self._require_user(), credential_id, self._now()
        ):
            raise IntegrationCredentialNotFound

    def authenticate(
        self,
        *,
        token: str,
        channel_type: str,
        external_identity: str,
        required_scope: IntegrationScope,
    ) -> IntegrationAccessContext:
        stored = self.repository.find_auth(_sha256(token))
        now = self._now()
        if stored is None or stored.revoked_at is not None:
            raise IntegrationAccessDenied
        if _parse_datetime(stored.expires_at) <= now:
            raise IntegrationAccessDenied
        expected_identity = self._protected_hash(
            "identity", channel_type, external_identity
        )
        if stored.channel_type != channel_type or not hmac.compare_digest(
            stored.external_identity_hash, expected_identity
        ):
            raise IntegrationAccessDenied
        if required_scope not in stored.scopes:
            raise IntegrationScopeDenied
        return IntegrationAccessContext(
            credential_id=stored.credential_id,
            user_id=stored.user_id,
            scopes=stored.scopes,
        )

    def read_context(
        self,
        *,
        token: str,
        channel_type: str,
        external_identity: str,
        external_message_id: str,
        week_start: date,
        week_end: date,
    ) -> AssistantContextRead:
        access = self.authenticate(
            token=token,
            channel_type=channel_type,
            external_identity=external_identity,
            required_scope="context:read",
        )
        message_hash = self._protected_hash(
            "message", str(access.credential_id), external_message_id
        )
        request_hash = _sha256(
            json.dumps(
                {
                    "operation": "context.read",
                    "week_start": week_start.isoformat(),
                    "week_end": week_end.isoformat(),
                },
                sort_keys=True,
                separators=(",", ":"),
            )
        )
        receipt = self.repository.get_receipt(access.credential_id, message_hash)
        if receipt is not None:
            if not hmac.compare_digest(receipt.request_hash, request_hash):
                raise IntegrationReplayConflict

        identity = AuthRepository(self.connection).get_by_user_id(access.user_id)
        if identity is None:
            raise IntegrationAccessDenied
        response = AssistantContextService(
            self.connection, identity.account
        ).read(week_start=week_start, week_end=week_end)
        now = self._now()
        if receipt is None:
            try:
                self.repository.save_receipt(
                    user_id=access.user_id,
                    credential_id=access.credential_id,
                    message_id_hash=message_hash,
                    operation="context.read",
                    request_hash=request_hash,
                    created_at=now,
                )
            except sqlite3.IntegrityError as exc:
                concurrent = self.repository.get_receipt(
                    access.credential_id, message_hash
                )
                if concurrent is None or not hmac.compare_digest(
                    concurrent.request_hash, request_hash
                ):
                    raise IntegrationReplayConflict from exc
        self.repository.touch(access.credential_id, now)
        return response

    def _protected_hash(self, namespace: str, *values: str) -> str:
        normalized = "\0".join(
            [namespace, *(value.strip().casefold() for value in values)]
        )
        return hmac.new(
            self.secret_key, normalized.encode("utf-8"), hashlib.sha256
        ).hexdigest()

    def _require_user(self) -> int:
        if self.user_id is None:
            raise RuntimeError("This integration operation requires a user")
        return self.user_id

    def _now(self) -> datetime:
        value = self._clock()
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _parse_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
