from __future__ import annotations

import sqlite3

from review_engine.rules import analyze_week

from ..db.repositories import (
    DailyReflectionRepository,
    GoalRepository,
    ProjectRepository,
    TimeLogRepository,
    WeeklyPlanRepository,
    WeeklyReviewRepository,
)
from ..schemas import WeeklyReviewGenerateRequest, WeeklyReviewRead, WeeklyReviewResult


class WeeklyPlanNotFound(LookupError):
    pass


class ReviewService:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def generate(self, request: WeeklyReviewGenerateRequest) -> WeeklyReviewRead:
        week_start = request.week_start.isoformat()
        week_end = request.week_end.isoformat()
        plan = WeeklyPlanRepository(self.connection).get_by_week(week_start, week_end)
        if plan is None:
            raise WeeklyPlanNotFound(
                f"No weekly plan exists for {week_start} through {week_end}"
            )

        payload = {
            "goals": [
                item.model_dump(mode="json")
                for item in GoalRepository(self.connection).list()
            ],
            "projects": [
                item.model_dump(mode="json")
                for item in ProjectRepository(self.connection).list()
            ],
            "weekly_plan": plan.model_dump(mode="json"),
            "time_logs": [
                item.model_dump(mode="json")
                for item in TimeLogRepository(self.connection).list_between(
                    week_start, week_end
                )
            ],
            "daily_reflections": [
                item.model_dump(mode="json")
                for item in DailyReflectionRepository(self.connection).list_between(
                    week_start, week_end
                )
            ],
        }
        result = WeeklyReviewResult.model_validate(analyze_week(payload))
        return WeeklyReviewRepository(self.connection).save(result)
