from __future__ import annotations

import hashlib
import json
import sqlite3
from contextlib import contextmanager
from datetime import date, datetime, timezone
from typing import Any, Iterator

from pydantic import ValidationError

from ..db.repositories import (
    GoalRepository,
    IdempotencyReceiptRepository,
    ProjectRepository,
    StoredIdempotencyReceipt,
    TimeLogRepository,
    WeeklyPlanRepository,
    WeeklyReviewRepository,
)
from ..schemas import (
    AccountRead,
    AgentActionCreate,
    AgentActionRead,
    AssistantContextRead,
    AssistantProposalExecutionRequest,
    AssistantReviewSummary,
    AssistantWeeklyPlanExecutionRead,
    AssistantWeeklyPlanUndoRead,
    AssistantWeeklyPlanUndoRequest,
    AssistantWeeklyPlanProposalRequest,
    ProposalCreate,
    ProposalDecisionRead,
    ProposalRead,
    WeeklyPlanCreate,
    WeeklyPlanRead,
)
from .activities import ActivityService
from .agent_memory import (
    ActionIdempotencyConflict,
    ActionNotFound,
    PreferenceService,
    ProposalLedgerService,
    ProposalVersionConflict,
)
from .focus import FocusService, IdempotencyConflict, IdempotencyInProgress
from .planning import InvalidPlanTaskReference, WeeklyPlanService
from .tasks import TaskService


class InvalidAssistantContextWindow(Exception):
    pass


class AssistantProposalSourceNotFound(Exception):
    pass


class AssistantProposalSourceStale(Exception):
    pass


class AssistantProposalUnavailable(Exception):
    pass


class AssistantProposalNotApproved(Exception):
    def __init__(self, current: ProposalRead) -> None:
        super().__init__("The proposal has not been approved")
        self.current = current


class AssistantProposalTypeUnsupported(Exception):
    pass


class AssistantProposalPayloadInvalid(Exception):
    pass


class AssistantPlanStateConflict(Exception):
    def __init__(self, current: WeeklyPlanRead | None) -> None:
        super().__init__("The target WeeklyPlan changed after the proposal was drafted")
        self.current = current


class AssistantPlanPersistenceConflict(Exception):
    pass


class AssistantActionInProgress(Exception):
    pass


class AssistantUndoUnavailable(Exception):
    pass


class AssistantContextService:
    MAX_WINDOW_DAYS = 31

    def __init__(
        self,
        connection: sqlite3.Connection,
        account: AccountRead,
    ) -> None:
        self.connection = connection
        self.account = account

    def read(self, *, week_start: date, week_end: date) -> AssistantContextRead:
        window_days = (week_end - week_start).days + 1
        if window_days < 1 or window_days > self.MAX_WINDOW_DAYS:
            raise InvalidAssistantContextWindow

        user_id = self.account.id
        stored_review = WeeklyReviewRepository(
            self.connection,
            user_id,
        ).get_by_week(week_start.isoformat(), week_end.isoformat())
        review = (
            None
            if stored_review is None
            else AssistantReviewSummary(
                id=stored_review.id,
                week_start=stored_review.week_start,
                week_end=stored_review.week_end,
                wins=stored_review.wins,
                risk_flags=stored_review.risk_flags,
                next_steps=stored_review.next_steps,
                stale_at=stored_review.stale_at,
                updated_at=stored_review.updated_at,
            )
        )
        goals = [
            goal
            for goal in GoalRepository(self.connection, user_id).list()
            if goal.active_status
        ]
        projects = [
            project
            for project in ProjectRepository(self.connection, user_id).list()
            if project.status == "active"
        ]
        active_project_ids = {project.id for project in projects}
        activities = [
            activity
            for activity in ActivityService(self.connection, user_id).list()
            if activity.project_id is None
            or activity.project_id in active_project_ids
        ]

        return AssistantContextRead(
            user_id=user_id,
            timezone=self.account.timezone,
            locale=self.account.locale,
            week_start=week_start,
            week_end=week_end,
            goals=goals,
            projects=projects,
            tasks=TaskService(self.connection, user_id).list(
                statuses=["open", "in_progress"],
            ),
            activities=activities,
            weekly_plan=WeeklyPlanRepository(
                self.connection,
                user_id,
            ).get_by_week(week_start.isoformat(), week_end.isoformat()),
            open_focus_sessions=FocusService(
                self.connection,
                user_id,
            ).list(statuses=["running"]),
            time_logs=TimeLogRepository(
                self.connection,
                user_id,
            ).list_between(week_start.isoformat(), week_end.isoformat()),
            latest_review=review,
            preferences=PreferenceService(self.connection, user_id).list(),
        )


