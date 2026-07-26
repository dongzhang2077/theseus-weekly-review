from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
import sqlite3
from typing import Iterator

from ..db.repositories import PreferenceRepository, ProposalRepository
from ..schemas import (
    AgentActionCreate,
    AgentActionRead,
    AgentActionStatus,
    PreferenceCreate,
    PreferenceDetailRead,
    PreferenceRead,
    ProposalCreate,
    ProposalDecisionCreate,
    ProposalDecisionRead,
    ProposalDetailRead,
    ProposalOutcomeCreate,
    ProposalOutcomeRead,
    ProposalRead,
    ProposalStatus,
)


class PreferenceNotFound(Exception):
    pass


class PreferenceVersionConflict(Exception):
    def __init__(self, current: PreferenceRead) -> None:
        super().__init__("The preference changed after it was loaded")
        self.current = current


class ProposalNotFound(Exception):
    pass


class ProposalVersionConflict(Exception):
    def __init__(self, current: ProposalRead) -> None:
        super().__init__("The proposal changed after it was loaded")
        self.current = current


class ProposalExpired(Exception):
    pass


class ActionIdempotencyConflict(Exception):
    pass


class ActionNotFound(Exception):
    pass


class PreferenceService:
    def __init__(self, connection: sqlite3.Connection, user_id: int) -> None:
        self.connection = connection
        self.repository = PreferenceRepository(connection, user_id)

    def create(self, preference: PreferenceCreate) -> PreferenceRead:
        return self.repository.create(preference)

    def get(self, preference_id: int, *, include_deleted: bool = False) -> PreferenceRead:
        try:
            return self.repository.get(
                preference_id,
                include_deleted=include_deleted,
            )
        except LookupError as exc:
            raise PreferenceNotFound from exc

    def list(
        self,
        *,
        source: str | None = None,
        include_deleted: bool = False,
    ) -> list[PreferenceRead]:
        return self.repository.list(
            source=source,
            include_deleted=include_deleted,
        )

    def detail(
        self,
        preference_id: int,
        *,
        include_deleted: bool = False,
    ) -> PreferenceDetailRead:
        preference = self.get(
            preference_id,
            include_deleted=include_deleted,
        )
        return PreferenceDetailRead(
            preference=preference,
            revisions=self.repository.list_revisions(preference_id),
        )

    def replace(
        self,
        preference_id: int,
        preference: PreferenceCreate,
        *,
        expected_version: int,
        reason: str = "",
    ) -> PreferenceRead:
        current = self.get(preference_id)
        if current.version != expected_version:
            raise PreferenceVersionConflict(current)
        with _savepoint(self.connection, "replace_preference"):
            try:
                updated = self.repository.replace(
                    preference_id,
                    preference,
                    expected_version=expected_version,
                )
            except RuntimeError as exc:
                if str(exc) != "preference_version_conflict":
                    raise
                raise PreferenceVersionConflict(self.get(preference_id)) from exc
            self.repository.add_revision(
                preference_id,
                action="update",
                before=current,
                after=updated,
                reason=reason,
            )
        return updated

    def delete(
        self,
        preference_id: int,
        *,
        expected_version: int,
        reason: str = "",
    ) -> PreferenceRead:
        current = self.get(preference_id)
        if current.version != expected_version:
            raise PreferenceVersionConflict(current)
        with _savepoint(self.connection, "delete_preference"):
            try:
                deleted = self.repository.soft_delete(
                    preference_id,
                    expected_version=expected_version,
                )
            except RuntimeError as exc:
                if str(exc) != "preference_version_conflict":
                    raise
                raise PreferenceVersionConflict(self.get(preference_id)) from exc
            self.repository.add_revision(
                preference_id,
                action="delete",
                before=current,
                after=deleted,
                reason=reason,
            )
        return deleted

    def restore(
        self,
        preference_id: int,
        *,
        expected_version: int,
        reason: str = "",
    ) -> PreferenceRead:
        current = self.get(preference_id, include_deleted=True)
        if current.deleted_at is None:
            raise PreferenceVersionConflict(current)
        if current.version != expected_version:
            raise PreferenceVersionConflict(current)
        with _savepoint(self.connection, "restore_preference"):
            try:
                restored = self.repository.restore(
                    preference_id,
                    expected_version=expected_version,
                )
            except (RuntimeError, sqlite3.IntegrityError) as exc:
                latest = self.get(preference_id, include_deleted=True)
                raise PreferenceVersionConflict(latest) from exc
            self.repository.add_revision(
                preference_id,
                action="restore",
                before=current,
                after=restored,
                reason=reason,
            )
        return restored


