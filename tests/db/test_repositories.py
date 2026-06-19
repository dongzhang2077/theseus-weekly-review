import sqlite3
from datetime import date, time

import pytest

from backend.app.db.repositories import (
    ActivityRepository,
    DailyReflectionRepository,
    GoalRepository,
    ProjectRepository,
    TimeLogRepository,
    WeeklyPlanRepository,
)
from backend.app.schemas import (
    ActivityCreate,
    DailyReflectionCreate,
    GoalCreate,
    PlannedItemCreate,
    ProjectCreate,
    TimeLogCreate,
    WeeklyPlanCreate,
)


def test_repositories_create_and_read_complete_week(connection) -> None:
    goal = GoalRepository(connection).create(GoalCreate(title="Build MVP", priority=1))
    project = ProjectRepository(connection).create(
        ProjectCreate(goal_id=goal.id, title="Backend", weekly_min_minutes=120)
    )
    activity = ActivityRepository(connection).create(
        ActivityCreate(
            project_id=project.id,
            name="Persistence",
            activity_type="consuming",
        )
    )
    plan = WeeklyPlanRepository(connection).create(
        WeeklyPlanCreate(
            week_start=date(2026, 6, 8),
            week_end=date(2026, 6, 14),
            items=[
                PlannedItemCreate(
                    project_id=project.id,
                    title="Implement repositories",
                    planned_minutes=180,
                )
            ],
        )
    )
    time_log = TimeLogRepository(connection).create(
        TimeLogCreate(
            activity_id=activity.id,
            project_id=project.id,
            date=date(2026, 6, 10),
            start_time=time(9, 0),
            end_time=time(10, 30),
            duration_minutes=90,
            activity_name="Persistence",
            activity_type="consuming",
        )
    )
    reflection = DailyReflectionRepository(connection).create(
        DailyReflectionCreate(date=date(2026, 6, 10), small_win="Schema works")
    )
    stored_project = ProjectRepository(connection).get(project.id)

    assert GoalRepository(connection).list() == [goal]
    assert ProjectRepository(connection).list() == [stored_project]
    assert plan.items[0].weekly_plan_id == plan.id
    assert TimeLogRepository(connection).get(time_log.id) == time_log
    assert DailyReflectionRepository(connection).get(reflection.id) == reflection
    assert stored_project.last_activity_date == date(2026, 6, 10)


def test_weekly_plan_creation_rolls_back_all_rows_on_item_failure(connection) -> None:
    invalid_plan = WeeklyPlanCreate(
        week_start=date(2026, 6, 8),
        week_end=date(2026, 6, 14),
        items=[
            PlannedItemCreate(
                project_id=999,
                title="Missing project",
                planned_minutes=30,
            )
        ],
    )

    with pytest.raises(sqlite3.IntegrityError):
        WeeklyPlanRepository(connection).create(invalid_plan)

    assert connection.execute("SELECT COUNT(*) FROM weekly_plans").fetchone()[0] == 0
    assert connection.execute("SELECT COUNT(*) FROM planned_items").fetchone()[0] == 0
