from __future__ import annotations

import sqlite3
from collections import defaultdict
from collections.abc import Callable
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from ..schemas import (
    AccountRead,
    AssistantContextRead,
    NextActionAvailableTimeSource,
    NextActionCandidate,
    NextActionEvidence,
    NextActionRead,
    NextActionRequest,
    NextActionUncertainty,
    PlannedItemRead,
    ProjectRead,
    TaskRead,
)
from .assistant import AssistantContextService


class InvalidNextActionTimezone(ValueError):
    pass


class NextActionService:
    MAX_CANDIDATES = 20
    MAX_ALTERNATIVES = 3
    DEFAULT_AVAILABLE_MINUTES = 30
    RESTART_MINUTES = 30
    DORMANCY_DAYS = 14

    def __init__(
        self,
        connection: sqlite3.Connection,
        account: AccountRead,
        *,
        now: Callable[[], datetime] | None = None,
    ) -> None:
        self.connection = connection
        self.account = account
        self._now = now or (lambda: datetime.now(timezone.utc))

    def recommend(self, request: NextActionRequest) -> NextActionRead:
        generated_at = self._normalized_now()
        local_date = self._local_date(generated_at)
        week_start = local_date - timedelta(days=local_date.weekday())
        week_end = week_start + timedelta(days=6)
        context = AssistantContextService(self.connection, self.account).read(
            week_start=week_start,
            week_end=week_end,
        )
        available_minutes, available_source = _available_minutes(context, request)
        uncertainties = self._base_uncertainties(
            context,
            available_source=available_source,
        )
        candidates, has_conflict = self._candidates(
            context,
            local_date=local_date,
            available_minutes=available_minutes,
            uncertainties=uncertainties,
        )
        ordered = sorted(candidates, key=_candidate_sort_key)
        omitted_count = max(0, len(ordered) - self.MAX_CANDIDATES)
        bounded = ordered[: self.MAX_CANDIDATES]
        if omitted_count:
            uncertainties.append(
                NextActionUncertainty(
                    code="candidate_limit_reached",
                    message=(
                        f"{omitted_count} lower-ranked candidates were omitted "
                        "from this result."
                    ),
                )
            )
        if not bounded:
            uncertainties.append(
                NextActionUncertainty(
                    code="no_candidate_evidence",
                    message="No running Focus, open Task, Plan item, or restart evidence is available.",
                )
            )
        return NextActionRead(
            status="conflict" if has_conflict else "ready" if bounded else "empty",
            generated_at=generated_at,
            local_date=local_date,
            timezone=self.account.timezone,
            available_minutes=available_minutes,
            available_time_source=available_source,
            recommendation=bounded[0] if bounded else None,
            alternatives=bounded[1 : 1 + self.MAX_ALTERNATIVES],
            uncertainties=uncertainties,
            candidate_count=len(candidates),
            omitted_candidate_count=omitted_count,
        )

    def _normalized_now(self) -> datetime:
        current = self._now()
        if current.tzinfo is None:
            return current.replace(tzinfo=timezone.utc)
        return current.astimezone(timezone.utc)

    def _local_date(self, current: datetime) -> date:
        try:
            local_zone = ZoneInfo(self.account.timezone)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise InvalidNextActionTimezone from exc
        return current.astimezone(local_zone).date()

    def _base_uncertainties(
        self,
        context: AssistantContextRead,
        *,
        available_source: NextActionAvailableTimeSource,
    ) -> list[NextActionUncertainty]:
        uncertainties = [
            NextActionUncertainty(
                code="calendar_unavailable",
                message=(
                    "No fixed Calendar commitment is included until the "
                    "read-only Calendar adapter is connected."
                ),
            )
        ]
        if available_source != "request":
            uncertainties.append(
                NextActionUncertainty(
                    code="available_time_defaulted",
                    message=(
                        "Available time was derived from a user preference."
                        if available_source == "preference"
                        else "Available time used the 30-minute local default."
                    ),
                )
            )
        if len(context.open_focus_sessions) > 1:
            uncertainties.append(
                NextActionUncertainty(
                    code="multiple_focus_sessions",
                    message=(
                        f"{len(context.open_focus_sessions)} Activities are running; "
                        "the most recently started one is foreground."
                    ),
                )
            )
        if context.latest_review is None:
            uncertainties.append(
                NextActionUncertainty(
                    code="review_missing",
                    message="No stored Review exists for the current local week.",
                )
            )
        elif context.latest_review.stale_at is not None:
            uncertainties.append(
                NextActionUncertainty(
                    code="review_stale",
                    message="The current-week Review is stale and does not affect ranking.",
                )
            )
        return uncertainties

    def _candidates(
        self,
        context: AssistantContextRead,
        *,
        local_date: date,
        available_minutes: int,
        uncertainties: list[NextActionUncertainty],
    ) -> tuple[list[NextActionCandidate], bool]:
        candidates = self._running_focus_candidates(
            context,
            available_minutes=available_minutes,
        )
        project_minutes = _project_minutes(context)
        projects = {project.id: project for project in context.projects}
        goal_priorities = {goal.id: goal.priority for goal in context.goals}
        tasks = {task.id: task for task in context.tasks}
        represented_task_ids: set[int] = set()
        has_conflict = False

        if context.weekly_plan is not None:
            for item in context.weekly_plan.items:
                if item.is_completed:
                    continue
                linked_task = tasks.get(item.task_id) if item.task_id is not None else None
                if item.task_id is not None and linked_task is None:
                    has_conflict = True
                    continue
                if linked_task is not None:
                    represented_task_ids.add(linked_task.id)
                candidates.append(
                    _planned_item_candidate(
                        item,
                        linked_task=linked_task,
                        weekly_plan_id=context.weekly_plan.id,
                        project=projects.get(item.project_id),
                        goal_priorities=goal_priorities,
                        project_minutes=project_minutes,
                        local_date=local_date,
                        available_minutes=available_minutes,
                    )
                )

        if has_conflict:
            uncertainties.append(
                NextActionUncertainty(
                    code="plan_task_conflict",
                    message=(
                        "At least one incomplete Plan item links to a Task that is no "
                        "longer open; conflicting rows were excluded."
                    ),
                )
            )

        for task in context.tasks:
            if task.id in represented_task_ids:
                continue
            candidates.append(
                _task_candidate(
                    task,
                    project=projects.get(task.project_id),
                    goal_priorities=goal_priorities,
                    project_minutes=project_minutes,
                    local_date=local_date,
                    available_minutes=available_minutes,
                )
            )

        for project in context.projects:
            candidate = _project_restart_candidate(
                project,
                goal_priorities=goal_priorities,
                recorded_minutes=project_minutes.get(project.id, 0),
                local_date=local_date,
                available_minutes=available_minutes,
                dormancy_days=self.DORMANCY_DAYS,
                restart_minutes=self.RESTART_MINUTES,
            )
            if candidate is not None:
                candidates.append(candidate)

        review = context.latest_review
        if review is not None and review.stale_at is None and review.next_steps:
            next_step = review.next_steps[0]
            candidates.append(
                NextActionCandidate(
                    candidate_key=f"review:{review.id}:0",
                    kind="review_step",
                    title=next_step.title,
                    score=100,
                    estimated_minutes=min(available_minutes, self.RESTART_MINUTES),
                    review_id=review.id,
                    evidence=[
                        NextActionEvidence(
                            code="review_recommendation",
                            summary="Current deterministic Review next step",
                            value=next_step.title,
                        )
                    ],
                )
            )
        return candidates, has_conflict

    @staticmethod
    def _running_focus_candidates(
        context: AssistantContextRead,
        *,
        available_minutes: int,
    ) -> list[NextActionCandidate]:
        running = sorted(
            context.open_focus_sessions,
            key=lambda item: (item.started_at, item.id),
            reverse=True,
        )
        return [
            NextActionCandidate(
                candidate_key=f"focus:{focus.id}",
                kind="running_focus",
                title=focus.task_title or focus.activity_name,
                score=1200 - index,
                estimated_minutes=available_minutes,
                project_id=focus.project_id,
                task_id=focus.task_id,
                activity_id=focus.activity_id,
                focus_session_id=focus.id,
                evidence=[
                    NextActionEvidence(
                        code="running_now",
                        summary="Activity is already running",
                        value=f"{focus.elapsed_seconds // 60} elapsed minutes",
                    )
                ],
            )
            for index, focus in enumerate(running)
        ]


