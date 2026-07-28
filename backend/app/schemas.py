from __future__ import annotations

from datetime import date, datetime, time
from datetime import date as DateType
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


ActivityType = Literal["consuming", "neutral", "restore", "destroy"]
ActivityTypeSource = Literal["user_selected", "ai_suggested", "user_corrected"]
ProjectStage = Literal["startup", "stable", "sprint", "dormant", "wake_up"]
ProjectStatus = Literal["active", "paused", "archived"]
TaskStatus = Literal["open", "in_progress", "completed", "cancelled"]
TaskCreationSource = Literal["user", "assistant_approved", "imported"]
FocusSessionStatus = Literal["running", "completed", "cancelled"]
FocusSessionCommandName = Literal["end", "cancel"]
PreferenceSource = Literal["user_stated", "inferred"]
PreferenceScopeType = Literal["global", "goal", "project", "task", "activity"]
ProposalType = Literal["weekly_plan_adjustment", "task_create", "reflection", "generic"]
ProposalSource = Literal["deterministic", "assistant"]
ProposalStatus = Literal["pending", "approved", "rejected", "expired", "executed", "undone"]
ProposalDecisionType = Literal["approve", "edit", "reject", "expire"]
AgentActionStatus = Literal["pending", "succeeded", "failed", "undone"]
ProposalOutcomeResult = Literal["completed", "partial", "not_completed", "dismissed"]
IntegrationChannelType = Literal["local_test", "openclaw", "whatsapp"]
IntegrationScope = Literal[
    "context:read",
    "proposal:create",
    "proposal:decide",
    "action:execute",
    "action:undo",
]
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


class IntegrationPairCreate(APIModel):
    label: str = Field(min_length=1, max_length=80)
    channel_type: IntegrationChannelType
    external_identity: str = Field(min_length=1, max_length=256, repr=False)
    scopes: list[IntegrationScope] = Field(min_length=1, max_length=5)
    expires_in_seconds: int = Field(default=86400, ge=300, le=2592000)

    @field_validator("label", "external_identity")
    @classmethod
    def strip_integration_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped

    @field_validator("scopes")
    @classmethod
    def require_unique_scopes(
        cls, value: list[IntegrationScope]
    ) -> list[IntegrationScope]:
        if len(set(value)) != len(value):
            raise ValueError("scopes must be unique")
        return sorted(value)


class IntegrationCredentialRead(APIModel):
    id: int
    user_id: int
    label: str
    channel_type: IntegrationChannelType
    scopes: list[IntegrationScope]
    token_prefix: str
    expires_at: datetime
    revoked_at: datetime | None = None
    last_used_at: datetime | None = None
    created_at: datetime


class IntegrationPairRead(APIModel):
    credential: IntegrationCredentialRead
    access_token: str = Field(repr=False)


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


class TaskCreate(APIModel):
    project_id: int
    title: str = Field(min_length=1, max_length=240)
    description: str = Field(default="", max_length=4000)
    priority: int = Field(ge=1, default=3)
    estimated_minutes: int | None = Field(default=None, gt=0)
    due_date: date | None = None

    @field_validator("title")
    @classmethod
    def strip_task_title(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped


class TaskUpdate(APIModel):
    expected_version: int = Field(ge=1)
    title: str | None = Field(default=None, min_length=1, max_length=240)
    description: str | None = Field(default=None, max_length=4000)
    priority: int | None = Field(default=None, ge=1)
    estimated_minutes: int | None = Field(default=None, gt=0)
    due_date: date | None = None
    status: TaskStatus | None = None
    archived: bool | None = None

    @field_validator("title")
    @classmethod
    def strip_optional_task_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped

    @model_validator(mode="after")
    def validate_task_patch(self) -> TaskUpdate:
        changed = self.model_fields_set - {"expected_version"}
        if not changed:
            raise ValueError("at least one task field is required")
        required_values = ("title", "priority", "status", "archived")
        if any(field in changed and getattr(self, field) is None for field in required_values):
            raise ValueError("title, priority, status, and archived cannot be null")
        return self


class TaskRead(APIModel):
    id: int
    user_id: int
    project_id: int
    title: str
    description: str
    status: TaskStatus
    priority: int
    estimated_minutes: int | None
    due_date: date | None
    created_source: TaskCreationSource
    completed_at: datetime | None
    archived_at: datetime | None
    version: int
    created_at: datetime
    updated_at: datetime


class ActivityCreate(APIModel):
    project_id: int | None = None
    name: str = Field(min_length=1, max_length=240)
    description: str = Field(default="", max_length=4000)
    activity_type: ActivityType
    type_source: Literal["user_selected"] = "user_selected"

    @field_validator("name")
    @classmethod
    def strip_activity_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped


class ActivityUpdate(APIModel):
    expected_version: int = Field(ge=1)
    project_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=240)
    description: str | None = Field(default=None, max_length=4000)
    activity_type: ActivityType | None = None

    @field_validator("name")
    @classmethod
    def strip_optional_activity_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped

    @model_validator(mode="after")
    def validate_activity_patch(self) -> ActivityUpdate:
        changed = self.model_fields_set - {"expected_version"}
        if not changed:
            raise ValueError("at least one activity field is required")
        required_values = ("name", "activity_type")
        if any(field in changed and getattr(self, field) is None for field in required_values):
            raise ValueError("name and activity_type cannot be null")
        return self