class AssistantWeeklyPlanProposalService:
    MIN_RESTART_MINUTES = 30

    def __init__(self, connection: sqlite3.Connection, user_id: int) -> None:
        self.connection = connection
        self.user_id = user_id
        self.plans = WeeklyPlanRepository(connection, user_id)
        self.reviews = WeeklyReviewRepository(connection, user_id)
        self.ledger = ProposalLedgerService(connection, user_id)
        self.receipts = IdempotencyReceiptRepository(connection, user_id)

    def draft(
        self,
        request: AssistantWeeklyPlanProposalRequest,
        *,
        idempotency_key: str,
    ) -> ProposalRead:
        key = idempotency_key.strip()
        operation = "assistant.weekly_plan_adjustment"
        request_hash = _request_hash(operation, request.model_dump(mode="json"))
        with _savepoint(self.connection, "assistant_weekly_plan_proposal"):
            receipt = self.receipts.get(key)
            if receipt is not None:
                return _replay_receipt(receipt, operation, request_hash)
            try:
                receipt = self.receipts.begin(
                    idempotency_key=key,
                    operation=operation,
                    request_hash=request_hash,
                    created_at=_utc_now(),
                )
            except sqlite3.IntegrityError:
                receipt = self.receipts.get(key)
                if receipt is None:
                    raise
                return _replay_receipt(receipt, operation, request_hash)
            proposal = self._draft(request)
            self.receipts.complete(
                receipt.id,
                response_status=201,
                response_json=proposal.model_dump_json(),
            )
            return proposal

    def _draft(
        self,
        request: AssistantWeeklyPlanProposalRequest,
    ) -> ProposalRead:
        review = self.reviews.get_by_week(
            request.review_week_start.isoformat(),
            request.review_week_end.isoformat(),
        )
        if review is None:
            raise AssistantProposalSourceNotFound("weekly_review")
        if review.stale_at is not None:
            raise AssistantProposalSourceStale

        reviewed_plan = self.plans.get_by_week(
            request.review_week_start.isoformat(),
            request.review_week_end.isoformat(),
        )
        if reviewed_plan is None:
            raise AssistantProposalSourceNotFound("weekly_plan")

        target_plan = self.plans.get_by_week(
            request.target_week_start.isoformat(),
            request.target_week_end.isoformat(),
        )
        baseline = target_plan or reviewed_plan
        before_plan = (
            None
            if target_plan is None
            else _plan_command_payload(
                target_plan,
                week_start=request.target_week_start,
                week_end=request.target_week_end,
            )
        )
        after_plan = _plan_command_payload(
            baseline,
            week_start=request.target_week_start,
            week_end=request.target_week_end,
            reset_completion=target_plan is None,
        )

        adjustment = _select_adjustment(
            review.evidence,
            after_plan["items"],
            minimum_minutes=self.MIN_RESTART_MINUTES,
        )
        if adjustment is None:
            raise AssistantProposalUnavailable
        project_id, project_title, reviewed_minutes, actual_minutes, suggested_minutes = (
            adjustment
        )
        after_plan["items"] = _reduce_project_items(
            after_plan["items"],
            project_id=project_id,
            target_minutes=suggested_minutes,
        )

        proposal_key = (
            f"weekly-adjustment:{review.id}:{review.updated_at.isoformat()}:"
            f"{request.target_week_start.isoformat()}:{request.target_week_end.isoformat()}"
        )
        existing = _find_proposal(self.ledger.list(), proposal_key)
        if existing is not None:
            return existing

        evidence = [
            {
                "kind": "proposal_identity",
                "key": proposal_key,
            },
            {
                "kind": "weekly_review",
                "review_id": review.id,
                "week_start": request.review_week_start.isoformat(),
                "week_end": request.review_week_end.isoformat(),
                "updated_at": review.updated_at.isoformat(),
            },
            {
                "kind": "project_drift",
                "project_id": project_id,
                "project_title": project_title,
                "planned_minutes": reviewed_minutes,
                "actual_minutes": actual_minutes,
                "suggested_minutes": suggested_minutes,
                "source": "weekly_review.evidence.plan.project_drift",
            },
        ]
        return self.ledger.create(
            ProposalCreate(
                proposal_type="weekly_plan_adjustment",
                source="deterministic",
                title=f"Protect {suggested_minutes} min for {project_title}",
                rationale=(
                    f"The reviewed plan allocated {reviewed_minutes} min to "
                    f"{project_title}, while {actual_minutes} min were recorded. "
                    "This draft keeps a smaller restart block for the target week."
                ),
                evidence=evidence,
                before={"weekly_plan": before_plan},
                after={"weekly_plan": after_plan},
            )
        )


