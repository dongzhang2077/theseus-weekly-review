#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.app.db import Database  # noqa: E402
from backend.app.db.repositories import (  # noqa: E402
    ActivityRepository,
    GoalRepository,
    ProjectRepository,
    TimeLogRepository,
    UserRepository,
)
from backend.app.schemas import (  # noqa: E402
    ActivityCreate,
    GoalCreate,
    ProjectCreate,
    TimeLogCreate,
)


MARKER_PREFIX = "[theseus-demo:student-week:v1:"
DEMO_GOAL_DESCRIPTION = "Reusable local student-routine demo data."


@dataclass(frozen=True)
class DemoSeedResult:
    user_id: int
    week_start: str
    projects_created: int
    activities_created: int
    time_logs_created: int
    already_present: bool


PROJECTS = {
    "school": ("School", 900),
    "work": ("Part-time work", 480),
    "life": ("Daily life", 2400),
}

ACTIVITIES = {
    "sleep": ("life", "Sleep", "restore"),
    "breakfast": ("life", "Breakfast", "neutral"),
    "commute": ("life", "Commute", "neutral"),
    "class": ("school", "Class", "consuming"),
    "lunch": ("life", "Lunch", "neutral"),
    "study": ("school", "Independent study", "consuming"),
    "exercise": ("life", "Exercise", "restore"),
    "dinner": ("life", "Dinner", "neutral"),
    "shift": ("work", "Part-time shift", "consuming"),
}

# (day offset, start, end, activity key, short evidence note)
STUDENT_WEEK = (
    (0, "00:00", "07:30", "sleep", "Monday sleep"),
    (0, "07:45", "08:15", "breakfast", "Breakfast before campus"),
    (0, "08:30", "09:10", "commute", "Bus to campus"),
    (0, "09:30", "12:20", "class", "Morning lectures"),
    (0, "12:30", "13:15", "lunch", "Lunch on campus"),
    (0, "13:30", "15:30", "study", "Library study block"),
    (0, "17:00", "18:00", "exercise", "Gym session"),
    (0, "18:30", "19:15", "dinner", "Dinner at home"),
    (1, "00:00", "07:00", "sleep", "Tuesday sleep"),
    (1, "07:30", "08:00", "breakfast", "Breakfast"),
    (1, "09:00", "11:50", "class", "Morning lectures"),
    (1, "12:00", "12:45", "lunch", "Lunch on campus"),
    (1, "13:00", "15:00", "study", "Coursework and reading"),
    (1, "15:15", "15:45", "commute", "Travel to work"),
    (1, "16:00", "20:00", "shift", "Evening shift"),
    (1, "20:30", "21:00", "dinner", "Dinner after work"),
    (2, "00:00", "07:30", "sleep", "Wednesday sleep"),
    (2, "08:00", "08:30", "breakfast", "Breakfast"),
    (2, "08:40", "09:20", "commute", "Bus to campus"),
    (2, "09:30", "12:20", "class", "Morning lectures"),
    (2, "12:30", "13:15", "lunch", "Lunch with classmates"),
    (2, "14:00", "16:00", "study", "Assignment work"),
    (2, "16:30", "17:15", "exercise", "Run and stretching"),
    (2, "18:00", "18:45", "dinner", "Dinner at home"),
    (3, "00:00", "07:15", "sleep", "Thursday sleep"),
    (3, "07:45", "08:15", "breakfast", "Breakfast"),
    (3, "08:30", "09:10", "commute", "Bus to campus"),
    (3, "09:30", "12:20", "class", "Morning lectures"),
    (3, "12:30", "13:15", "lunch", "Lunch on campus"),
    (3, "13:30", "15:00", "study", "Review notes"),
    (3, "15:20", "15:50", "commute", "Travel to work"),
    (3, "16:00", "19:30", "shift", "Evening shift"),
)


