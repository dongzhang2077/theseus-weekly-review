from __future__ import annotations

from copy import deepcopy
from datetime import date

import pytest

from agent.workflows import (
    WeeklyAdjustmentDecision,
    WeeklyAdjustmentWorkflowConflict,
    WeeklyAdjustmentWorkflowNotFound,
    open_weekly_adjustment_workflow,
)
from backend.app.db.repositories import (
    ProposalRepository,
    WeeklyPlanRepository,
    WeeklyReviewRepository,
)
from backend.app.schemas import (
    AssistantWeeklyPlanProposalRequest,
    WeeklyReviewGenerateRequest,
)
from backend.app.services import (
    AssistantPlanPersistenceConflict,
    AssistantWeeklyPlanExecutionService,
    ReviewService,
)
from tests.support import seed_sample_week


WORKFLOW_ID = "weekly-adjustment-demo"
REQUEST = AssistantWeeklyPlanProposalRequest(
    review_week_start=date(2026, 6, 8),
    review_week_end=date(2026, 6, 14),
    target_week_start=date(2026, 6, 15),
    target_week_end=date(2026, 6, 21),
)


def _prepare(database):
    with database.session() as connection:
        user = seed_sample_week(connection)
        ReviewService(connection, user.id).generate(
            WeeklyReviewGenerateRequest(
                week_start=REQUEST.review_week_start,
                week_end=REQUEST.review_week_end,
            )
        )
    return user


def test_workflow_pauses_with_only_domain_ids_in_checkpoint(database, tmp_path) -> None:
    user = _prepare(database)
    checkpoint = tmp_path / "runtime" / "weekly-adjustment.db"

    with database.session() as connection:
        with open_weekly_adjustment_workflow(
            connection,
            user.id,
            checkpoint,
        ) as workflow:
            waiting = workflow.start(WORKFLOW_ID, REQUEST)
            snapshot = workflow.graph.get_state(
                workflow._config(WORKFLOW_ID)
            )

    assert waiting.status == "awaiting_approval"
    assert waiting.proposal.status == "pending"
    assert waiting.action is None
    assert snapshot.interrupts
    assert snapshot.interrupts[0].value == {
        "kind": "weekly_plan_approval",
        "proposal_id": waiting.proposal.id,
    }
    assert set(snapshot.values) == {
        "workflow_id",
        "user_id",
        "review_week_start",
        "review_week_end",
        "target_week_start",
        "target_week_end",
        "status",
        "review_id",
        "proposal_id",
        "proposal_version",
    }
    assert checkpoint.exists()


def test_workflow_computes_missing_review_through_existing_engine(
    database,
    tmp_path,
) -> None:
    with database.session() as connection:
        user = seed_sample_week(connection)
    checkpoint = tmp_path / "weekly-adjustment.db"

    with database.session() as connection:
        assert WeeklyReviewRepository(connection, user.id).get_by_week(
            REQUEST.review_week_start.isoformat(),
            REQUEST.review_week_end.isoformat(),
        ) is None
        with open_weekly_adjustment_workflow(
            connection, user.id, checkpoint
        ) as workflow:
            waiting = workflow.start(WORKFLOW_ID, REQUEST)
        stored = WeeklyReviewRepository(connection, user.id).get_by_week(
            REQUEST.review_week_start.isoformat(),
            REQUEST.review_week_end.isoformat(),
        )

    assert waiting.status == "awaiting_approval"
    assert stored is not None
    assert stored.evidence["schema_version"] == "sprint2.review_evidence.v1"


def test_workflow_resumes_after_restart_and_executes_exactly_once(
    database,
    tmp_path,
) -> None:
    user = _prepare(database)
    checkpoint = tmp_path / "weekly-adjustment.db"

    with database.session() as connection:
        with open_weekly_adjustment_workflow(
            connection, user.id, checkpoint
        ) as workflow:
            waiting = workflow.start(WORKFLOW_ID, REQUEST)

    with database.session() as connection:
        with open_weekly_adjustment_workflow(
            connection, user.id, checkpoint
        ) as restarted:
            restored = restarted.read(WORKFLOW_ID)
            completed = restarted.resume(
                WORKFLOW_ID,
                WeeklyAdjustmentDecision(decision="approve"),
            )
            replay = restarted.resume(
                WORKFLOW_ID,
                WeeklyAdjustmentDecision(decision="approve"),
            )

    with database.session() as connection:
        plans = WeeklyPlanRepository(connection, user.id).list()
        repository = ProposalRepository(connection, user.id)
        actions = repository.list_actions(waiting.proposal.id)

    assert restored.status == "awaiting_approval"
    assert completed.status == "completed"
    assert completed.proposal.status == "executed"
    assert completed.action is not None
    assert completed.action.status == "succeeded"
    assert completed.outcome_requested is True
    assert replay == completed
    assert len(plans) == 2
    assert len(actions) == 1
    assert actions[0].id == completed.action.id


