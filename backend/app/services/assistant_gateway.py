from __future__ import annotations

import os
import re
import sqlite3
from collections import defaultdict
from collections.abc import Mapping, Sequence
from datetime import date
from typing import Any

from ..schemas import (
    AccountRead,
    AssistantContextRead,
    AssistantGatewayActivityTypeTimeSummary,
    AssistantGatewayContextEnvelope,
    AssistantGatewayDateTimeSummary,
    AssistantGatewayEnvelopeRequest,
    AssistantGatewayFocusSummary,
    AssistantGatewayPlanItemSummary,
    AssistantGatewayPlanSummary,
    AssistantGatewayProjectSummary,
    AssistantGatewayProjectTimeSummary,
    AssistantGatewayProviderStatusRead,
    AssistantGatewayReviewSummary,
    AssistantGatewayRiskSummary,
    AssistantGatewayTaskSummary,
    AssistantGatewayTimeSummary,
    AssistantGatewayWindow,
)
from .assistant import AssistantContextService


class AssistantContextPolicyViolation(ValueError):
    pass


_SECTIONS_BY_PURPOSE = {
    "focus_status": ("projects", "tasks", "running_focus"),
    "task_status": ("projects", "tasks"),
    "plan_status": ("projects", "tasks", "weekly_plan"),
    "weekly_review": (
        "projects",
        "weekly_plan",
        "time_summary",
        "review_summary",
    ),
}
_DENIED_FIELD_NAMES = {
    "access_token",
    "api_key",
    "audio",
    "credentials",
    "description",
    "email",
    "evidence",
    "generated_text",
    "note",
    "oauth_token",
    "pairing_token",
    "password",
    "preferences",
    "provenance",
    "raw_audio",
    "refresh_token",
    "session_token",
    "time_logs",
    "transcript_history",
    "user_id",
}
_SENSITIVE_VALUE_PATTERNS = (
    re.compile(r"\bsk-[A-Za-z0-9_-]{16,}\b"),
    re.compile(r"\bths_int_[A-Za-z0-9_-]{16,}\b"),
    re.compile(r"\b\d{6,12}:[A-Za-z0-9_-]{20,}\b"),
    re.compile(r"\bBearer\s+\S{16,}", re.IGNORECASE),
    re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE),
)