class AssistantWeeklyPlanExecutionService:
    OPERATION_CREATE = "weekly_plan.create"
    OPERATION_REPLACE = "weekly_plan.replace"

    def __init__(self, connection: sqlite3.Connection, user_id: int) -> None:
        self.connection = connection
        self.user_id = user_id
        self.ledger = ProposalLedgerService(connection, user_id)
        self.plans = WeeklyPlanRepository(connection, user_id)
        self.plan_service = WeeklyPlanService(connection, user_id)

    def execute(
        self,
        proposal_id: int,
        request: AssistantProposalExecutionRequest,
        *,
        idempotency_key: str,
    ) -> AssistantWeeklyPlanExecutionRead:
        with _savepoint(self.connection, "assistant_weekly_plan_execution"):
            detail = self.ledger.detail(proposal_id)
            proposal = detail.proposal
            if proposal.proposal_type != "weekly_plan_adjustment":
                raise AssistantProposalTypeUnsupported

            decision = _approved_decision(detail.decisions, proposal)
            effective_after = (
                decision.decided_after
                if decision.decision == "edit"
                else proposal.after
            )
            before_plan, after_plan = _validated_plan_diff(
                proposal.before,
                proposal.after,
                effective_after,
            )
            operation = (
                self.OPERATION_CREATE
                if before_plan is None
                else self.OPERATION_REPLACE
            )
            action_request = AgentActionCreate(
                proposal_id=proposal.id,
                decision_id=decision.id,
                operation=operation,
                request={
                    "expected_version": request.expected_version,
                    "before": proposal.before,
                    "after": effective_after,
                },
                idempotency_key=idempotency_key,
                reversible=True,
            )

            existing = self.ledger.get_action_by_key(
                action_request.idempotency_key
            )
            if existing is not None:
                return _replay_execution(existing, action_request)

            action = self.ledger.create_action(action_request)
            if action.status != "pending":
                return _replay_execution(action, action_request)
            if proposal.status != "approved":
                raise AssistantProposalNotApproved(proposal)
            if proposal.version != request.expected_version:
                raise ProposalVersionConflict(proposal)

            current = self.plans.get_by_week(
                after_plan.week_start.isoformat(),
                after_plan.week_end.isoformat(),
            )
            if before_plan is None:
                if current is not None:
                    raise AssistantPlanStateConflict(current)
                persisted = self._create(after_plan)
            else:
                if current is None or _stored_plan_payload(current) != before_plan.model_dump(
                    mode="json"
                ):
                    raise AssistantPlanStateConflict(current)
                persisted = self._replace(current.id, after_plan)

            expected_payload = after_plan.model_dump(mode="json")
            stored_payload = _stored_plan_payload(persisted)
            if stored_payload != expected_payload:
                raise AssistantPlanPersistenceConflict

            executed = self.ledger.mark_executed(
                proposal.id,
                expected_version=request.expected_version,
            )
            result = {
                "proposal": executed.model_dump(mode="json"),
                "weekly_plan": persisted.model_dump(mode="json"),
            }
            verification = {
                "status": "verified",
                "operation": operation,
                "weekly_plan_id": persisted.id,
                "matches_after": True,
            }
            finished = self.ledger.finish_action(
                action.id,
                status="succeeded",
                result=result,
                verification=verification,
            )
            return AssistantWeeklyPlanExecutionRead(
                proposal=executed,
                action=finished,
                weekly_plan=persisted,
            )

    def _create(self, plan: WeeklyPlanCreate) -> WeeklyPlanRead:
        try:
            return self.plan_service.create(plan)
        except (InvalidPlanTaskReference, sqlite3.IntegrityError) as exc:
            raise AssistantPlanPersistenceConflict from exc

    def _replace(self, plan_id: int, plan: WeeklyPlanCreate) -> WeeklyPlanRead:
        try:
            return self.plan_service.replace(plan_id, plan)
        except LookupError as exc:
            raise AssistantPlanStateConflict(None) from exc
        except (InvalidPlanTaskReference, sqlite3.IntegrityError) as exc:
            raise AssistantPlanPersistenceConflict from exc