def _available_minutes(
    context: AssistantContextRead,
    request: NextActionRequest,
) -> tuple[int, NextActionAvailableTimeSource]:
    if request.available_minutes is not None:
        return request.available_minutes, "request"
    supported = [
        preference
        for preference in context.preferences
        if preference.source == "user_stated"
        and preference.scope_type == "global"
        and preference.preference_key == "focus.default_minutes"
        and isinstance(preference.value, int)
        and not isinstance(preference.value, bool)
        and 5 <= preference.value <= 720
    ]
    if supported:
        return max(supported, key=lambda item: item.id).value, "preference"
    return NextActionService.DEFAULT_AVAILABLE_MINUTES, "default"


def _project_minutes(context: AssistantContextRead) -> dict[int, int]:
    minutes: dict[int, int] = defaultdict(int)
    for time_log in context.time_logs:
        if time_log.project_id is not None:
            minutes[time_log.project_id] += time_log.duration_minutes
    return dict(minutes)


def _planned_item_candidate(
    item: PlannedItemRead,
    *,
    linked_task: TaskRead | None,
    weekly_plan_id: int,
    project: ProjectRead | None,
    goal_priorities: dict[int, int],
    project_minutes: dict[int, int],
    local_date: date,
    available_minutes: int,
) -> NextActionCandidate:
    estimated = linked_task.estimated_minutes if linked_task else item.planned_minutes
    score = 500 + max(0, 120 - ((item.priority - 1) * 20))
    evidence = [
        NextActionEvidence(
            code="plan_priority",
            summary="Current-week Plan priority",
            value=str(item.priority),
        )
    ]
    if linked_task is not None:
        score, evidence = _apply_task_evidence(
            linked_task,
            score=score,
            evidence=evidence,
            local_date=local_date,
        )
    score, evidence = _apply_project_evidence(
        project,
        score=score,
        evidence=evidence,
        goal_priorities=goal_priorities,
        recorded_minutes=project_minutes.get(item.project_id, 0),
        local_date=local_date,
    )
    score, evidence = _apply_fit_evidence(
        estimated,
        available_minutes=available_minutes,
        score=score,
        evidence=evidence,
    )
    return NextActionCandidate(
        candidate_key=f"plan-item:{item.id}",
        kind="planned_item",
        title=linked_task.title if linked_task else item.title,
        score=score,
        estimated_minutes=estimated,
        project_id=item.project_id,
        task_id=item.task_id,
        weekly_plan_id=weekly_plan_id,
        planned_item_id=item.id,
        evidence=evidence,
    )


