from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import sqlite3
from collections.abc import Callable
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Iterator

from ..db.repositories import AuthRepository
from ..db.repositories.integrations import IntegrationRepository, StoredIntegrationReceipt
from ..schemas import (
    AssistantContextRead,
    AssistantWeeklyPlanProposalRequest,
    AssistantProposalExecutionRequest,
    ChannelProposalDecisionRequest,
    ChannelProposalExecutionRequest,
    AssistantWeeklyPlanExecutionRead,
    IntegrationCredentialRead,
    ProposalDecisionCreate,
    ProposalDecisionRead,
    ProposalRead,
    IntegrationPairCreate,
    IntegrationPairRead,
    IntegrationScope,
)
from .agent_memory import ProposalLedgerService
from .assistant import AssistantContextService, AssistantWeeklyPlanExecutionService, AssistantWeeklyPlanProposalService


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
        message_hash = self._message_hash(access.credential_id, external_message_id)
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
        receipt = self._existing_receipt(
            access.credential_id, message_hash, request_hash
        )

        identity = AuthRepository(self.connection).get_by_user_id(access.user_id)
        if identity is None:
            raise IntegrationAccessDenied
        response = AssistantContextService(
            self.connection, identity.account
        ).read(week_start=week_start, week_end=week_end)
        now = self._now()
        if receipt is None:
            self._save_receipt(
                access=access,
                message_hash=message_hash,
                operation="context.read",
                request_hash=request_hash,
                created_at=now,
            )
        self.repository.touch(access.credential_id, now)
        return response

    def draft_weekly_plan_proposal(
        self,
        *,
        token: str,
        channel_type: str,
        external_identity: str,
        external_message_id: str,
        request: AssistantWeeklyPlanProposalRequest,
    ) -> ProposalRead:
        access = self.authenticate(
            token=token,
            channel_type=channel_type,
            external_identity=external_identity,
            required_scope="proposal:create",
        )
        operation = "proposal.create.weekly_plan_adjustment"
        message_hash = self._message_hash(access.credential_id, external_message_id)
        request_hash = self._request_hash(operation, request.model_dump(mode="json"))
        with _savepoint(self.connection, "integration_channel_proposal"):
            self._existing_receipt(access.credential_id, message_hash, request_hash)
            proposal = AssistantWeeklyPlanProposalService(
                self.connection, access.user_id
            ).draft(
                request,
                idempotency_key=self._protected_hash(
                    "proposal-idempotency",
                    str(access.credential_id),
                    external_message_id,
                ),
            )
            self._save_receipt(
                access=access,
                message_hash=message_hash,
                operation=operation,
                request_hash=request_hash,
                created_at=self._now(),
            )
            self.repository.touch(access.credential_id, self._now())
            return proposal

    def decide_weekly_plan_proposal(
        self,
        *,
        token: str,
        channel_type: str,
        external_identity: str,
        external_message_id: str,
        proposal_id: int,
        request: ChannelProposalDecisionRequest,
    ) -> ProposalDecisionRead:
        access = self.authenticate(
            token=token,
            channel_type=channel_type,
            external_identity=external_identity,
            required_scope="proposal:decide",
        )
        operation = "proposal.decide.weekly_plan_adjustment"
        message_hash = self._message_hash(access.credential_id, external_message_id)
        request_hash = self._request_hash(
            operation,
            {"proposal_id": proposal_id, **request.model_dump(mode="json")},
        )
        ledger = ProposalLedgerService(self.connection, access.user_id)
        with _savepoint(self.connection, "integration_channel_proposal_decision"):
            receipt = self._existing_receipt(
                access.credential_id, message_hash, request_hash
            )
            if receipt is not None:
                decision = _replayed_channel_decision(ledger, proposal_id, request)
                if decision is None:
                    raise IntegrationReplayConflict
                self.repository.touch(access.credential_id, self._now())
                return decision

            decision = ledger.decide(
                proposal_id,
                ProposalDecisionCreate(decision=request.decision, reason=request.reason),
                expected_version=request.expected_version,
                now=self._now(),
            )
            self._save_receipt(
                access=access,
                message_hash=message_hash,
                operation=operation,
                request_hash=request_hash,
                created_at=self._now(),
            )
            self.repository.touch(access.credential_id, self._now())
            return decision

    def execute_weekly_plan_proposal(
        self, *, token: str, channel_type: str, external_identity: str,
        external_message_id: str, proposal_id: int,
        request: ChannelProposalExecutionRequest,
    ) -> AssistantWeeklyPlanExecutionRead:
        access = self.authenticate(token=token, channel_type=channel_type,
            external_identity=external_identity, required_scope="action:execute")
        operation = "proposal.execute.weekly_plan_adjustment"
        message_hash = self._message_hash(access.credential_id, external_message_id)
        request_hash = self._request_hash(operation, {"proposal_id": proposal_id, **request.model_dump(mode="json")})
        with _savepoint(self.connection, "integration_channel_proposal_execution"):
            self._existing_receipt(access.credential_id, message_hash, request_hash)
            result = AssistantWeeklyPlanExecutionService(self.connection, access.user_id).execute(
                proposal_id, AssistantProposalExecutionRequest(expected_version=request.expected_version),
                idempotency_key=self._protected_hash("execution-idempotency", str(access.credential_id), external_message_id),
            )
            self._save_receipt(access=access, message_hash=message_hash, operation=operation,
                request_hash=request_hash, created_at=self._now())
            self.repository.touch(access.credential_id, self._now())
            return result

    def _message_hash(self, credential_id: int, external_message_id: str) -> str:
        return self._protected_hash("message", str(credential_id), external_message_id)

    def _request_hash(self, operation: str, payload: dict[str, object]) -> str:
        return _sha256(
            json.dumps(
                {"operation": operation, "payload": payload},
                sort_keys=True,
                separators=(",", ":"),
            )
        )

    def _existing_receipt(
        self, credential_id: int, message_hash: str, request_hash: str
    ) -> StoredIntegrationReceipt | None:
        receipt = self.repository.get_receipt(credential_id, message_hash)
        if receipt is not None and not hmac.compare_digest(
            receipt.request_hash, request_hash
        ):
            raise IntegrationReplayConflict
        return receipt

    def _save_receipt(
        self,
        *,
        access: IntegrationAccessContext,
        message_hash: str,
        operation: str,
        request_hash: str,
        created_at: datetime,
    ) -> None:
        try:
            self.repository.save_receipt(
                user_id=access.user_id,
                credential_id=access.credential_id,
                message_id_hash=message_hash,
                operation=operation,
                request_hash=request_hash,
                created_at=created_at,
            )
        except sqlite3.IntegrityError as exc:
            concurrent = self._existing_receipt(
                access.credential_id, message_hash, request_hash
            )
            if concurrent is None:
                raise IntegrationReplayConflict from exc

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


def _replayed_channel_decision(
    ledger: ProposalLedgerService,
    proposal_id: int,
    request: ChannelProposalDecisionRequest,
) -> ProposalDecisionRead | None:
    decisions = ledger.detail(proposal_id).decisions
    if not decisions:
        return None
    decision = decisions[-1]
    if (
        decision.decision != request.decision
        or decision.reason != request.reason
        or decision.decided_after is not None
    ):
        return None
    return decision


@contextmanager
def _savepoint(connection: sqlite3.Connection, name: str) -> Iterator[None]:
    connection.execute(f"SAVEPOINT {name}")
    try:
        yield
    except Exception:
        connection.execute(f"ROLLBACK TO SAVEPOINT {name}")
        connection.execute(f"RELEASE SAVEPOINT {name}")
        raise
    connection.execute(f"RELEASE SAVEPOINT {name}")