class ActivityRead(APIModel):
    id: int
    user_id: int
    project_id: int | None
    name: str
    description: str
    activity_type: ActivityType
    type_source: ActivityTypeSource
    version: int
    created_at: datetime
    updated_at: datetime


class PlannedItemCreate(APIModel):
    project_id: int | None = None
    task_id: int | None = None
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


class FocusSessionCreate(APIModel):
    activity_id: int = Field(gt=0)
    task_id: int | None = Field(default=None, gt=0)


class FocusSessionCommand(APIModel):
    command: FocusSessionCommandName
    expected_version: int = Field(ge=1)


class FocusSessionRead(APIModel):
    id: int
    user_id: int
    activity_id: int
    task_id: int | None
    project_id: int | None
    activity_name: str
    activity_type: ActivityType
    type_source: ActivityTypeSource
    task_title: str | None
    timezone: str
    status: FocusSessionStatus
    accumulated_seconds: int = Field(ge=0)
    current_run_started_at: datetime | None
    elapsed_seconds: int = Field(ge=0)
    version: int = Field(ge=1)
    started_at: datetime
    completed_at: datetime | None
    cancelled_at: datetime | None
    created_at: datetime
    updated_at: datetime


class TimeLogCreate(APIModel):
    activity_id: int | None = None
    project_id: int | None = None
    task_id: int | None = None
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


class TimeLogBatchCreate(APIModel):
    time_logs: list[TimeLogCreate] = Field(min_length=1, max_length=32)


class TimeLog(TimeLogCreate):
    pass


class TimeLogRead(APIModel):
    id: int
    user_id: int
    activity_id: int | None = None
    project_id: int | None = None
    task_id: int | None = None
    focus_session_id: int | None = None
    date: date
    start_time: time | None = None
    end_time: time | None = None
    duration_minutes: int = Field(ge=0)
    duration_seconds: int = Field(gt=0)
    activity_name: str
    activity_type: ActivityType
    type_source: ActivityTypeSource
    task_title: str | None = None
    note: str = ""
    version: int = Field(ge=1)
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class TimeLogUpdate(APIModel):
    expected_version: int = Field(ge=1)
    activity_id: int | None = Field(default=None, gt=0)
    project_id: int | None = Field(default=None, gt=0)
    task_id: int | None = Field(default=None, gt=0)
    date: DateType | None = None
    start_time: time | None = None
    end_time: time | None = None
    duration_minutes: int | None = Field(default=None, ge=0)
    duration_seconds: int | None = Field(default=None, gt=0)
    activity_name: str | None = Field(default=None, min_length=1, max_length=240)
    activity_type: ActivityType | None = None
    note: str | None = Field(default=None, max_length=4000)
    reason: str = Field(default="", max_length=1000)

    @field_validator("activity_name")
    @classmethod
    def strip_optional_time_log_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped

    @model_validator(mode="after")
    def validate_time_log_patch(self) -> TimeLogUpdate:
        changed = self.model_fields_set - {"expected_version", "reason"}
        if not changed:
            raise ValueError("at least one time-log field is required")
        required_values = {
            "date",
            "duration_minutes",
            "duration_seconds",
            "activity_name",
            "activity_type",
            "note",
        }
        if any(field in changed and getattr(self, field) is None for field in required_values):
            raise ValueError("required time-log fields cannot be null")
        if (
            "duration_minutes" in changed
            and "duration_seconds" in changed
            and self.duration_minutes != (self.duration_seconds + 30) // 60
        ):
            raise ValueError("duration values are inconsistent")
        return self


class TimeLogUndoRequest(APIModel):
    expected_version: int = Field(ge=1)


class ReviewWeekRange(APIModel):
    week_start: date
    week_end: date


class TimeLogMutationResult(APIModel):
    time_log: TimeLogRead
    revision_id: int
    affected_review_weeks: list[ReviewWeekRange] = Field(default_factory=list)


class FocusSessionCommandResponse(APIModel):
    session: FocusSessionRead
    time_logs: list[TimeLogRead] = Field(default_factory=list)


