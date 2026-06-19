from __future__ import annotations

from datetime import date, datetime, time
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


ActivityType = Literal["consuming", "neutral", "restore", "destroy"]
ActivityTypeSource = Literal["user_selected", "ai_suggested", "user_corrected"]
ProjectStage = Literal["startup", "stable", "sprint", "dormant", "wake_up"]
ProjectStatus = Literal["active", "paused", "archived"]
ReviewMode = Literal["deterministic_first"]
RiskType = Literal[
    "alignment_gap",
    "plan_drift",
    "dormancy_risk",
    "overload_risk",
    "slack_risk",
    "destroy_pattern",
]
RiskSeverity = Literal["low", "medium", "high"]


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")


class GoalCreate(APIModel):
    title: str = Field(min_length=1)
    description: str = ""
    priority: int = Field(ge=1, default=1)
    active_status: bool = True


class Goal(GoalCreate):
    id: int


class GoalRead(Goal):
    created_at: datetime
    updated_at: datetime


class ProjectCreate(APIModel):
    goal_id: int | None = None
    title: str = Field(min_length=1)
    stage: ProjectStage = "startup"
    deadline: date | None = None
    weekly_min_minutes: int = Field(ge=0, default=0)
    weekly_target_minutes: int = Field(ge=0, default=0)
    status: ProjectStatus = "active"
    last_activity_date: date | None = None


class Project(ProjectCreate):
    id: int


class ProjectRead(Project):
    created_at: datetime
    updated_at: datetime


class ActivityCreate(APIModel):
    project_id: int | None = None
    name: str = Field(min_length=1)
    description: str = ""
    activity_type: ActivityType
    type_source: ActivityTypeSource = "user_selected"


class ActivityRead(ActivityCreate):
    id: int
    created_at: datetime
    updated_at: datetime


class PlannedItemCreate(APIModel):
    project_id: int | None = None
    title: str = Field(min_length=1)
    planned_minutes: int = Field(gt=0)
    priority: int = Field(ge=1, default=1)
    is_completed: bool = False


class PlannedItem(PlannedItemCreate):
    pass


class PlannedItemRead(PlannedItemCreate):
    id: int
    weekly_plan_id: int
    created_at: datetime
    updated_at: datetime


class WeeklyPlanCreate(APIModel):
    week_start: date
    week_end: date
    planned_capacity_minutes: int = Field(ge=0, default=0)
    slack_target_percent: int = Field(ge=0, le=100, default=20)
    items: list[PlannedItemCreate] = Field(default_factory=list)
    note: str = ""

    @model_validator(mode="after")
    def validate_week_range(self) -> WeeklyPlanCreate:
        if self.week_end < self.week_start:
            raise ValueError("week_end must be on or after week_start")
        return self


class WeeklyPlan(WeeklyPlanCreate):
    items: list[PlannedItem] = Field(default_factory=list)


class WeeklyPlanRead(WeeklyPlanCreate):
    id: int
    items: list[PlannedItemRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class TimeLogCreate(APIModel):
    activity_id: int | None = None
    project_id: int | None = None
    date: date
    start_time: time | None = None
    end_time: time | None = None
    duration_minutes: int = Field(gt=0)
    activity_name: str = Field(min_length=1)
    activity_type: ActivityType
    type_source: ActivityTypeSource = "user_selected"
    note: str = ""

    @model_validator(mode="after")
    def validate_time_pair(self) -> TimeLogCreate:
        if (self.start_time is None) != (self.end_time is None):
            raise ValueError("start_time and end_time must be provided together")
        return self


class TimeLog(TimeLogCreate):
    pass


class TimeLogRead(TimeLogCreate):
    id: int
    created_at: datetime
    updated_at: datetime


class DailyReflectionCreate(APIModel):
    date: date
    small_win: str = ""
    mood_note: str = ""
    free_note: str = ""


class DailyReflection(DailyReflectionCreate):
    pass


class DailyReflectionRead(DailyReflectionCreate):
    id: int
    created_at: datetime
    updated_at: datetime


class WeeklyReviewRequest(APIModel):
    goals: list[Goal]
    projects: list[Project]
    weekly_plan: WeeklyPlan
    time_logs: list[TimeLog]
    daily_reflections: list[DailyReflection] = Field(default_factory=list)


class ReviewFinding(APIModel):
    title: str
    evidence: str


class ReviewRisk(APIModel):
    type: RiskType
    severity: RiskSeverity
    evidence: str


class ReviewRecommendation(APIModel):
    title: str
    reason: str


class WeeklyReviewResult(APIModel):
    week_start: date
    week_end: date
    wins: list[ReviewFinding] = Field(default_factory=list)
    insights: list[ReviewFinding] = Field(default_factory=list)
    risk_flags: list[ReviewRisk] = Field(default_factory=list)
    next_steps: list[ReviewRecommendation] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    generated_text: str


class WeeklyReviewGenerateRequest(APIModel):
    week_start: date
    week_end: date
    mode: ReviewMode = "deterministic_first"

    @model_validator(mode="after")
    def validate_week_range(self) -> WeeklyReviewGenerateRequest:
        if self.week_end < self.week_start:
            raise ValueError("week_end must be on or after week_start")
        return self


class WeeklyReviewRead(WeeklyReviewResult):
    id: int
    model_name: str | None = None
    created_at: datetime
    updated_at: datetime
