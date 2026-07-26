from __future__ import annotations

import sqlite3
from datetime import date

from ..db.repositories import (
    GoalRepository,
    ProjectRepository,
    TimeLogRepository,
    WeeklyPlanRepository,
    WeeklyReviewRepository,
)
from ..schemas import (
    AccountRead,
    AssistantContextRead,
    AssistantReviewSummary,
)
from .activities import ActivityService
from .agent_memory import PreferenceService
from .focus import FocusService
from .tasks import TaskService


class InvalidAssistantContextWindow(Exception):
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
