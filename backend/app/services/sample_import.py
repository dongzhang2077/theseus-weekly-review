from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ..db.repositories import (
    DailyReflectionRepository,
    GoalRepository,
    ProjectRepository,
    TimeLogRepository,
    WeeklyPlanRepository,
)
from ..schemas import (
    DailyReflectionCreate,
    GoalCreate,
    ProjectCreate,
    TimeLogCreate,
    WeeklyPlanCreate,
)


ROOT = Path(__file__).resolve().parents[3]
DEFAULT_SAMPLE_PATH = ROOT / "data" / "sample" / "sample_week.json"


@dataclass(frozen=True)
class SampleImportResult:
    goals: int
    projects: int
    weekly_plans: int
    planned_items: int
    time_logs: int
    daily_reflections: int


def load_sample_payload(path: str | Path = DEFAULT_SAMPLE_PATH) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def import_sample_week(
    connection: sqlite3.Connection,
    payload: dict[str, Any] | None = None,
) -> SampleImportResult:
    sample = payload or load_sample_payload()
    connection.execute("SAVEPOINT import_sample_week")
    try:
        result = _replace_sample_week(connection, sample)
    except Exception:
        connection.execute("ROLLBACK TO SAVEPOINT import_sample_week")
        connection.execute("RELEASE SAVEPOINT import_sample_week")
        raise
    connection.execute("RELEASE SAVEPOINT import_sample_week")
    return result


def _replace_sample_week(
    connection: sqlite3.Connection,
    sample: dict[str, Any],
) -> SampleImportResult:
    _delete_existing_fixture(connection, sample)

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

    return SampleImportResult(
        goals=len(sample["goals"]),
        projects=len(sample["projects"]),
        weekly_plans=1,
        planned_items=len(sample["weekly_plan"].get("items", [])),
        time_logs=len(sample["time_logs"]),
        daily_reflections=len(sample.get("daily_reflections", [])),
    )


def _delete_existing_fixture(connection: sqlite3.Connection, sample: dict[str, Any]) -> None:
    plan = sample["weekly_plan"]
    week_start = plan["week_start"]
    week_end = plan["week_end"]
    reflection_dates = [row["date"] for row in sample.get("daily_reflections", [])]
    project_titles = [row["title"] for row in sample["projects"]]
    goal_titles = [row["title"] for row in sample["goals"]]

    connection.execute(
        "DELETE FROM weekly_reviews WHERE week_start = ? AND week_end = ?",
        (week_start, week_end),
    )
    connection.execute(
        "DELETE FROM time_logs WHERE date BETWEEN ? AND ?",
        (week_start, week_end),
    )
    _delete_where_in(connection, "daily_reflections", "date", reflection_dates)
    connection.execute(
        "DELETE FROM weekly_plans WHERE week_start = ? AND week_end = ?",
        (week_start, week_end),
    )
    _delete_where_in(connection, "projects", "title", project_titles)
    _delete_where_in(connection, "goals", "title", goal_titles)


def _delete_where_in(
    connection: sqlite3.Connection,
    table: str,
    column: str,
    values: list[str],
) -> None:
    if not values:
        return
    placeholders = ", ".join("?" for _ in values)
    connection.execute(
        f"DELETE FROM {table} WHERE {column} IN ({placeholders})",
        values,
    )
