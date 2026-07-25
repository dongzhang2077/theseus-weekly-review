from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from backend.app.db.repositories import UserRepository
from backend.app.schemas import (
    AgentActionCreate,
    LocalUserCreate,
    PreferenceCreate,
    ProposalCreate,
    ProposalDecisionCreate,
)
from backend.app.services import (
    ActionIdempotencyConflict,
    PreferenceService,
    PreferenceVersionConflict,
    ProposalExpired,
    ProposalLedgerService,
)


def test_preference_service_records_atomic_corrections(connection) -> None:
    user = UserRepository(connection).create(LocalUserCreate(display_name="Preference user"))
    service = PreferenceService(connection, user.id)
    created = service.create(
        PreferenceCreate(
            source="user_stated",
            preference_key="focus.default_minutes",
            value=25,
        )
    )

    updated = service.replace(
        created.id,
        PreferenceCreate(
            source="user_stated",
            preference_key="focus.default_minutes",
            value=45,
        ),
        expected_version=created.version,
        reason="Longer blocks fit deep work",
    )

    assert updated.value == 45
    assert updated.version == 2
    revision = connection.execute(
        """
        SELECT action, reason
        FROM preference_revisions
        WHERE preference_id = ?
        """,
        (created.id,),
    ).fetchone()
    assert tuple(revision) == ("update", "Longer blocks fit deep work")

    with pytest.raises(PreferenceVersionConflict):
        service.delete(created.id, expected_version=created.version)


def test_preference_mutation_rolls_back_when_audit_write_fails(
    connection,
    monkeypatch,
) -> None:
    user = UserRepository(connection).create(LocalUserCreate(display_name="Rollback user"))
    service = PreferenceService(connection, user.id)
    created = service.create(
        PreferenceCreate(
            source="user_stated",
            preference_key="focus.default_minutes",
            value=25,
        )
    )

    def fail_revision(*args, **kwargs):
        raise RuntimeError("audit unavailable")

    monkeypatch.setattr(service.repository, "add_revision", fail_revision)

    with pytest.raises(RuntimeError, match="audit unavailable"):
        service.delete(created.id, expected_version=created.version)

    current = service.get(created.id)
    assert current.deleted_at is None
    assert current.version == 1


def test_proposal_service_rejects_expired_decision(connection) -> None:
    user = UserRepository(connection).create(LocalUserCreate(display_name="Proposal user"))
    service = ProposalLedgerService(connection, user.id)
    now = datetime(2026, 7, 25, 18, 0, tzinfo=timezone.utc)
    proposal = service.create(
        ProposalCreate(
            proposal_type="weekly_plan_adjustment",
            title="Short-lived proposal",
            evidence=[],
            before={"minutes": 0},
            after={"minutes": 30},
            expires_at=now - timedelta(minutes=1),
        )
    )

    with pytest.raises(ProposalExpired):
        service.decide(
            proposal.id,
            ProposalDecisionCreate(decision="approve"),
            expected_version=proposal.version,
            now=now,
        )

    assert service.get(proposal.id).status == "pending"


def test_action_creation_is_idempotent_and_detects_key_reuse(connection) -> None:
    user = UserRepository(connection).create(LocalUserCreate(display_name="Action user"))
    service = ProposalLedgerService(connection, user.id)
    proposal = service.create(
        ProposalCreate(
            proposal_type="task_create",
            title="Create a restart task",
            evidence=[{"type": "dormancy_risk"}],
            before={},
            after={"title": "Restart applications"},
        )
    )
    request = AgentActionCreate(
        proposal_id=proposal.id,
        operation="task.create",
        request={"title": "Restart applications"},
        idempotency_key="story025-idempotency",
        reversible=True,
    )

    first = service.create_action(request)
    replay = service.create_action(request)

    assert replay.id == first.id
    assert connection.execute(
        "SELECT COUNT(*) FROM agent_actions WHERE user_id = ?",
        (user.id,),
    ).fetchone()[0] == 1

    with pytest.raises(ActionIdempotencyConflict):
        service.create_action(
            AgentActionCreate(
                proposal_id=proposal.id,
                operation="task.create",
                request={"title": "Different task"},
                idempotency_key="story025-idempotency",
                reversible=True,
            )
        )
