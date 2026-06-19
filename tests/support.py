from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from backend.app.db.repositories import (
    DailyReflectionRepository,
    GoalRepository,
    ProjectRepository,
    TimeLogRepository,
    WeeklyPlanRepository,
)
from backend.app.schemas import (
    DailyReflectionCreate,
    GoalCreate,
    ProjectCreate,
    TimeLogCreate,
    WeeklyPlanCreate,
)


ROOT = Path(__file__).resolve().parents[1]
SAMPLE_PATH = ROOT / "data" / "sample" / "sample_week.json"


def load_sample_payload() -> dict:
    return json.loads(SAMPLE_PATH.read_text(encoding="utf-8"))


def seed_sample_week(connection: sqlite3.Connection) -> None:
    sample = load_sample_payload()
    goal_ids: dict[int, int] = {}
    project_ids: dict[int, int] = {}

    goals = GoalRepository(connection)
    for source in sample["goals"]:
        values = dict(source)
        source_id = values.pop("id")
        created = goals.create(GoalCreate.model_validate(values))
        goal_ids[source_id] = created.id

    projects = ProjectRepository(connection)
    for source in sample["projects"]:
        values = dict(source)
        source_id = values.pop("id")
        if values.get("goal_id") is not None:
            values["goal_id"] = goal_ids[values["goal_id"]]
        created = projects.create(ProjectCreate.model_validate(values))
        project_ids[source_id] = created.id

    plan_values = dict(sample["weekly_plan"])
    plan_values["items"] = [
        {
            **item,
            "project_id": (
                project_ids[item["project_id"]]
                if item.get("project_id") is not None
                else None
            ),
        }
        for item in plan_values["items"]
    ]
    WeeklyPlanRepository(connection).create(WeeklyPlanCreate.model_validate(plan_values))

    logs = TimeLogRepository(connection)
    for source in sample["time_logs"]:
        values = dict(source)
        if values.get("project_id") is not None:
            values["project_id"] = project_ids[values["project_id"]]
        logs.create(TimeLogCreate.model_validate(values))

    reflections = DailyReflectionRepository(connection)
    for source in sample.get("daily_reflections", []):
        reflections.create(DailyReflectionCreate.model_validate(source))
