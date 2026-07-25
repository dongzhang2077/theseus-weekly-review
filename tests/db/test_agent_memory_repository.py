from __future__ import annotations

from datetime import datetime, timezone
import sqlite3

import pytest
from pydantic import ValidationError

from backend.app.db.repositories import (
    PreferenceRepository,
    ProjectRepository,
    ProposalRepository,
    UserRepository,
)
from backend.app.schemas import (
    AgentActionCreate,
    LocalUserCreate,
    PreferenceCreate,
    ProjectCreate,
    ProposalCreate,
    ProposalDecisionCreate,
    ProposalOutcomeCreate,
)


def test_preferences_preserve_source_provenance_and_json(connection) -> None:
    user = UserRepository(connection).create(LocalUserCreate(display_name="Memory user"))
    repository = PreferenceRepository(connection, user.id)

    stated = repository.create(
        PreferenceCreate(
            source="user_stated",
            preference_key="focus.default_minutes",
            value=25,
            provenance={"statement": "I prefer short focus blocks."},
        )
    )
    inferred = repository.create(
        PreferenceCreate(
            source="inferred",
            preference_key="focus.preferred_period",
            value={"start": "09:00", "end": "11:00"},
            provenance={"time_log_ids": [3, 7], "rule": "completion_window"},
            confidence=0.72,
            review_after=datetime(2026, 8, 8, tzinfo=timezone.utc),
        )
    )

    assert stated.source == "user_stated"
    assert stated.confidence is None
    assert stated.value == 25
    assert inferred.source == "inferred"
    assert inferred.confidence == pytest.approx(0.72)
    assert inferred.provenance["time_log_ids"] == [3, 7]
    assert [item.id for item in repository.list(source="inferred")] == [inferred.id]


def test_inferred_preference_requires_confidence_and_review_rule() -> None:
    with pytest.raises(ValidationError):
        PreferenceCreate(
            source="inferred",
            preference_key="focus.default_minutes",
            value=25,
            provenance={"rule": "accepted_duration"},
        )


def test_preference_scope_and_identity_are_user_scoped(connection) -> None:
    users = UserRepository(connection)
    first = users.create(LocalUserCreate(display_name="First"))
    second = users.create(LocalUserCreate(display_name="Second"))
    second_project = ProjectRepository(connection, second.id).create(
        ProjectCreate(title="Private project")
    )

    with pytest.raises(sqlite3.IntegrityError):
        PreferenceRepository(connection, first.id).create(
            PreferenceCreate(
                source="user_stated",
                preference_key="project.weekly_limit",
                value=180,
                scope_type="project",
                scope_ref_id=second_project.id,
            )
        )

    repository = PreferenceRepository(connection, first.id)
    repository.create(
        PreferenceCreate(
            source="user_stated",
            preference_key="focus.default_minutes",
            value=25,
        )
    )
    with pytest.raises(sqlite3.IntegrityError):
        repository.create(
            PreferenceCreate(
                source="user_stated",
                preference_key="focus.default_minutes",
                value=45,
            )
        )


def test_preference_delete_restore_and_revisions_are_append_only(connection) -> None:
    user = UserRepository(connection).create(LocalUserCreate(display_name="Revision user"))
    repository = PreferenceRepository(connection, user.id)
    created = repository.create(
        PreferenceCreate(
            source="inferred",
            preference_key="focus.default_minutes",
            value=25,
            provenance={"proposal_ids": [1]},
            confidence=0.8,
            expires_at=datetime(2026, 8, 25, tzinfo=timezone.utc),
        )
    )

    deleted = repository.soft_delete(created.id, expected_version=created.version)
    delete_revision = repository.add_revision(
        created.id,
        action="delete",
        before=created,
        after=deleted,
        reason="Not representative",
    )
    restored = repository.restore(deleted.id, expected_version=deleted.version)
    restore_revision = repository.add_revision(
        created.id,
        action="restore",
        before=deleted,
        after=restored,
    )

    assert repository.list() == [restored]
    assert deleted.deleted_at is not None
    assert restored.deleted_at is None
    assert restored.version == 3
    assert delete_revision.id < restore_revision.id
    revision_count = connection.execute(
        "SELECT COUNT(*) FROM preference_revisions WHERE preference_id = ?",
        (created.id,),
    ).fetchone()[0]
    assert revision_count == 2


def test_proposal_decision_action_and_outcome_form_owned_ledger(connection) -> None:
    user = UserRepository(connection).create(LocalUserCreate(display_name="Ledger user"))
    repository = ProposalRepository(connection, user.id)
    proposal = repository.create(
        ProposalCreate(
            proposal_type="weekly_plan_adjustment",
            title="Protect a restart block",
            rationale="The project has no time this week.",
            evidence=[{"type": "dormancy_risk", "project_id": 4}],
            before={"planned_minutes": 0},
            after={"planned_minutes": 30},
        )
    )
    decision = repository.add_decision(
        proposal.id,
        ProposalDecisionCreate(
            decision="edit",
            decided_after={"planned_minutes": 20},
            reason="Keep the first step small",
        ),
        expected_version=proposal.version,
    )
    action = repository.create_action(
        AgentActionCreate(
            proposal_id=proposal.id,
            decision_id=decision.id,
            operation="weekly_plan.adjust",
            request={"planned_minutes": 20},
            idempotency_key="story025-action-001",
            reversible=True,
        )
    )
    completed = repository.finish_action(
        action.id,
        status="succeeded",
        result={"weekly_plan_id": 9},
        verification={"planned_minutes": 20},
    )
    outcome = repository.add_outcome(
        ProposalOutcomeCreate(
            proposal_id=proposal.id,
            action_id=action.id,
            result="completed",
            usefulness=5,
            actual_duration_minutes=18,
            energy_feedback="neutral",
            note="The smaller block was realistic.",
        )
    )

    assert repository.get(proposal.id).status == "approved"
    assert completed.status == "succeeded"
    assert completed.result == {"weekly_plan_id": 9}
    assert completed.verification == {"planned_minutes": 20}
    assert repository.get_action_by_key("story025-action-001") == completed
    assert outcome.usefulness == 5

    with pytest.raises(sqlite3.IntegrityError):
        repository.create_action(
            AgentActionCreate(
                proposal_id=proposal.id,
                decision_id=decision.id,
                operation="weekly_plan.adjust",
                request={"planned_minutes": 20},
                idempotency_key="story025-action-001",
            )
        )


def test_ledger_rejects_cross_account_references(connection) -> None:
    users = UserRepository(connection)
    first = users.create(LocalUserCreate(display_name="First"))
    second = users.create(LocalUserCreate(display_name="Second"))
    first_repository = ProposalRepository(connection, first.id)
    proposal = first_repository.create(
        ProposalCreate(
            proposal_type="generic",
            title="Private proposal",
            evidence=[],
            before={},
            after={"change": True},
        )
    )

    with pytest.raises(sqlite3.IntegrityError):
        ProposalRepository(connection, second.id).create_action(
            AgentActionCreate(
                proposal_id=proposal.id,
                operation="private.change",
                request={"change": True},
                idempotency_key="cross-user-action",
            )
        )