class AssistantGatewayService:
    MAX_PROJECTS = 20
    MAX_TASKS = 20
    MAX_RUNNING_FOCUS = 10
    MAX_PLAN_ITEMS = 20
    MAX_REVIEW_ITEMS = 5

    def __init__(
        self,
        connection: sqlite3.Connection,
        account: AccountRead,
    ) -> None:
        self.connection = connection
        self.account = account

    def prepare(
        self,
        request: AssistantGatewayEnvelopeRequest,
    ) -> AssistantGatewayContextEnvelope:
        _reject_sensitive_value(request.utterance, path="utterance")
        context = AssistantContextService(self.connection, self.account).read(
            week_start=request.window_start,
            week_end=request.window_end,
        )
        sections = _SECTIONS_BY_PURPOSE[request.purpose]
        omitted_counts: dict[str, int] = {}

        projects = []
        if "projects" in sections:
            bounded, omitted = _bounded(context.projects, self.MAX_PROJECTS)
            projects = [
                AssistantGatewayProjectSummary(
                    id=project.id,
                    title=project.title,
                    stage=project.stage,
                    deadline=project.deadline,
                    weekly_min_minutes=project.weekly_min_minutes,
                    weekly_target_minutes=project.weekly_target_minutes,
                    last_activity_date=project.last_activity_date,
                )
                for project in bounded
            ]
            _record_omitted(omitted_counts, "projects", omitted)

        tasks = []
        if "tasks" in sections:
            ordered_tasks = sorted(
                context.tasks,
                key=lambda item: (
                    item.priority,
                    item.due_date is None,
                    item.due_date,
                    item.id,
                ),
            )
            bounded, omitted = _bounded(ordered_tasks, self.MAX_TASKS)
            tasks = [
                AssistantGatewayTaskSummary(
                    id=task.id,
                    project_id=task.project_id,
                    title=task.title,
                    status=task.status,
                    priority=task.priority,
                    estimated_minutes=task.estimated_minutes,
                    due_date=task.due_date,
                )
                for task in bounded
            ]
            _record_omitted(omitted_counts, "tasks", omitted)

        running_focus = []
        if "running_focus" in sections:
            ordered_focus = sorted(
                context.open_focus_sessions,
                key=lambda item: (item.started_at, item.id),
            )
            bounded, omitted = _bounded(
                ordered_focus,
                self.MAX_RUNNING_FOCUS,
            )
            running_focus = [
                AssistantGatewayFocusSummary(
                    id=focus.id,
                    activity_id=focus.activity_id,
                    task_id=focus.task_id,
                    project_id=focus.project_id,
                    activity_name=focus.activity_name,
                    activity_type=focus.activity_type,
                    task_title=focus.task_title,
                    elapsed_seconds=focus.elapsed_seconds,
                    started_at=focus.started_at,
                )
                for focus in bounded
            ]
            _record_omitted(omitted_counts, "running_focus", omitted)

        weekly_plan = None
        if "weekly_plan" in sections and context.weekly_plan is not None:
            weekly_plan = self._plan_summary(context, omitted_counts)

        time_summary = None
        if "time_summary" in sections:
            time_summary = _time_summary(context)

        review_summary = None
        if "review_summary" in sections and context.latest_review is not None:
            review_summary = self._review_summary(context, omitted_counts)

        envelope = AssistantGatewayContextEnvelope(
            purpose=request.purpose,
            utterance=request.utterance,
            timezone=self.account.timezone,
            locale=self.account.locale,
            window=AssistantGatewayWindow(
                start=request.window_start,
                end=request.window_end,
            ),
            included_sections=list(sections),
            projects=projects,
            tasks=tasks,
            running_focus=running_focus,
            weekly_plan=weekly_plan,
            time_summary=time_summary,
            review_summary=review_summary,
            omitted_counts=omitted_counts,
        )
        serialize_provider_envelope(envelope)
        return envelope

    def _plan_summary(
        self,
        context: AssistantContextRead,
        omitted_counts: dict[str, int],
    ) -> AssistantGatewayPlanSummary:
        plan = context.weekly_plan
        if plan is None:
            raise AssertionError("weekly_plan must be present")
        bounded, omitted = _bounded(plan.items, self.MAX_PLAN_ITEMS)
        _record_omitted(omitted_counts, "weekly_plan.items", omitted)
        return AssistantGatewayPlanSummary(
            id=plan.id,
            week_start=plan.week_start,
            week_end=plan.week_end,
            planned_capacity_minutes=plan.planned_capacity_minutes,
            planned_minutes=sum(item.planned_minutes for item in plan.items),
            slack_target_percent=plan.slack_target_percent,
            items=[
                AssistantGatewayPlanItemSummary(
                    id=item.id,
                    project_id=item.project_id,
                    task_id=item.task_id,
                    title=item.title,
                    planned_minutes=item.planned_minutes,
                    priority=item.priority,
                    is_completed=item.is_completed,
                )
                for item in bounded
            ],
        )

    def _review_summary(
        self,
        context: AssistantContextRead,
        omitted_counts: dict[str, int],
    ) -> AssistantGatewayReviewSummary:
        review = context.latest_review
        if review is None:
            raise AssertionError("latest_review must be present")
        wins, omitted_wins = _bounded(review.wins, self.MAX_REVIEW_ITEMS)
        risks, omitted_risks = _bounded(review.risk_flags, self.MAX_REVIEW_ITEMS)
        next_steps, omitted_next_steps = _bounded(
            review.next_steps,
            self.MAX_REVIEW_ITEMS,
        )
        _record_omitted(omitted_counts, "review_summary.wins", omitted_wins)
        _record_omitted(omitted_counts, "review_summary.risks", omitted_risks)
        _record_omitted(
            omitted_counts,
            "review_summary.next_steps",
            omitted_next_steps,
        )
        return AssistantGatewayReviewSummary(
            id=review.id,
            week_start=review.week_start,
            week_end=review.week_end,
            win_titles=[item.title for item in wins],
            risks=[
                AssistantGatewayRiskSummary(
                    type=item.type,
                    severity=item.severity,
                )
                for item in risks
            ],
            next_step_titles=[item.title for item in next_steps],
            stale=review.stale_at is not None,
        )