class ProposalLedgerService:
    def __init__(self, connection: sqlite3.Connection, user_id: int) -> None:
        self.connection = connection
        self.repository = ProposalRepository(connection, user_id)

    def create(self, proposal: ProposalCreate) -> ProposalRead:
        return self.repository.create(proposal)

    def get(self, proposal_id: int) -> ProposalRead:
        try:
            return self.repository.get(proposal_id)
        except LookupError as exc:
            raise ProposalNotFound from exc

    def list(self, *, status: ProposalStatus | None = None) -> list[ProposalRead]:
        return self.repository.list(status=status)

    def detail(self, proposal_id: int) -> ProposalDetailRead:
        proposal = self.get(proposal_id)
        return ProposalDetailRead(
            proposal=proposal,
            decisions=self.repository.list_decisions(proposal_id),
            actions=self.repository.list_actions(proposal_id),
            outcomes=self.repository.list_outcomes(proposal_id),
        )

    def mark_executed(
        self,
        proposal_id: int,
        *,
        expected_version: int,
    ) -> ProposalRead:
        try:
            return self.repository.mark_executed(
                proposal_id,
                expected_version=expected_version,
            )
        except RuntimeError as exc:
            if str(exc) != "proposal_execution_conflict":
                raise
            raise ProposalVersionConflict(self.get(proposal_id)) from exc

    def decide(
        self,
        proposal_id: int,
        decision: ProposalDecisionCreate,
        *,
        expected_version: int,
        now: datetime | None = None,
    ) -> ProposalDecisionRead:
        proposal = self.get(proposal_id)
        if proposal.version != expected_version:
            raise ProposalVersionConflict(proposal)
        if proposal.status != "pending":
            raise ProposalVersionConflict(proposal)
        if _is_expired(proposal, now=now):
            raise ProposalExpired
        with _savepoint(self.connection, "decide_proposal"):
            try:
                return self.repository.add_decision(
                    proposal_id,
                    decision,
                    expected_version=expected_version,
                )
            except RuntimeError as exc:
                if str(exc) not in {
                    "proposal_version_conflict",
                    "proposal_state_conflict",
                }:
                    raise
                raise ProposalVersionConflict(self.get(proposal_id)) from exc

    def create_action(self, action: AgentActionCreate) -> AgentActionRead:
        existing = self.repository.get_action_by_key(action.idempotency_key)
        if existing is not None:
            if _same_action(existing, action):
                return existing
            raise ActionIdempotencyConflict
        try:
            return self.repository.create_action(action)
        except sqlite3.IntegrityError as exc:
            existing = self.repository.get_action_by_key(action.idempotency_key)
            if existing is not None and _same_action(existing, action):
                return existing
            raise ActionIdempotencyConflict from exc

    def get_action_by_key(self, idempotency_key: str) -> AgentActionRead | None:
        return self.repository.get_action_by_key(idempotency_key)

    def finish_action(
        self,
        action_id: int,
        *,
        status: AgentActionStatus,
        result: dict | None = None,
        verification: dict | None = None,
        error_message: str = "",
    ) -> AgentActionRead:
        try:
            return self.repository.finish_action(
                action_id,
                status=status,
                result=result,
                verification=verification,
                error_message=error_message,
            )
        except LookupError as exc:
            raise ActionNotFound from exc

    def add_outcome(self, outcome: ProposalOutcomeCreate) -> ProposalOutcomeRead:
        self.get(outcome.proposal_id)
        try:
            return self.repository.add_outcome(outcome)
        except sqlite3.IntegrityError as exc:
            raise ProposalNotFound from exc


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


def _is_expired(proposal: ProposalRead, *, now: datetime | None) -> bool:
    if proposal.expires_at is None:
        return False
    current = now or datetime.now(timezone.utc)
    expiry = proposal.expires_at
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    return expiry <= current


def _same_action(existing: AgentActionRead, requested: AgentActionCreate) -> bool:
    return (
        existing.proposal_id == requested.proposal_id
        and existing.decision_id == requested.decision_id
        and existing.operation == requested.operation
        and existing.request == requested.request
        and existing.reversible == requested.reversible
        and existing.undo_of_action_id == requested.undo_of_action_id
    )
