from __future__ import annotations

import sqlite3
from datetime import datetime, timezone

import pytest

from backend.app.db.repositories import (
    ActivityRepository,
    ProjectRepository,
    TaskRepository,
    TimeLogRepository,
    UserRepository,
)
from backend.app.schemas import (
    ActivityCreate,
    FocusSessionCommand,
    FocusSessionCreate,
    LocalUserCreate,
    ProjectCreate,
    TaskCreate,
)
from backend.app.services import (
    ActivityAlreadyRunning,
    FocusService,
    IdempotencyConflict,
)


def test_focus_service_persists_start_end_and_exactly_once_logs(connection) -> None:
    user = UserRepository(connection).create(
        LocalUserCreate(
            display_name="Focus owner",
            timezone="America/Los_Angeles",
        )
    )
    project = ProjectRepository(connection, user.id).create(
        ProjectCreate(title="Final report")
    )
    activity = ActivityRepository(connection, user.id).create(
        ActivityCreate(
            project_id=project.id,
            name="Focused writing",
            activity_type="consuming",
        )
    )
    task = TaskRepository(connection, user.id).create(
        TaskCreate(project_id=project.id, title="Draft findings")
    )
    clock = {"now": datetime(2026, 7, 25, 18, 0, 0, tzinfo=timezone.utc)}
    service = FocusService(
        connection,
        user.id,
        now_provider=lambda: clock["now"],
    )

    started = service.start(
        FocusSessionCreate(activity_id=activity.id, task_id=task.id),
        idempotency_key="start-1",
    )
    replayed_start = service.start(
        FocusSessionCreate(activity_id=activity.id, task_id=task.id),
        idempotency_key="start-1",
    )

    assert replayed_start == started
    assert started.status == "running"
    assert started.elapsed_seconds == 0
    assert started.current_run_started_at == started.started_at
    assert TaskRepository(connection, user.id).get(task.id).status == "in_progress"

    clock["now"] = datetime(2026, 7, 25, 18, 1, 35, tzinfo=timezone.utc)
    current = service.get(started.id)
    assert current.elapsed_seconds == 95

    ended = service.command(
        started.id,
        FocusSessionCommand(command="end", expected_version=1),
        idempotency_key="end-1",
    )
    replayed_end = service.command(
        started.id,
        FocusSessionCommand(command="end", expected_version=1),
        idempotency_key="end-1",
    )

    assert replayed_end == ended
    assert ended.session.status == "completed"
    assert ended.session.accumulated_seconds == 95
    assert ended.session.version == 2
    assert len(ended.time_logs) == 1
    assert ended.time_logs[0].duration_seconds == 95
    assert ended.time_logs[0].duration_minutes == 2
    assert ended.time_logs[0].activity_id == activity.id
    assert ended.time_logs[0].task_id == task.id
    assert ended.time_logs[0].focus_session_id == started.id
    assert len(TimeLogRepository(connection, user.id).list()) == 1
    assert TaskRepository(connection, user.id).get(task.id).status == "in_progress"


