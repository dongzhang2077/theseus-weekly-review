from __future__ import annotations

import json
import re
import sqlite3
from pathlib import Path
from typing import Any

from backend.app.db.repositories import (
    DailyReflectionRepository,
    GoalRepository,
    ProjectRepository,
    TimeLogRepository,
    UserRepository,
    WeeklyPlanRepository,
)
from backend.app.schemas import (
    DailyReflectionCreate,
    GoalCreate,
    LocalUserCreate,
    LocalUserRead,
    ProjectCreate,
    TimeLogCreate,
    WeeklyPlanCreate,
)


ROOT = Path(__file__).resolve().parents[1]
SAMPLE_PATH = ROOT / "data" / "sample" / "sample_week.json"
DEFAULT_TEST_PASSWORD = "correct horse battery staple"


def load_sample_payload() -> dict:
    return json.loads(SAMPLE_PATH.read_text(encoding="utf-8"))


async def create_and_select_api_user(
    client: Any,
    display_name: str = "API Test User",
    *,
    email: str | None = None,
    password: str = DEFAULT_TEST_PASSWORD,
) -> dict[str, Any]:
    identifier = re.sub(r"[^a-z0-9]+", "-", display_name.casefold()).strip("-")
    response = await client.post(
        "/auth/register",
        json={
            "email": email or f"{identifier or 'user'}@example.com",
            "password": password,
            "display_name": display_name,
        },
    )
    if response.status_code != 201:
        raise AssertionError(f"Could not create API test user: {response.text}")
    payload = response.json()
    user = payload["user"]
    client.headers["Authorization"] = f"Bearer {payload['access_token']}"
    return user


def seed_sample_week(
    connection: sqlite3.Connection,
    user_id: int | None = None,
) -> LocalUserRead:
    sample = load_sample_payload()
    users = UserRepository(connection)
    user = (
        users.create(LocalUserCreate(display_name="Sample User"))
        if user_id is None
        else users.get(user_id)
    )
    goal_ids: dict[int, int] = {}
    project_ids: dict[int, int] = {}

    goals = GoalRepository(connection, user.id)
    for source in sample["goals"]:
        values = dict(source)
        source_id = values.pop("id")
        created = goals.create(GoalCreate.model_validate(values))
        goal_ids[source_id] = created.id

    projects = ProjectRepository(connection, user.id)
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
    WeeklyPlanRepository(connection, user.id).create(
        WeeklyPlanCreate.model_validate(plan_values)
    )

    logs = TimeLogRepository(connection, user.id)
    for source in sample["time_logs"]:
        values = dict(source)
        if values.get("project_id") is not None:
            values["project_id"] = project_ids[values["project_id"]]
        logs.create(TimeLogCreate.model_validate(values))

    reflections = DailyReflectionRepository(connection, user.id)
    for source in sample.get("daily_reflections", []):
        reflections.create(DailyReflectionCreate.model_validate(source))
    return user