class AssistantWeeklyPlanUndoService:
    OPERATION_UNDO_CREATE = "weekly_plan.undo_create"
    OPERATION_UNDO_REPLACE = "weekly_plan.undo_replace"

    def __init__(self, connection: sqlite3.Connection, user_id: int) -> None:
        self.connection = connection
        self.ledger = ProposalLedgerService(connection, user_id)
        self.plans = WeeklyPlanRepository(connection, user_id)
        self.plan_service = WeeklyPlanService(connection, user_id)

    def undo(
        self,
        proposal_id: int,
        action_id: int,
        request: AssistantWeeklyPlanUndoRequest,
        *,
        idempotency_key: str,
    ) -> AssistantWeeklyPlanUndoRead:
        with _savepoint(self.connection, "assistant_weekly_plan_undo"):
            detail = self.ledger.detail(proposal_id)
            proposal = detail.proposal
            if proposal.proposal_type != "weekly_plan_adjustment":
                raise AssistantProposalTypeUnsupported
            original = self.ledger.get_action(action_id)
            if original.proposal_id != proposal.id:
                raise ActionNotFound
            if (
                original.status not in {"succeeded", "undone"}
                or not original.reversible
            ):
                raise AssistantUndoUnavailable
            before_plan, after_plan, persisted_after = _validated_undo_action(
                original
            )
            operation = (
                self.OPERATION_UNDO_CREATE
                if original.operation
                == AssistantWeeklyPlanExecutionService.OPERATION_CREATE
                else self.OPERATION_UNDO_REPLACE
            )
            undo_request = AgentActionCreate(
                proposal_id=proposal.id,
                decision_id=original.decision_id,
                operation=operation,
                request={
                    "expected_version": request.expected_version,
                    "original_action_id": original.id,
                    "before": original.request["before"],
                    "after": original.request["after"],
                },
                idempotency_key=idempotency_key,
                reversible=False,
                undo_of_action_id=original.id,
            )
            existing = self.ledger.get_action_by_key(idempotency_key)
            if existing is not None:
                return _replay_undo(existing, undo_request)

            if original.status != "succeeded":
                raise AssistantUndoUnavailable
            if proposal.status != "executed":
                raise AssistantUndoUnavailable
            if proposal.version != request.expected_version:
                raise ProposalVersionConflict(proposal)

            current = self.plans.get_by_week(
                after_plan.week_start.isoformat(),
                after_plan.week_end.isoformat(),
            )
            if (
                current is None
                or current.id != persisted_after.id
                or _stored_plan_payload(current)
                != after_plan.model_dump(mode="json")
            ):
                raise AssistantPlanStateConflict(current)

            undo_action = self.ledger.create_action(undo_request)
            if undo_action.status != "pending":
                return _replay_undo(undo_action, undo_request)

            restored: WeeklyPlanRead | None
            try:
                if before_plan is None:
                    self.plan_service.delete(current.id)
                    restored = None
                else:
                    restored = self.plan_service.replace(current.id, before_plan)
            except (
                LookupError,
                InvalidPlanTaskReference,
                sqlite3.IntegrityError,
            ) as exc:
                raise AssistantPlanPersistenceConflict from exc

            stored = self.plans.get_by_week(
                after_plan.week_start.isoformat(),
                after_plan.week_end.isoformat(),
            )
            if before_plan is None:
                verified = stored is None
            else:
                verified = (
                    stored is not None
                    and stored.id == current.id
                    and _stored_plan_payload(stored)
                    == before_plan.model_dump(mode="json")
                )
            if not verified:
                raise AssistantPlanPersistenceConflict

            undone_original = self.ledger.mark_action_undone(original.id)
            undone_proposal = self.ledger.mark_undone(
                proposal.id,
                expected_version=request.expected_version,
            )
            result = {
                "proposal": undone_proposal.model_dump(mode="json"),
                "undone_action": undone_original.model_dump(mode="json"),
                "weekly_plan": (
                    None if restored is None else restored.model_dump(mode="json")
                ),
            }
            verification = {
                "status": "verified",
                "operation": operation,
                "weekly_plan_id": current.id,
                "matches_before": True,
            }
            finished = self.ledger.finish_action(
                undo_action.id,
                status="succeeded",
                result=result,
                verification=verification,
            )
            return AssistantWeeklyPlanUndoRead(
                proposal=undone_proposal,
                action=finished,
                undone_action=undone_original,
                weekly_plan=restored,
            )


