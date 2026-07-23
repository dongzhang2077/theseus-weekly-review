from datetime import date

import pytest

from backend.app.db.repositories import ProjectRepository
from backend.app.schemas import ProjectCreate, TaskCreate, TaskUpdate
from backend.app.services import (
    InvalidTaskTransition,
    TaskService,
    TaskVersionConflict,
)


def test_task_service_enforces_lifecycle_archive_and_optimistic_version(
    connection,
    local_user,
) -> None:
    project = ProjectRepository(connection, local_user.id).create(
        ProjectCreate(title="Final report")
    )
    service = TaskService(connection, local_user.id)
    task = service.create(
        TaskCreate(
            project_id=project.id,
            title="Draft findings",
            estimated_minutes=120,
            due_date=date(2026, 8, 1),
        )
    )

    completed = service.update(
        task.id,
        TaskUpdate(expected_version=1, status="completed"),
    )
    assert completed.status == "completed"
    assert completed.completed_at is not None
    assert completed.version == 2

    with pytest.raises(TaskVersionConflict):
        service.update(
            task.id,
            TaskUpdate(expected_version=1, status="open"),
        )

    with pytest.raises(InvalidTaskTransition):
        service.update(
            task.id,
            TaskUpdate(expected_version=2, status="open"),
        )

    reopened = service.update(
        task.id,
        TaskUpdate(expected_version=2, status="in_progress"),
    )
    assert reopened.completed_at is None
    archived = service.update(
        task.id,
        TaskUpdate(expected_version=3, archived=True),
    )
    assert archived.archived_at is not None
    assert service.list() == []
    assert service.list(include_archived=True) == [archived]

    with pytest.raises(TaskVersionConflict) as conflict:
        service.update(
            task.id,
            TaskUpdate(expected_version=3, title="Stale overwrite"),
        )
    assert conflict.value.current.version == 4


def test_task_service_clears_nullable_fields_without_storing_null_description(
    connection,
    local_user,
) -> None:
    project = ProjectRepository(connection, local_user.id).create(
        ProjectCreate(title="Final report")
    )
    service = TaskService(connection, local_user.id)
    task = service.create(
        TaskCreate(
            project_id=project.id,
            title="Draft findings",
            description="Initial condition",
            estimated_minutes=120,
            due_date=date(2026, 8, 1),
        )
    )

    updated = service.update(
        task.id,
        TaskUpdate(
            expected_version=1,
            description=None,
            estimated_minutes=None,
            due_date=None,
        ),
    )

    assert updated.description == ""
    assert updated.estimated_minutes is None
    assert updated.due_date is None
