from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal


ProjectStage = Literal["startup", "stable", "sprint", "dormant", "wake_up"]
HealthStatus = Literal[
    "healthy",
    "maintenance",
    "drift",
    "overheated",
    "dormant",
    "wake_up_risk",
]

WAKE_UP_INACTIVE_DAYS = 21


@dataclass(frozen=True)
class StageBaseline:
    min_minutes: int
    target_minutes: int
    max_minutes: int


@dataclass(frozen=True)
class ProjectHealth:
    project_id: int
    project_title: str
    stage: str
    status: HealthStatus
    actual_minutes: int
    min_minutes: int
    target_minutes: int
    max_minutes: int
    inactive_days: int | None
    reason: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "project_id": self.project_id,
            "project_title": self.project_title,
            "stage": self.stage,
            "status": self.status,
            "actual_minutes": self.actual_minutes,
            "min_minutes": self.min_minutes,
            "target_minutes": self.target_minutes,
            "max_minutes": self.max_minutes,
            "inactive_days": self.inactive_days,
            "reason": self.reason,
        }


STAGE_BASELINES: dict[str, StageBaseline] = {
    "startup": StageBaseline(min_minutes=120, target_minutes=360, max_minutes=600),
    "stable": StageBaseline(min_minutes=30, target_minutes=120, max_minutes=240),
    "sprint": StageBaseline(min_minutes=240, target_minutes=480, max_minutes=720),
    "dormant": StageBaseline(min_minutes=0, target_minutes=0, max_minutes=60),
    "wake_up": StageBaseline(min_minutes=30, target_minutes=90, max_minutes=180),
}


def evaluate_project_health(
    project: dict[str, Any],
    actual_minutes: int,
    inactive_days: int | None = None,
) -> ProjectHealth:
    stage = str(project.get("stage") or "stable")
    baseline = effective_stage_baseline(project)
    actual = max(0, int(actual_minutes or 0))

    if project.get("status") != "active" or stage == "dormant":
        status: HealthStatus = "dormant"
        reason = "Project is not expected to receive active weekly time."
    elif stage == "wake_up" and _needs_wake_up(actual, baseline.min_minutes, inactive_days):
        status = "wake_up_risk"
        reason = "Wake-up project needs a visible restart block."
    elif inactive_days is not None and inactive_days >= WAKE_UP_INACTIVE_DAYS and actual == 0:
        status = "wake_up_risk"
        reason = "Project crossed the wake-up inactivity threshold without logged time."
    elif actual < baseline.min_minutes:
        status = "drift"
        reason = "Logged time fell below the stage minimum."
    elif actual > baseline.max_minutes:
        status = "overheated"
        reason = "Logged time exceeded the stage maximum."
    elif actual < baseline.target_minutes:
        status = "maintenance"
        reason = "Logged time covered the minimum but stayed below target."
    else:
        status = "healthy"
        reason = "Logged time was within the stage target range."

    return ProjectHealth(
        project_id=int(project.get("id", 0)),
        project_title=str(project.get("title") or f"Project {project.get('id', '')}").strip(),
        stage=stage,
        status=status,
        actual_minutes=actual,
        min_minutes=baseline.min_minutes,
        target_minutes=baseline.target_minutes,
        max_minutes=baseline.max_minutes,
        inactive_days=inactive_days,
        reason=reason,
    )


def evaluate_projects_health(
    projects: list[dict[str, Any]],
    actual_by_project: dict[int, int],
    inactive_days_by_project: dict[int, int | None] | None = None,
) -> list[dict[str, Any]]:
    inactive_days_by_project = inactive_days_by_project or {}
    rows = []
    for project in sorted(projects, key=lambda item: item.get("id", 0)):
        project_id = int(project.get("id", 0))
        rows.append(
            evaluate_project_health(
                project,
                actual_by_project.get(project_id, 0),
                inactive_days_by_project.get(project_id),
            ).as_dict()
        )
    return rows


def effective_stage_baseline(project: dict[str, Any]) -> StageBaseline:
    stage = str(project.get("stage") or "stable")
    default = STAGE_BASELINES.get(stage, STAGE_BASELINES["stable"])
    min_minutes = _positive_int(project.get("weekly_min_minutes"), default.min_minutes)
    target_minutes = _positive_int(project.get("weekly_target_minutes"), default.target_minutes)
    target_minutes = max(target_minutes, min_minutes)
    max_minutes = max(default.max_minutes, target_minutes, round(target_minutes * 1.5))
    return StageBaseline(
        min_minutes=min_minutes,
        target_minutes=target_minutes,
        max_minutes=max_minutes,
    )


def _needs_wake_up(
    actual_minutes: int,
    min_minutes: int,
    inactive_days: int | None,
) -> bool:
    if actual_minutes < min_minutes:
        return True
    return inactive_days is not None and inactive_days >= WAKE_UP_INACTIVE_DAYS


def _positive_int(value: Any, fallback: int) -> int:
    try:
        candidate = int(value)
    except (TypeError, ValueError):
        return fallback
    return candidate if candidate > 0 else fallback