def _plan_command_payload(
    plan: WeeklyPlanRead,
    *,
    week_start: date,
    week_end: date,
    reset_completion: bool = False,
) -> dict[str, Any]:
    return {
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "planned_capacity_minutes": plan.planned_capacity_minutes,
        "slack_target_percent": plan.slack_target_percent,
        "items": [
            {
                "project_id": item.project_id,
                "task_id": item.task_id,
                "title": item.title,
                "planned_minutes": item.planned_minutes,
                "priority": item.priority,
                "is_completed": False if reset_completion else item.is_completed,
            }
            for item in plan.items
        ],
        "note": plan.note,
    }


def _approved_decision(
    decisions: list[ProposalDecisionRead],
    proposal: ProposalRead,
) -> ProposalDecisionRead:
    approved = [
        decision
        for decision in decisions
        if decision.decision in {"approve", "edit"}
    ]
    if not approved:
        raise AssistantProposalNotApproved(proposal)
    return approved[-1]


def _validated_plan_diff(
    before: dict[str, Any],
    original_after: dict[str, Any],
    effective_after: dict[str, Any] | None,
) -> tuple[WeeklyPlanCreate | None, WeeklyPlanCreate]:
    try:
        if "weekly_plan" not in before:
            raise ValueError
        before_value = before["weekly_plan"]
        before_plan = (
            None
            if before_value is None
            else WeeklyPlanCreate.model_validate(before_value)
        )
        original_plan = WeeklyPlanCreate.model_validate(
            original_after["weekly_plan"]
        )
        if effective_after is None:
            raise ValueError
        after_plan = WeeklyPlanCreate.model_validate(
            effective_after["weekly_plan"]
        )
    except (KeyError, TypeError, ValueError, ValidationError) as exc:
        raise AssistantProposalPayloadInvalid from exc
    if (
        after_plan.week_start != original_plan.week_start
        or after_plan.week_end != original_plan.week_end
        or (
            before_plan is not None
            and (
                before_plan.week_start != original_plan.week_start
                or before_plan.week_end != original_plan.week_end
            )
        )
    ):
        raise AssistantProposalPayloadInvalid
    return before_plan, after_plan


