from typing import Literal

from pydantic import BaseModel, Field


ActivityType = Literal["consuming", "neutral", "restore", "destroy"]
ActivityTypeSource = Literal["user_selected", "ai_suggested", "user_corrected"]
ProjectStage = Literal["startup", "stable", "sprint", "dormant", "wake_up"]
ProjectStatus = Literal["active", "paused", "archived"]


class Goal(BaseModel):
    id: int
    title: str
    description: str = ""
    priority: int = Field(ge=1, default=1)
    active_status: bool = True


class Project(BaseModel):
    id: int
    goal_id: int | None = None
    title: str
    stage: ProjectStage = "startup"
    deadline: str | None = None
    weekly_min_minutes: int = Field(ge=0, default=0)
    weekly_target_minutes: int = Field(ge=0, default=0)
    status: ProjectStatus = "active"
    last_activity_date: str | None = None


class PlannedItem(BaseModel):
    project_id: int | None = None
    title: str
    planned_minutes: int = Field(ge=0)
    priority: int = Field(ge=1, default=1)


class WeeklyPlan(BaseModel):
    week_start: str
    week_end: str
    planned_capacity_minutes: int = Field(ge=0, default=0)
    slack_target_percent: int = Field(ge=0, le=100, default=20)
    items: list[PlannedItem] = []
    note: str = ""


class TimeLog(BaseModel):
    project_id: int | None = None
    date: str
    start_time: str | None = None
    end_time: str | None = None
    duration_minutes: int = Field(ge=0)
    activity_name: str
    activity_type: ActivityType
    type_source: ActivityTypeSource = "user_selected"
    note: str = ""


class DailyReflection(BaseModel):
    date: str
    small_win: str = ""
    mood_note: str = ""
    free_note: str = ""


class WeeklyReviewRequest(BaseModel):
    goals: list[Goal]
    projects: list[Project]
    weekly_plan: WeeklyPlan
    time_logs: list[TimeLog]
    daily_reflections: list[DailyReflection] = []

