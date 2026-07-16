import sqlite3
from datetime import date, time

import pytest

from backend.app.db.repositories import (
    ActivityRepository,
    DailyReflectionRepository,
    GoalRepository,
    ProjectRepository,
    TimeLogRepository,
    UserRepository,
    WeeklyPlanRepository,
)
from backend.app.schemas import (
    ActivityCreate,
    DailyReflectionCreate,
    GoalCreate,
    LocalUserCreate,
    PlannedItemCreate,
    ProjectCreate,
    TimeLogCreate,
    WeeklyPlanCreate,
)


def test_repositories_create_and_read_complete_week(connection, local_user) -> None:
    goal = GoalRepository(connection, local_user.id).create(
        GoalCreate(title="Build MVP", priority=1)
    )
    project = ProjectRepository(connection, local_user.id).create(
        ProjectCreate(goal_id=goal.id, title="Backend", weekly_min_minutes=120)
    )
    activity = ActivityRepository(connection, local_user.id).create(
        ActivityCreate(
            project_id=project.id,
            name="Persistence",
            activity_type="consuming",
        )
    )
    plan = WeeklyPlanRepository(connection, local_user.id).create(
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
    time_log = TimeLogRepository(connection, local_user.id).create(
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
    reflection = DailyReflectionRepository(connection, local_user.id).create(
        DailyReflectionCreate(date=date(2026, 6, 10), small_win="Schema works")
    )
    stored_project = ProjectRepository(connection, local_user.id).get(project.id)

    assert GoalRepository(connection, local_user.id).list() == [goal]
    assert ProjectRepository(connection, local_user.id).list() == [stored_project]
    assert plan.items[0].weekly_plan_id == plan.id
    assert TimeLogRepository(connection, local_user.id).get(time_log.id) == time_log
    assert DailyReflectionRepository(connection, local_user.id).get(reflection.id) == reflection
    assert stored_project.last_activity_date == date(2026, 6, 10)
    assert goal.user_id == local_user.id
    assert plan.user_id == local_user.id


def test_weekly_plan_creation_rolls_back_all_rows_on_item_failure(
    connection,
    local_user,
) -> None:
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
        WeeklyPlanRepository(connection, local_user.id).create(invalid_plan)

    assert connection.execute("SELECT COUNT(*) FROM weekly_plans").fetchone()[0] == 0
    assert connection.execute("SELECT COUNT(*) FROM planned_items").fetchone()[0] == 0


def test_weekly_plan_replace_is_atomic_and_delete_is_user_scoped(
    connection,
    local_user,
) -> None:
    repository = WeeklyPlanRepository(connection, local_user.id)
    plan = repository.create(
        WeeklyPlanCreate(
            week_start=date(2026, 6, 15),
            week_end=date(2026, 6, 21),
            planned_capacity_minutes=600,
            items=[PlannedItemCreate(title="Original block", planned_minutes=60)],
        )
    )

    replaced = repository.replace(
        plan.id,
        WeeklyPlanCreate(
            week_start=date(2026, 6, 15),
            week_end=date(2026, 6, 21),
            planned_capacity_minutes=720,
            items=[PlannedItemCreate(title="Adjusted block", planned_minutes=120)],
        ),
    )

    assert replaced.id == plan.id
    assert replaced.planned_capacity_minutes == 720
    assert [item.title for item in replaced.items] == ["Adjusted block"]

    invalid = WeeklyPlanCreate(
        week_start=date(2026, 6, 15),
        week_end=date(2026, 6, 21),
        items=[
            PlannedItemCreate(
                project_id=999,
                title="Missing project",
                planned_minutes=30,
            )
        ],
    )
    with pytest.raises(sqlite3.IntegrityError):
        repository.replace(plan.id, invalid)

    restored = repository.get(plan.id)
    assert restored.planned_capacity_minutes == 720
    assert [item.title for item in restored.items] == ["Adjusted block"]

    with pytest.raises(LookupError):
        WeeklyPlanRepository(connection, local_user.id + 1).delete(plan.id)
    repository.delete(plan.id)
    with pytest.raises(LookupError):
        repository.get(plan.id)


def test_user_repositories_keep_records_isolated(connection) -> None:
    users = UserRepository(connection)
    first = users.create(LocalUserCreate(display_name="First"))
    second = users.create(LocalUserCreate(display_name="Second"))

    first_goal = GoalRepository(connection, first.id).create(
        GoalCreate(title="First goal")
    )
    GoalRepository(connection, second.id).create(GoalCreate(title="Second goal"))

    assert users.list() == [first, second]
    assert GoalRepository(connection, first.id).list() == [first_goal]
    assert [goal.title for goal in GoalRepository(connection, second.id).list()] == [
        "Second goal"
    ]