def _validated_undo_action(
    action: AgentActionRead,
) -> tuple[WeeklyPlanCreate | None, WeeklyPlanCreate, WeeklyPlanRead]:
    if action.operation not in {
        AssistantWeeklyPlanExecutionService.OPERATION_CREATE,
        AssistantWeeklyPlanExecutionService.OPERATION_REPLACE,
    }:
        raise AssistantUndoUnavailable
    try:
        before_plan, after_plan = _validated_plan_diff(
            action.request["before"],
            action.request["after"],
            action.request["after"],
        )
        if action.result is None:
            raise ValueError
        persisted_after = WeeklyPlanRead.model_validate(
            action.result["weekly_plan"]
        )
    except (KeyError, TypeError, ValueError, ValidationError) as exc:
        raise AssistantProposalPayloadInvalid from exc
    if (
        (
            action.operation
            == AssistantWeeklyPlanExecutionService.OPERATION_CREATE
        )
        != (before_plan is None)
        or _stored_plan_payload(persisted_after) != after_plan.model_dump(mode="json")
    ):
        raise AssistantProposalPayloadInvalid
    return before_plan, after_plan, persisted_after


def _stored_plan_payload(plan: WeeklyPlanRead) -> dict[str, Any]:
    return _plan_command_payload(
        plan,
        week_start=plan.week_start,
        week_end=plan.week_end,
    )


def _replay_execution(
    action: AgentActionRead,
    requested: AgentActionCreate,
) -> AssistantWeeklyPlanExecutionRead:
    if (
        action.proposal_id != requested.proposal_id
        or action.decision_id != requested.decision_id
        or action.operation != requested.operation
        or action.request != requested.request
        or action.reversible != requested.reversible
        or action.undo_of_action_id != requested.undo_of_action_id
    ):
        raise ActionIdempotencyConflict
    if action.status == "pending":
        raise AssistantActionInProgress
    if action.status != "succeeded" or action.result is None:
        raise ActionIdempotencyConflict
    try:
        return AssistantWeeklyPlanExecutionRead(
            proposal=ProposalRead.model_validate(action.result["proposal"]),
            action=action,
            weekly_plan=WeeklyPlanRead.model_validate(
                action.result["weekly_plan"]
            ),
        )
    except (KeyError, TypeError, ValidationError) as exc:
        raise AssistantProposalPayloadInvalid from exc


def _replay_undo(
    action: AgentActionRead,
    requested: AgentActionCreate,
) -> AssistantWeeklyPlanUndoRead:
    if (
        action.proposal_id != requested.proposal_id
        or action.decision_id != requested.decision_id
        or action.operation != requested.operation
        or action.request != requested.request
        or action.reversible != requested.reversible
        or action.undo_of_action_id != requested.undo_of_action_id
    ):
        raise ActionIdempotencyConflict
    if action.status == "pending":
        raise AssistantActionInProgress
    if action.status != "succeeded" or action.result is None:
        raise ActionIdempotencyConflict
    try:
        weekly_plan_payload = action.result["weekly_plan"]
        return AssistantWeeklyPlanUndoRead(
            proposal=ProposalRead.model_validate(action.result["proposal"]),
            action=action,
            undone_action=AgentActionRead.model_validate(
                action.result["undone_action"]
            ),
            weekly_plan=(
                None
                if weekly_plan_payload is None
                else WeeklyPlanRead.model_validate(weekly_plan_payload)
            ),
        )
    except (KeyError, TypeError, ValidationError) as exc:
        raise AssistantProposalPayloadInvalid from exc


