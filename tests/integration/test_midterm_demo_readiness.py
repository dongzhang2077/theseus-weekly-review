import json

from backend.app.db import Database
from backend.app.db.repositories import (
    AuthRepository,
    GoalRepository,
    ProjectRepository,
    TimeLogRepository,
    UserRepository,
    WeeklyPlanRepository,
    WeeklyReviewRepository,
)
from backend.app.services import AuthService, AuthSettings
from scripts.prepare_midterm_demo import prepare_demo


def test_prepare_demo_is_secret_free_repeatable_and_survives_restart(
    tmp_path,
    monkeypatch,
) -> None:
    database_path = tmp_path / "midterm-demo.db"
    monkeypatch.setenv("THESEUS_REVIEW_WRITER", "openai")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    first = prepare_demo(database_path)
    second = prepare_demo(database_path)

    assert first.user_id == second.user_id
    assert first.credentials_file == second.credentials_file
    credentials = json.loads(
        (tmp_path / "midterm-demo.db.demo-credentials.json").read_text(
            encoding="utf-8"
        )
    )
    assert credentials["email"] == second.login_email
    assert len(credentials["password"]) >= 15
    assert second.review_writer == "template-supportive-v1"
    assert (second.goals, second.projects, second.weekly_plans) == (2, 3, 1)
    assert (second.planned_items, second.time_logs, second.daily_reflections) == (
        3,
        5,
        1,
    )

    restarted = Database(database_path)
    restarted.initialize()
    with restarted.session() as connection:
        user = UserRepository(connection).get(second.user_id)
        identity = AuthRepository(connection).get_by_user_id(second.user_id)
        logged_in = AuthService(
            AuthSettings.from_environment(database_path)
        ).login(
            connection,
            email=credentials["email"],
            password=credentials["password"],
        )
        review = WeeklyReviewRepository(connection, user.id).get_by_week(
            second.week_start,
            second.week_end,
        )

        assert user.display_name == "Theseus Demo"
        assert identity is not None
        assert identity.password_hash.startswith("$argon2id$")
        assert logged_in.account.id == user.id
        assert len(GoalRepository(connection, user.id).list()) == 2
        assert len(ProjectRepository(connection, user.id).list()) == 3
        assert len(WeeklyPlanRepository(connection, user.id).list()) == 1
        assert len(TimeLogRepository(connection, user.id).list()) == 5
        assert review is not None
        assert review.model_name == "template-supportive-v1"
        assert review.evidence["summary"]["time_log_count"] == 5