def _task_candidate(
    task: TaskRead,
    *,
    project: ProjectRead | None,
    goal_priorities: dict[int, int],
    project_minutes: dict[int, int],
    local_date: date,
    available_minutes: int,
) -> NextActionCandidate:
    estimated = task.estimated_minutes or available_minutes
    score = 350 + max(0, 100 - ((task.priority - 1) * 15))
    evidence = [
        NextActionEvidence(
            code="task_priority",
            summary="Open Task priority",
            value=str(task.priority),
        )
    ]
    score, evidence = _apply_task_evidence(
        task,
        score=score,
        evidence=evidence,
        local_date=local_date,
    )
    score, evidence = _apply_project_evidence(
        project,
        score=score,
        evidence=evidence,
        goal_priorities=goal_priorities,
        recorded_minutes=project_minutes.get(task.project_id, 0),
        local_date=local_date,
    )
    score, evidence = _apply_fit_evidence(
        estimated,
        available_minutes=available_minutes,
        score=score,
        evidence=evidence,
    )
    return NextActionCandidate(
        candidate_key=f"task:{task.id}",
        kind="open_task",
        title=task.title,
        score=score,
        estimated_minutes=estimated,
        project_id=task.project_id,
        task_id=task.id,
        evidence=evidence,
    )


def _project_restart_candidate(
    project: ProjectRead,
    *,
    goal_priorities: dict[int, int],
    recorded_minutes: int,
    local_date: date,
    available_minutes: int,
    dormancy_days: int,
    restart_minutes: int,
) -> NextActionCandidate | None:
    inactive_days = (
        (local_date - project.last_activity_date).days
        if project.last_activity_date is not None
        else dormancy_days
    )
    minimum_gap = max(0, project.weekly_min_minutes - recorded_minutes)
    if minimum_gap == 0 and inactive_days < dormancy_days:
        return None
    score = 250
    evidence: list[NextActionEvidence] = []
    score, evidence = _apply_project_evidence(
        project,
        score=score,
        evidence=evidence,
        goal_priorities=goal_priorities,
        recorded_minutes=recorded_minutes,
        local_date=local_date,
    )
    estimated = min(available_minutes, restart_minutes)
    score, evidence = _apply_fit_evidence(
        estimated,
        available_minutes=available_minutes,
        score=score,
        evidence=evidence,
    )
    return NextActionCandidate(
        candidate_key=f"project-restart:{project.id}",
        kind="project_restart",
        title=f"Restart {project.title}",
        score=score,
        estimated_minutes=estimated,
        project_id=project.id,
        evidence=evidence,
    )