def test_workflow_rejects_without_writing_a_plan(database, tmp_path) -> None:
    user = _prepare(database)
    checkpoint = tmp_path / "weekly-adjustment.db"

    with database.session() as connection:
        with open_weekly_adjustment_workflow(
            connection, user.id, checkpoint
        ) as workflow:
            waiting = workflow.start(WORKFLOW_ID, REQUEST)
            rejected = workflow.resume(
                WORKFLOW_ID,
                WeeklyAdjustmentDecision(
                    decision="reject",
                    reason="Keep the current week unchanged",
                ),
            )

    with database.session() as connection:
        plans = WeeklyPlanRepository(connection, user.id).list()
        actions = ProposalRepository(connection, user.id).list_actions(
            waiting.proposal.id
        )

    assert rejected.status == "rejected"
    assert rejected.proposal.status == "rejected"
    assert rejected.action is None
    assert rejected.outcome_requested is False
    assert len(plans) == 1
    assert actions == []


def test_workflow_honors_edited_approval(database, tmp_path) -> None:
    user = _prepare(database)
    checkpoint = tmp_path / "weekly-adjustment.db"

    with database.session() as connection:
        with open_weekly_adjustment_workflow(
            connection, user.id, checkpoint
        ) as workflow:
            waiting = workflow.start(WORKFLOW_ID, REQUEST)
            edited_after = deepcopy(waiting.proposal.after)
            item = next(
                item
                for item in edited_after["weekly_plan"]["items"]
                if item["title"] == "Update resume and apply to two roles"
            )
            item["planned_minutes"] = 45
            completed = workflow.resume(
                WORKFLOW_ID,
                WeeklyAdjustmentDecision(
                    decision="edit",
                    decided_after=edited_after,
                ),
            )

    with database.session() as connection:
        target = WeeklyPlanRepository(connection, user.id).get_by_week(
            REQUEST.target_week_start.isoformat(),
            REQUEST.target_week_end.isoformat(),
        )

    assert completed.status == "completed"
    assert target is not None
    persisted = next(
        item
        for item in target.items
        if item.title == "Update resume and apply to two roles"
    )
    assert persisted.planned_minutes == 45


def test_workflow_retries_failed_execution_without_duplicate_decision_or_action(
    database,
    tmp_path,
    monkeypatch,
) -> None:
    user = _prepare(database)
    checkpoint = tmp_path / "weekly-adjustment.db"

    with database.session() as connection:
        with open_weekly_adjustment_workflow(
            connection, user.id, checkpoint
        ) as workflow:
            waiting = workflow.start(WORKFLOW_ID, REQUEST)
            original = AssistantWeeklyPlanExecutionService.execute

            def fail_once(*_args, **_kwargs):
                raise AssistantPlanPersistenceConflict

            monkeypatch.setattr(
                AssistantWeeklyPlanExecutionService,
                "execute",
                fail_once,
            )
            with pytest.raises(AssistantPlanPersistenceConflict):
                workflow.resume(
                    WORKFLOW_ID,
                    WeeklyAdjustmentDecision(decision="approve"),
                )
            monkeypatch.setattr(
                AssistantWeeklyPlanExecutionService,
                "execute",
                original,
            )

    with database.session() as connection:
        with open_weekly_adjustment_workflow(
            connection, user.id, checkpoint
        ) as restarted:
            completed = restarted.retry(WORKFLOW_ID)

    with database.session() as connection:
        repository = ProposalRepository(connection, user.id)
        decisions = repository.list_decisions(waiting.proposal.id)
        actions = repository.list_actions(waiting.proposal.id)

    assert completed.status == "completed"
    assert len(decisions) == 1
    assert len(actions) == 1


def test_workflow_thread_is_account_scoped_and_start_payload_is_stable(
    database,
    tmp_path,
) -> None:
    first = _prepare(database)
    with database.session() as connection:
        second = seed_sample_week(connection)
    checkpoint = tmp_path / "weekly-adjustment.db"

    with database.session() as connection:
        with open_weekly_adjustment_workflow(
            connection, first.id, checkpoint
        ) as workflow:
            workflow.start(WORKFLOW_ID, REQUEST)
            with pytest.raises(WeeklyAdjustmentWorkflowConflict):
                workflow.start(
                    WORKFLOW_ID,
                    REQUEST.model_copy(
                        update={"target_week_end": date(2026, 6, 22)}
                    ),
                )

    with database.session() as connection:
        with open_weekly_adjustment_workflow(
            connection, second.id, checkpoint
        ) as other:
            with pytest.raises(WeeklyAdjustmentWorkflowNotFound):
                other.read(WORKFLOW_ID)