class MobileTimeLogImportRecord(APIModel):
    source_record_id: str | None = None
    activity_id: int | None = None
    project_id: int | None = None
    task_id: int | None = None
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


class PreferenceCreate(APIModel):
    source: PreferenceSource
    preference_key: str = Field(min_length=1, max_length=120)
    value: Any
    scope_type: PreferenceScopeType = "global"
    scope_ref_id: int | None = Field(default=None, gt=0)
    provenance: dict[str, Any] = Field(default_factory=dict)
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    review_after: datetime | None = None
    expires_at: datetime | None = None

    @field_validator("preference_key")
    @classmethod
    def strip_preference_key(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped

    @model_validator(mode="after")
    def validate_preference_source_and_scope(self) -> PreferenceCreate:
        if self.scope_type == "global" and self.scope_ref_id is not None:
            raise ValueError("global preferences cannot have scope_ref_id")
        if self.scope_type != "global" and self.scope_ref_id is None:
            raise ValueError("scoped preferences require scope_ref_id")
        if self.source == "user_stated" and self.confidence is not None:
            raise ValueError("user-stated preferences do not use confidence")
        if self.source == "inferred":
            if self.confidence is None:
                raise ValueError("inferred preferences require confidence")
            if self.review_after is None and self.expires_at is None:
                raise ValueError(
                    "inferred preferences require review_after or expires_at"
                )
        return self


class PreferenceRead(PreferenceCreate):
    id: int
    user_id: int
    version: int = Field(ge=1)
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class PreferenceUserCreate(APIModel):
    preference_key: str = Field(min_length=1, max_length=120)
    value: Any
    scope_type: PreferenceScopeType = "global"
    scope_ref_id: int | None = Field(default=None, gt=0)

    @field_validator("preference_key")
    @classmethod
    def strip_user_preference_key(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped

    @model_validator(mode="after")
    def validate_user_preference_scope(self) -> PreferenceUserCreate:
        if self.scope_type == "global" and self.scope_ref_id is not None:
            raise ValueError("global preferences cannot have scope_ref_id")
        if self.scope_type != "global" and self.scope_ref_id is None:
            raise ValueError("scoped preferences require scope_ref_id")
        return self


class PreferenceCorrection(APIModel):
    expected_version: int = Field(ge=1)
    value: Any
    reason: str = Field(default="", max_length=1000)


class PreferenceRestoreRequest(APIModel):
    expected_version: int = Field(ge=1)
    reason: str = Field(default="", max_length=1000)


class PreferenceRevisionRead(APIModel):
    id: int
    user_id: int
    preference_id: int
    action: Literal["update", "delete", "restore", "undo"]
    before: dict[str, Any]
    after: dict[str, Any]
    actor_type: Literal["user", "assistant_approved"]
    reason: str
    created_at: datetime


class PreferenceDetailRead(APIModel):
    preference: PreferenceRead
    revisions: list[PreferenceRevisionRead] = Field(default_factory=list)


class PreferenceMutationResult(APIModel):
    preference: PreferenceRead
    revision_id: int


class ProposalCreate(APIModel):
    proposal_type: ProposalType
    source: ProposalSource = "deterministic"
    title: str = Field(min_length=1, max_length=240)
    rationale: str = Field(default="", max_length=4000)
    evidence: list[dict[str, Any]] = Field(default_factory=list)
    before: dict[str, Any]
    after: dict[str, Any]
    expires_at: datetime | None = None

    @field_validator("title")
    @classmethod
    def strip_proposal_title(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped


class ProposalRead(ProposalCreate):
    id: int
    user_id: int
    status: ProposalStatus
    version: int = Field(ge=1)
    created_at: datetime
    updated_at: datetime


class ProposalDraftCreate(APIModel):
    proposal_type: ProposalType
    title: str = Field(min_length=1, max_length=240)
    rationale: str = Field(default="", max_length=4000)
    evidence: list[dict[str, Any]] = Field(default_factory=list)
    before: dict[str, Any]
    after: dict[str, Any]
    expires_at: datetime | None = None

    @field_validator("title")
    @classmethod
    def strip_draft_proposal_title(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped


class ProposalDecisionCreate(APIModel):
    decision: ProposalDecisionType
    decided_after: dict[str, Any] | None = None
    reason: str = Field(default="", max_length=1000)

    @model_validator(mode="after")
    def validate_decision_payload(self) -> ProposalDecisionCreate:
        if self.decision == "edit" and self.decided_after is None:
            raise ValueError("edit decisions require decided_after")
        return self


class ProposalDecisionRead(ProposalDecisionCreate):
    id: int
    user_id: int
    proposal_id: int
    created_at: datetime


class ProposalDecisionRequest(ProposalDecisionCreate):
    expected_version: int = Field(ge=1)


class ChannelProposalDecisionRequest(APIModel):
    """The intentionally narrow decision shape available to channel adapters."""

    expected_version: int = Field(ge=1)
    decision: Literal["approve", "reject"]
    reason: str = Field(default="", max_length=1000)


class ChannelProposalExecutionRequest(APIModel):
    expected_version: int = Field(ge=1)


class ChannelProposalUndoRequest(APIModel):
    expected_version: int = Field(ge=1)


class AgentActionCreate(APIModel):
    proposal_id: int = Field(gt=0)
    decision_id: int | None = Field(default=None, gt=0)
    operation: str = Field(min_length=1, max_length=120)
    request: dict[str, Any]
    idempotency_key: str = Field(min_length=8, max_length=200)
    reversible: bool = False
    undo_of_action_id: int | None = Field(default=None, gt=0)

    @field_validator("operation", "idempotency_key")
    @classmethod
    def strip_action_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped


class AgentActionRead(AgentActionCreate):
    id: int
    user_id: int
    result: dict[str, Any] | None = None
    verification: dict[str, Any] | None = None
    status: AgentActionStatus
    error_message: str
    executed_at: datetime | None = None
    undone_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ProposalOutcomeCreate(APIModel):
    proposal_id: int = Field(gt=0)
    action_id: int | None = Field(default=None, gt=0)
    result: ProposalOutcomeResult
    usefulness: int | None = Field(default=None, ge=1, le=5)
    actual_duration_minutes: int | None = Field(default=None, ge=0)
    energy_feedback: ActivityType | None = None
    note: str = Field(default="", max_length=4000)


class ProposalOutcomeRead(ProposalOutcomeCreate):
    id: int
    user_id: int
    created_at: datetime


class ProposalOutcomeFeedback(APIModel):
    action_id: int | None = Field(default=None, gt=0)
    result: ProposalOutcomeResult
    usefulness: int | None = Field(default=None, ge=1, le=5)
    actual_duration_minutes: int | None = Field(default=None, ge=0)
    energy_feedback: ActivityType | None = None
    note: str = Field(default="", max_length=4000)


class ProposalDetailRead(APIModel):
    proposal: ProposalRead
    decisions: list[ProposalDecisionRead] = Field(default_factory=list)
    actions: list[AgentActionRead] = Field(default_factory=list)
    outcomes: list[ProposalOutcomeRead] = Field(default_factory=list)


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
    stale_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class AssistantReviewSummary(APIModel):
    id: int
    week_start: date
    week_end: date
    wins: list[ReviewFinding] = Field(default_factory=list)
    risk_flags: list[ReviewRisk] = Field(default_factory=list)
    next_steps: list[ReviewRecommendation] = Field(default_factory=list)
    stale_at: datetime | None = None
    updated_at: datetime


class AssistantContextRead(APIModel):
    context_version: Literal["v1"] = "v1"
    user_id: int
    timezone: str
    locale: str
    week_start: date
    week_end: date
    goals: list[GoalRead] = Field(default_factory=list)
    projects: list[ProjectRead] = Field(default_factory=list)
    tasks: list[TaskRead] = Field(default_factory=list)
    activities: list[ActivityRead] = Field(default_factory=list)
    weekly_plan: WeeklyPlanRead | None = None
    open_focus_sessions: list[FocusSessionRead] = Field(default_factory=list)
    time_logs: list[TimeLogRead] = Field(default_factory=list)
    latest_review: AssistantReviewSummary | None = None
    preferences: list[PreferenceRead] = Field(default_factory=list)


class AssistantWeeklyPlanProposalRequest(APIModel):
    review_week_start: date
    review_week_end: date
    target_week_start: date
    target_week_end: date

    @model_validator(mode="after")
    def validate_windows(self) -> AssistantWeeklyPlanProposalRequest:
        for label, start, end in (
            ("review", self.review_week_start, self.review_week_end),
            ("target", self.target_week_start, self.target_week_end),
        ):
            window_days = (end - start).days + 1
            if window_days < 1 or window_days > 31:
                raise ValueError(f"{label} window must cover between 1 and 31 days")
        return self


class AssistantProposalExecutionRequest(APIModel):
    expected_version: int = Field(ge=1)


class AssistantWeeklyPlanExecutionRead(APIModel):
    proposal: ProposalRead
    action: AgentActionRead
    weekly_plan: WeeklyPlanRead


class AssistantWeeklyPlanUndoRequest(APIModel):
    expected_version: int = Field(ge=1)


class AssistantWeeklyPlanUndoRead(APIModel):
    proposal: ProposalRead
    action: AgentActionRead
    undone_action: AgentActionRead
    weekly_plan: WeeklyPlanRead | None = None
