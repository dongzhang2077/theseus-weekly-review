from __future__ import annotations

import hashlib
import json
import sqlite3
from contextlib import contextmanager
from datetime import date, datetime, timezone
from typing import Any, Iterator

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
    AssistantContextRead,
    AssistantReviewSummary,
    AssistantWeeklyPlanProposalRequest,
    ProposalCreate,
    ProposalRead,
    WeeklyPlanRead,
)
from .activities import ActivityService
from .agent_memory import PreferenceService, ProposalLedgerService
from .focus import FocusService, IdempotencyConflict, IdempotencyInProgress
from .tasks import TaskService


class InvalidAssistantContextWindow(Exception):
    pass


class AssistantProposalSourceNotFound(Exception):
    pass


class AssistantProposalSourceStale(Exception):
    pass


class AssistantProposalUnavailable(Exception):
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


def _plan_command_payload(
    plan: WeeklyPlanRead,
    *,
    week_start: date,
    week_end: date,
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
                "is_completed": False,
            }
            for item in plan.items
        ],
        "note": plan.note,
    }


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