def seed_student_week(connection, user_id: int, week_start: date) -> DemoSeedResult:
    if week_start.weekday() != 0:
        raise ValueError("week_start must be a Monday")

    users = UserRepository(connection)
    users.get(user_id)
    marker = _marker(week_start)
    existing = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM time_logs
        WHERE user_id = ? AND note LIKE ? AND deleted_at IS NULL
        """,
        (user_id, f"{marker}%"),
    ).fetchone()["count"]
    if existing:
        if existing != len(STUDENT_WEEK):
            raise RuntimeError(
                f"Student demo week is incomplete: found {existing} of "
                f"{len(STUDENT_WEEK)} records"
            )
        return DemoSeedResult(
            user_id=user_id,
            week_start=week_start.isoformat(),
            projects_created=0,
            activities_created=0,
            time_logs_created=0,
            already_present=True,
        )

    goal = _ensure_demo_goal(connection, user_id)
    project_ids, projects_created = _ensure_projects(connection, user_id, goal.id)
    activity_ids, activities_created = _ensure_activities(
        connection, user_id, project_ids
    )
    logs = TimeLogRepository(connection, user_id)

    for day_offset, start, end, activity_key, evidence_note in STUDENT_WEEK:
        project_key, activity_name, activity_type = ACTIVITIES[activity_key]
        log_date = week_start + timedelta(days=day_offset)
        logs.create(
            TimeLogCreate(
                activity_id=activity_ids[activity_key],
                project_id=project_ids[project_key],
                date=log_date,
                start_time=start,
                end_time=end,
                duration_minutes=_duration_minutes(start, end),
                activity_name=activity_name,
                activity_type=activity_type,
                type_source="user_selected",
                note=f"{marker} {evidence_note}",
            )
        )

    return DemoSeedResult(
        user_id=user_id,
        week_start=week_start.isoformat(),
        projects_created=projects_created,
        activities_created=activities_created,
        time_logs_created=len(STUDENT_WEEK),
        already_present=False,
    )


def remove_student_week(connection, user_id: int, week_start: date) -> int:
    marker = _marker(week_start)
    cursor = connection.execute(
        "DELETE FROM time_logs WHERE user_id = ? AND note LIKE ?",
        (user_id, f"{marker}%"),
    )
    return cursor.rowcount


def _ensure_demo_goal(connection, user_id: int):
    repository = GoalRepository(connection, user_id)
    for goal in repository.list():
        if goal.title == "Student routine" and goal.description == DEMO_GOAL_DESCRIPTION:
            return goal
    return repository.create(
        GoalCreate(
            title="Student routine",
            description=DEMO_GOAL_DESCRIPTION,
            priority=3,
            active_status=True,
        )
    )


def _ensure_projects(connection, user_id: int, goal_id: int) -> tuple[dict[str, int], int]:
    repository = ProjectRepository(connection, user_id)
    existing = {(project.goal_id, project.title): project for project in repository.list()}
    project_ids: dict[str, int] = {}
    created_count = 0
    for key, (title, target_minutes) in PROJECTS.items():
        project = existing.get((goal_id, title))
        if project is None:
            project = repository.create(
                ProjectCreate(
                    goal_id=goal_id,
                    title=title,
                    stage="stable",
                    weekly_min_minutes=0,
                    weekly_target_minutes=target_minutes,
                    status="active",
                )
            )
            created_count += 1
        project_ids[key] = project.id
    return project_ids, created_count


def _ensure_activities(
    connection, user_id: int, project_ids: dict[str, int]
) -> tuple[dict[str, int], int]:
    repository = ActivityRepository(connection, user_id)
    existing = {
        (activity.project_id, activity.name, activity.activity_type): activity
        for activity in repository.list()
    }
    activity_ids: dict[str, int] = {}
    created_count = 0
    for key, (project_key, name, activity_type) in ACTIVITIES.items():
        identity = (project_ids[project_key], name, activity_type)
        activity = existing.get(identity)
        if activity is None:
            activity = repository.create(
                ActivityCreate(
                    project_id=project_ids[project_key],
                    name=name,
                    description=DEMO_GOAL_DESCRIPTION,
                    activity_type=activity_type,
                )
            )
            created_count += 1
        activity_ids[key] = activity.id
    return activity_ids, created_count


def _marker(week_start: date) -> str:
    return f"{MARKER_PREFIX}{week_start.isoformat()}]"


def _duration_minutes(start: str, end: str) -> int:
    start_at = datetime.strptime(start, "%H:%M")
    end_at = datetime.strptime(end, "%H:%M")
    duration = int((end_at - start_at).total_seconds() // 60)
    if duration <= 0:
        raise ValueError(f"invalid demo interval: {start}-{end}")
    return duration


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed or remove an idempotent ordinary-student demo week."
    )
    parser.add_argument("--database", required=True, help="Path to the SQLite database")
    parser.add_argument("--user-id", required=True, type=int, help="Existing account ID")
    parser.add_argument(
        "--week-start",
        required=True,
        type=date.fromisoformat,
        help="Monday in YYYY-MM-DD format",
    )
    parser.add_argument(
        "--remove",
        action="store_true",
        help="Remove only the tagged TimeLogs for this demo week",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    database = Database(args.database)
    database.initialize()
    with database.session() as connection:
        if args.remove:
            removed = remove_student_week(connection, args.user_id, args.week_start)
            print(
                {
                    "user_id": args.user_id,
                    "week_start": args.week_start.isoformat(),
                    "time_logs_removed": removed,
                }
            )
            return
        result = seed_student_week(connection, args.user_id, args.week_start)
    print(result.__dict__)


if __name__ == "__main__":
    main()
