from __future__ import annotations

from datetime import date, datetime, time
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


ActivityType = Literal["consuming", "neutral", "restore", "destroy"]
ActivityTypeSource = Literal["user_selected", "ai_suggested", "user_corrected"]
ProjectStage = Literal["startup", "stable", "sprint", "dormant", "wake_up"]
ProjectStatus = Literal["active", "paused", "archived"]
ReviewMode = Literal["deterministic_first", "supportive_text"]
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


class LocalUserCreate(APIModel):
    display_name: str = Field(min_length=1, max_length=80)
    timezone: str = Field(min_length=1, max_length=80, default="UTC")
    locale: str = Field(min_length=1, max_length=32, default="en")

    @field_validator("display_name", "timezone", "locale")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped


class LocalUserRead(LocalUserCreate):
    id: int
    created_at: datetime
    updated_at: datetime


class AccountRegister(APIModel):
    email: EmailStr
    password: str = Field(min_length=15, max_length=256, repr=False)
    display_name: str = Field(min_length=1, max_length=80)
    timezone: str = Field(min_length=1, max_length=80, default="UTC")
    locale: str = Field(min_length=1, max_length=32, default="en")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().casefold()

    @field_validator("display_name", "timezone", "locale")
    @classmethod
    def strip_account_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped


class AccountLogin(APIModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256, repr=False)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().casefold()


class AccountRead(APIModel):
    id: int
    email: EmailStr
    display_name: str
    timezone: str
    locale: str
    created_at: datetime
    updated_at: datetime


class AuthTokenResponse(APIModel):
    access_token: str = Field(repr=False)
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = Field(gt=0)
    user: AccountRead


class AccountUpdate(APIModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=80)
    timezone: str | None = Field(default=None, min_length=1, max_length=80)
    locale: str | None = Field(default=None, min_length=1, max_length=32)

    @field_validator("display_name", "timezone", "locale")
    @classmethod
    def strip_optional_account_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped

    @model_validator(mode="after")
    def require_change(self) -> AccountUpdate:
        if all(
            getattr(self, field) is None
            for field in ("display_name", "timezone", "locale")
        ):
            raise ValueError("at least one profile field is required")
        return self


class ChangePasswordRequest(APIModel):
    current_password: str = Field(min_length=1, max_length=256, repr=False)
    new_password: str = Field(min_length=15, max_length=256, repr=False)

    @model_validator(mode="after")
    def require_new_password(self) -> ChangePasswordRequest:
        if self.current_password == self.new_password:
            raise ValueError("new_password must differ from current_password")
        return self


class ChangeEmailRequest(APIModel):
    email: EmailStr
    current_password: str = Field(min_length=1, max_length=256, repr=False)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().casefold()


class DeleteAccountRequest(APIModel):
    current_password: str = Field(min_length=1, max_length=256, repr=False)
    confirmation: Literal["DELETE"]


class GoalCreate(APIModel):
    title: str = Field(min_length=1)
    description: str = ""
    priority: int = Field(ge=1, default=1)
    active_status: bool = True


class Goal(GoalCreate):
    id: int


class GoalRead(Goal):
    user_id: int
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
    user_id: int
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
    user_id: int
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
    user_id: int
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
    user_id: int
    created_at: datetime
    updated_at: datetime


class MobileTimeLogImportRecord(APIModel):
    source_record_id: str | None = None
    activity_id: int | None = None
    project_id: int | None = None
    date: date
    start_time: time | None = None
    end_time: time | None = None
    duration_minutes: int = Field(gt=0)
    activity_name: str = Field(min_length=1)
    activity_type: str = Field(min_length=1)
    type_source: ActivityTypeSource = "user_selected"
    note: str = ""

    @model_validator(mode="after")
    def validate_time_pair(self) -> MobileTimeLogImportRecord:
        if (self.start_time is None) != (self.end_time is None):
            raise ValueError("start_time and end_time must be provided together")
        return self


class MobileTimeLogImportRequest(APIModel):
    time_logs: list[MobileTimeLogImportRecord] = Field(min_length=1)


class MobileTimeLogImportSummary(APIModel):
    imported: int
    skipped: int
    needs_mapping: int


class DailyReflectionCreate(APIModel):
    date: date
    small_win: str = ""
    mood_note: str = ""
    free_note: str = ""


class DailyReflection(DailyReflectionCreate):
    pass


class DailyReflectionRead(DailyReflectionCreate):
    id: int
    user_id: int
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
    user_id: int
    model_name: str | None = None
    created_at: datetime
    updated_at: datetime