def _select_adjustment(
    evidence: dict[str, Any],
    target_items: list[dict[str, Any]],
    *,
    minimum_minutes: int,
) -> tuple[int, str, int, int, int] | None:
    plan_evidence = evidence.get("plan")
    if not isinstance(plan_evidence, dict):
        return None
    project_drift = plan_evidence.get("project_drift", [])
    if not isinstance(project_drift, list):
        return None
    candidates = [
        row
        for row in project_drift
        if isinstance(row, dict)
        and row.get("status") == "under_plan"
        and isinstance(row.get("project_id"), int)
        and isinstance(row.get("planned_minutes"), int)
        and isinstance(row.get("actual_minutes"), int)
        and row["planned_minutes"] > 0
    ]
    candidates.sort(
        key=lambda row: (
            -_number_or_zero(row.get("difference_ratio")),
            -abs(_number_or_zero(row.get("difference_minutes"))),
            row["project_id"],
        )
    )
    for row in candidates:
        project_id = row["project_id"]
        matching_items = [
            item for item in target_items if item.get("project_id") == project_id
        ]
        current_minutes = sum(item["planned_minutes"] for item in matching_items)
        if not matching_items or current_minutes <= len(matching_items):
            continue
        suggested_minutes = max(
            minimum_minutes,
            row["actual_minutes"],
            len(matching_items),
        )
        if suggested_minutes >= current_minutes:
            continue
        return (
            project_id,
            str(row.get("project_title") or f"Project {project_id}"),
            row["planned_minutes"],
            row["actual_minutes"],
            suggested_minutes,
        )
    return None


def _number_or_zero(value: object) -> float:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    return 0.0


def _reduce_project_items(
    items: list[dict[str, Any]],
    *,
    project_id: int,
    target_minutes: int,
) -> list[dict[str, Any]]:
    result = [dict(item) for item in items]
    matching_indices = [
        index for index, item in enumerate(result) if item.get("project_id") == project_id
    ]
    current_minutes = sum(result[index]["planned_minutes"] for index in matching_indices)
    remaining_reduction = current_minutes - target_minutes
    for index in sorted(
        matching_indices,
        key=lambda item_index: (
            -result[item_index]["planned_minutes"],
            result[item_index]["priority"],
            item_index,
        ),
    ):
        reducible = result[index]["planned_minutes"] - 1
        reduction = min(reducible, remaining_reduction)
        result[index]["planned_minutes"] -= reduction
        remaining_reduction -= reduction
        if remaining_reduction == 0:
            break
    if remaining_reduction != 0:
        raise RuntimeError("Could not produce a valid weekly plan adjustment")
    return result


def _find_proposal(
    proposals: list[ProposalRead],
    proposal_key: str,
) -> ProposalRead | None:
    for proposal in proposals:
        for item in proposal.evidence:
            if (
                item.get("kind") == "proposal_identity"
                and item.get("key") == proposal_key
            ):
                return proposal
    return None


def _replay_receipt(
    receipt: StoredIdempotencyReceipt,
    operation: str,
    request_hash: str,
) -> ProposalRead:
    if receipt.operation != operation or receipt.request_hash != request_hash:
        raise IdempotencyConflict
    if receipt.status == "completed" and receipt.response_json is not None:
        return ProposalRead.model_validate_json(receipt.response_json)
    raise IdempotencyInProgress


def _request_hash(operation: str, payload: dict[str, Any]) -> str:
    normalized = json.dumps(
        {"operation": operation, "payload": payload},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace(
        "+00:00",
        "Z",
    )


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