def _apply_task_evidence(
    task: TaskRead,
    *,
    score: int,
    evidence: list[NextActionEvidence],
    local_date: date,
) -> tuple[int, list[NextActionEvidence]]:
    if task.status == "in_progress":
        score += 80
        evidence.append(
            NextActionEvidence(
                code="task_in_progress",
                summary="Task is already in progress",
                value=task.status,
            )
        )
    if task.due_date is not None:
        days_until_due = (task.due_date - local_date).days
        if days_until_due < 0:
            score += 180
        elif days_until_due == 0:
            score += 140
        elif days_until_due <= 2:
            score += 80
        elif days_until_due <= 7:
            score += 40
        evidence.append(
            NextActionEvidence(
                code="due_date",
                summary="Task due date",
                value=task.due_date.isoformat(),
            )
        )
    return score, evidence


def _apply_project_evidence(
    project: ProjectRead | None,
    *,
    score: int,
    evidence: list[NextActionEvidence],
    goal_priorities: dict[int, int],
    recorded_minutes: int,
    local_date: date,
) -> tuple[int, list[NextActionEvidence]]:
    if project is None:
        return score, evidence
    if project.goal_id is not None and project.goal_id in goal_priorities:
        priority = goal_priorities[project.goal_id]
        score += max(0, 80 - ((priority - 1) * 15))
        evidence.append(
            NextActionEvidence(
                code="goal_priority",
                summary="Goal priority",
                value=str(priority),
            )
        )
    minimum_gap = max(0, project.weekly_min_minutes - recorded_minutes)
    if minimum_gap:
        score += min(120, max(20, minimum_gap // 5))
        evidence.append(
            NextActionEvidence(
                code="weekly_minimum_gap",
                summary="Minutes remaining to weekly minimum",
                value=str(minimum_gap),
            )
        )
    inactive_days = (
        (local_date - project.last_activity_date).days
        if project.last_activity_date is not None
        else NextActionService.DORMANCY_DAYS
    )
    if inactive_days >= NextActionService.DORMANCY_DAYS:
        score += min(100, inactive_days * 4)
        evidence.append(
            NextActionEvidence(
                code="project_inactivity",
                summary="Project inactivity",
                value=f"{inactive_days} days",
            )
        )
    return score, evidence


def _apply_fit_evidence(
    estimated_minutes: int,
    *,
    available_minutes: int,
    score: int,
    evidence: list[NextActionEvidence],
) -> tuple[int, list[NextActionEvidence]]:
    if estimated_minutes <= available_minutes:
        score += 60
        evidence.append(
            NextActionEvidence(
                code="fits_available_time",
                summary="Fits the available time",
                value=f"{estimated_minutes}/{available_minutes} minutes",
            )
        )
    else:
        score -= 120
        evidence.append(
            NextActionEvidence(
                code="exceeds_available_time",
                summary="Estimated duration exceeds available time",
                value=f"{estimated_minutes}/{available_minutes} minutes",
            )
        )
    return score, evidence


_KIND_ORDER = {
    "running_focus": 0,
    "planned_item": 1,
    "open_task": 2,
    "project_restart": 3,
    "review_step": 4,
}


def _candidate_sort_key(candidate: NextActionCandidate) -> tuple[int, int, str]:
    return (-candidate.score, _KIND_ORDER[candidate.kind], candidate.candidate_key)