def test_focus_service_splits_cross_midnight_and_supports_independent_activities(
    connection,
) -> None:
    user = UserRepository(connection).create(
        LocalUserCreate(
            display_name="Midnight owner",
            timezone="America/Los_Angeles",
        )
    )
    project = ProjectRepository(connection, user.id).create(
        ProjectCreate(title="Final report")
    )
    first = ActivityRepository(connection, user.id).create(
        ActivityCreate(
            project_id=project.id,
            name="Writing",
            activity_type="consuming",
        )
    )
    second = ActivityRepository(connection, user.id).create(
        ActivityCreate(
            project_id=project.id,
            name="Research",
            activity_type="neutral",
        )
    )
    clock = {"now": datetime(2026, 7, 26, 6, 59, 30, tzinfo=timezone.utc)}
    service = FocusService(
        connection,
        user.id,
        now_provider=lambda: clock["now"],
    )

    first_session = service.start(
        FocusSessionCreate(activity_id=first.id),
        idempotency_key="first-start",
    )
    second_session = service.start(
        FocusSessionCreate(activity_id=second.id),
        idempotency_key="second-start",
    )
    with pytest.raises(ActivityAlreadyRunning):
        service.start(
            FocusSessionCreate(activity_id=first.id),
            idempotency_key="duplicate-running",
        )

    clock["now"] = datetime(2026, 7, 26, 7, 0, 30, tzinfo=timezone.utc)
    result = service.command(
        first_session.id,
        FocusSessionCommand(command="end", expected_version=1),
        idempotency_key="first-end",
    )
    cancelled = service.command(
        second_session.id,
        FocusSessionCommand(command="cancel", expected_version=1),
        idempotency_key="second-cancel",
    )

    assert [(log.date.isoformat(), log.duration_seconds, log.duration_minutes) for log in result.time_logs] == [
        ("2026-07-25", 30, 1),
        ("2026-07-26", 30, 0),
    ]
    assert sum(log.duration_seconds for log in result.time_logs) == 60
    assert sum(log.duration_minutes for log in result.time_logs) == 1
    assert cancelled.session.status == "cancelled"
    assert cancelled.session.version == 2
    assert cancelled.time_logs == []


def test_focus_service_rejects_idempotency_key_reuse(connection) -> None:
    user = UserRepository(connection).create(LocalUserCreate(display_name="Key owner"))
    first = ActivityRepository(connection, user.id).create(
        ActivityCreate(name="Writing", activity_type="neutral")
    )
    second = ActivityRepository(connection, user.id).create(
        ActivityCreate(name="Reading", activity_type="neutral")
    )
    service = FocusService(connection, user.id)
    service.start(
        FocusSessionCreate(activity_id=first.id),
        idempotency_key="one-key",
    )

    with pytest.raises(IdempotencyConflict):
        service.start(
            FocusSessionCreate(activity_id=second.id),
            idempotency_key="one-key",
        )


def test_focus_end_rolls_back_every_slice_and_can_retry_after_storage_failure(
    connection,
) -> None:
    user = UserRepository(connection).create(
        LocalUserCreate(
            display_name="Atomic focus owner",
            timezone="America/Los_Angeles",
        )
    )
    activity = ActivityRepository(connection, user.id).create(
        ActivityCreate(name="Atomic writing", activity_type="consuming")
    )
    clock = {"now": datetime(2026, 7, 26, 6, 59, 30, tzinfo=timezone.utc)}
    service = FocusService(
        connection,
        user.id,
        now_provider=lambda: clock["now"],
    )
    started = service.start(
        FocusSessionCreate(activity_id=activity.id),
        idempotency_key="atomic-start",
    )
    connection.execute(
        f"""
        CREATE TRIGGER reject_second_focus_slice
        BEFORE INSERT ON time_logs
        WHEN NEW.focus_session_id = {started.id}
             AND NEW.date = '2026-07-26'
        BEGIN
            SELECT RAISE(ABORT, 'injected focus log failure');
        END
        """
    )
    clock["now"] = datetime(2026, 7, 26, 7, 0, 30, tzinfo=timezone.utc)

    with pytest.raises(sqlite3.IntegrityError):
        service.command(
            started.id,
            FocusSessionCommand(command="end", expected_version=1),
            idempotency_key="atomic-end",
        )

    assert service.get(started.id).status == "running"
    assert TimeLogRepository(connection, user.id).list() == []
    assert connection.execute(
        """
        SELECT COUNT(*)
        FROM focus_session_segments
        WHERE focus_session_id = ? AND ended_at IS NULL
        """,
        (started.id,),
    ).fetchone()[0] == 1
    assert connection.execute(
        """
        SELECT COUNT(*)
        FROM idempotency_receipts
        WHERE user_id = ? AND idempotency_key = 'atomic-end'
        """,
        (user.id,),
    ).fetchone()[0] == 0

    connection.execute("DROP TRIGGER reject_second_focus_slice")
    retried = service.command(
        started.id,
        FocusSessionCommand(command="end", expected_version=1),
        idempotency_key="atomic-end",
    )

    assert retried.session.status == "completed"
    assert len(retried.time_logs) == 2