def assistant_gateway_provider_status() -> AssistantGatewayProviderStatusRead:
    provider = os.getenv("THESEUS_ASSISTANT_PROVIDER", "local").strip().lower()
    if provider in {"", "local"}:
        return AssistantGatewayProviderStatusRead(
            provider="local",
            configured=True,
        )
    if provider != "openai":
        return AssistantGatewayProviderStatusRead(
            provider="unsupported",
            configured=False,
        )
    model = os.getenv("THESEUS_ASSISTANT_MODEL", "").strip() or None
    if model is not None:
        try:
            _reject_sensitive_value(model, path="provider.model")
        except AssistantContextPolicyViolation:
            model = None
    has_key = bool(os.getenv("OPENAI_API_KEY", "").strip())
    return AssistantGatewayProviderStatusRead(
        provider="openai",
        configured=has_key and model is not None,
        model=model,
    )


def serialize_provider_envelope(
    envelope: AssistantGatewayContextEnvelope | Mapping[str, Any],
) -> dict[str, Any]:
    payload = (
        envelope.model_dump(mode="json")
        if isinstance(envelope, AssistantGatewayContextEnvelope)
        else dict(envelope)
    )
    _validate_provider_value(payload, path="$")
    return payload


def _time_summary(context: AssistantContextRead) -> AssistantGatewayTimeSummary:
    by_project: dict[int | None, int] = defaultdict(int)
    by_activity_type: dict[str, int] = defaultdict(int)
    by_date: dict[date, int] = defaultdict(int)
    for time_log in context.time_logs:
        by_project[time_log.project_id] += time_log.duration_minutes
        by_activity_type[time_log.activity_type] += time_log.duration_minutes
        by_date[time_log.date] += time_log.duration_minutes
    return AssistantGatewayTimeSummary(
        total_minutes=sum(item.duration_minutes for item in context.time_logs),
        record_count=len(context.time_logs),
        by_project=[
            AssistantGatewayProjectTimeSummary(
                project_id=project_id,
                duration_minutes=duration,
            )
            for project_id, duration in sorted(
                by_project.items(),
                key=lambda item: (item[0] is None, item[0]),
            )
        ],
        by_activity_type=[
            AssistantGatewayActivityTypeTimeSummary(
                activity_type=activity_type,
                duration_minutes=duration,
            )
            for activity_type, duration in sorted(by_activity_type.items())
        ],
        by_date=[
            AssistantGatewayDateTimeSummary(
                date=recorded_date,
                duration_minutes=duration,
            )
            for recorded_date, duration in sorted(by_date.items())
        ],
    )


def _bounded(
    values: Sequence[Any],
    limit: int,
) -> tuple[Sequence[Any], int]:
    return values[:limit], max(0, len(values) - limit)


def _record_omitted(
    omitted_counts: dict[str, int],
    section: str,
    count: int,
) -> None:
    if count:
        omitted_counts[section] = count


def _validate_provider_value(value: Any, *, path: str) -> None:
    if isinstance(value, Mapping):
        for key, child in value.items():
            normalized_key = str(key).strip().lower()
            if normalized_key in _DENIED_FIELD_NAMES:
                raise AssistantContextPolicyViolation(
                    f"Provider context contains denied field at {path}.{key}"
                )
            _validate_provider_value(child, path=f"{path}.{key}")
        return
    if isinstance(value, list):
        for index, child in enumerate(value):
            _validate_provider_value(child, path=f"{path}[{index}]")
        return
    if isinstance(value, str):
        _reject_sensitive_value(value, path=path)


def _reject_sensitive_value(value: str, *, path: str) -> None:
    if any(pattern.search(value) for pattern in _SENSITIVE_VALUE_PATTERNS):
        raise AssistantContextPolicyViolation(
            f"Provider context contains a sensitive value at {path}"
        )
