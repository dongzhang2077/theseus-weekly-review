import sqlite3

import pytest

from backend.app.db.repositories import ProjectRepository
from backend.app.schemas import ActivityCreate, ActivityUpdate, ProjectCreate
from backend.app.services import (
    ActivityInUse,
    ActivityService,
    ActivityVersionConflict,
)


def test_activity_service_corrects_fields_and_enforces_optimistic_version(
    connection,
    local_user,
) -> None:
    first_project = ProjectRepository(connection, local_user.id).create(
        ProjectCreate(title="Final report")
    )
    second_project = ProjectRepository(connection, local_user.id).create(
        ProjectCreate(title="Applications")
    )
    service = ActivityService(connection, local_user.id)
    activity = service.create(
        ActivityCreate(
            project_id=first_project.id,
            name="  Focused writing  ",
            description="Drafting",
            activity_type="consuming",
        )
    )

    assert activity.name == "Focused writing"
    assert activity.type_source == "user_selected"
    assert activity.version == 1

    corrected = service.update(
        activity.id,
        ActivityUpdate(
            expected_version=1,
            project_id=second_project.id,
            activity_type="restore",
            description=None,
        ),
    )

    assert corrected.project_id == second_project.id
    assert corrected.activity_type == "restore"
    assert corrected.type_source == "user_corrected"
    assert corrected.description == ""
    assert corrected.version == 2

    with pytest.raises(ActivityVersionConflict) as conflict:
        service.update(
            activity.id,
            ActivityUpdate(expected_version=1, name="Stale overwrite"),
        )
    assert conflict.value.current.version == 2
    assert service.list(project_id=second_project.id) == [corrected]


def test_activity_project_change_is_blocked_by_future_open_focus_session(
    connection,
    local_user,
) -> None:
    first_project = ProjectRepository(connection, local_user.id).create(
        ProjectCreate(title="Final report")
    )
    second_project = ProjectRepository(connection, local_user.id).create(
        ProjectCreate(title="Applications")
    )
    service = ActivityService(connection, local_user.id)
    activity = service.create(
        ActivityCreate(
            project_id=first_project.id,
            name="Focused writing",
            activity_type="consuming",
        )
    )
    connection.execute(
        """
        CREATE TABLE focus_sessions (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            activity_id INTEGER NOT NULL,
            status TEXT NOT NULL
        )
        """
    )
    connection.execute(
        """
        INSERT INTO focus_sessions (user_id, activity_id, status)
        VALUES (?, ?, 'paused')
        """,
        (local_user.id, activity.id),
    )

    with pytest.raises(ActivityInUse):
        service.update(
            activity.id,
            ActivityUpdate(
                expected_version=1,
                project_id=second_project.id,
            ),
        )

    renamed = service.update(
        activity.id,
        ActivityUpdate(expected_version=1, name="Focused revision"),
    )
    assert renamed.name == "Focused revision"
    assert renamed.project_id == first_project.id


def test_activity_service_rejects_foreign_project(
    connection,
    local_user,
) -> None:
    service = ActivityService(connection, local_user.id)
    with pytest.raises(sqlite3.IntegrityError):
        service.create(
            ActivityCreate(
                project_id=999,
                name="Foreign activity",
                activity_type="neutral",
            )
        )
