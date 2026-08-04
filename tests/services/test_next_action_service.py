from __future__ import annotations

from datetime import datetime, timezone

import httpx
import pytest

from backend.app.main import create_app
from backend.app.schemas import (
    AccountRead,
    ActivityCreate,
    FocusSessionCreate,
    NextActionRequest,
)
from backend.app.services import (
    ActivityService,
    FocusService,
    NextActionService,
    import_sample_week,
)
from tests.support import create_and_select_api_user, load_sample_payload


pytestmark = pytest.mark.anyio
FIXED_NOW = datetime(2026, 6, 14, 18, 0, tzinfo=timezone.utc)


async def _account(client: httpx.AsyncClient, name: str) -> AccountRead:
    return AccountRead.model_validate(await create_and_select_api_user(client, name))


async def test_long_running_project_can_outrank_short_term_plan_work(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        account = await _account(client, "Next action project owner")
        with database.session() as connection:
            import_sample_week(connection, account.id, load_sample_payload())
            result = NextActionService(
                connection,
                account,
                now=lambda: FIXED_NOW,
            ).recommend(NextActionRequest(available_minutes=120))

    assert result.status == "ready"
    assert result.available_time_source == "request"
    assert result.recommendation is not None
    assert result.recommendation.kind == "planned_item"
    assert result.recommendation.title == "Update resume and apply to two roles"
    assert {item.code for item in result.recommendation.evidence} >= {
        "goal_priority",
        "weekly_minimum_gap",
        "project_inactivity",
        "fits_available_time",
    }
    assert result.alternatives
    assert result.uncertainties[0].code == "calendar_unavailable"


async def test_available_time_uses_only_supported_user_stated_preference(
    database,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        account = await _account(client, "Next action preference owner")
        preference = await client.post(
            "/preferences",
            json={
                "preference_key": "focus.default_minutes",
                "value": 45,
            },
        )
        with database.session() as connection:
            result = NextActionService(
                connection,
                account,
                now=lambda: FIXED_NOW,
            ).recommend(NextActionRequest())

    assert preference.status_code == 201
    assert result.available_minutes == 45
    assert result.available_time_source == "preference"
    assert "available_time_defaulted" in {
        item.code for item in result.uncertainties
    }


async def test_most_recent_running_focus_is_recommended_without_ending_others(
    database,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        account = await _account(client, "Next action Focus owner")
        with database.session() as connection:
            activities = ActivityService(connection, account.id)
            first_activity = activities.create(
                ActivityCreate(name="Course reading", activity_type="consuming")
            )
            second_activity = activities.create(
                ActivityCreate(name="Assignment draft", activity_type="consuming")
            )
            first = FocusService(
                connection,
                account.id,
                now_provider=lambda: datetime(
                    2026, 6, 14, 16, 0, tzinfo=timezone.utc
                ),
            ).start(
                FocusSessionCreate(activity_id=first_activity.id),
                idempotency_key="next-action-first-focus",
            )
            second = FocusService(
                connection,
                account.id,
                now_provider=lambda: datetime(
                    2026, 6, 14, 17, 0, tzinfo=timezone.utc
                ),
            ).start(
                FocusSessionCreate(activity_id=second_activity.id),
                idempotency_key="next-action-second-focus",
            )
            result = NextActionService(
                connection,
                account,
                now=lambda: FIXED_NOW,
            ).recommend(NextActionRequest(available_minutes=30))
            running = FocusService(connection, account.id).list(statuses=["running"])

    assert result.recommendation is not None
    assert result.recommendation.kind == "running_focus"
    assert result.recommendation.focus_session_id == second.id
    assert result.alternatives[0].focus_session_id == first.id
    assert "multiple_focus_sessions" in {
        item.code for item in result.uncertainties
    }
    assert {item.id for item in running} == {first.id, second.id}


async def test_empty_state_is_deterministic_and_cloud_independent(
    database,
    monkeypatch,
) -> None:
    monkeypatch.setenv("THESEUS_ASSISTANT_PROVIDER", "openai")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        account = await _account(client, "Next action empty owner")
        with database.session() as connection:
            result = NextActionService(
                connection,
                account,
                now=lambda: FIXED_NOW,
            ).recommend(NextActionRequest())

    assert result.status == "empty"
    assert result.recommendation is None
    assert result.alternatives == []
    assert result.available_minutes == 30
    assert {item.code for item in result.uncertainties} >= {
        "calendar_unavailable",
        "available_time_defaulted",
        "review_missing",
        "no_candidate_evidence",
    }


async def test_stale_review_is_reported_and_not_ranked(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        account = await _account(client, "Next action stale review owner")
        with database.session() as connection:
            import_sample_week(connection, account.id, load_sample_payload())
        generated = await client.post(
            "/reviews/weekly/generate",
            json={
                "week_start": "2026-06-08",
                "week_end": "2026-06-14",
                "mode": "deterministic_first",
            },
        )
        with database.session() as connection:
            connection.execute(
                "UPDATE weekly_reviews SET stale_at = ? WHERE id = ? AND user_id = ?",
                ("2026-06-14T18:00:00Z", generated.json()["id"], account.id),
            )
            result = NextActionService(
                connection,
                account,
                now=lambda: FIXED_NOW,
            ).recommend(NextActionRequest(available_minutes=60))

    assert generated.status_code == 200
    assert "review_stale" in {item.code for item in result.uncertainties}
    assert all(item.kind != "review_step" for item in [
        result.recommendation,
        *result.alternatives,
    ] if item is not None)


async def test_completed_task_linked_from_current_plan_is_a_conflict(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        account = await _account(client, "Next action conflict owner")
        project = (await client.post("/projects", json={"title": "Coursework"})).json()
        task = (
            await client.post(
                "/tasks",
                json={"project_id": project["id"], "title": "Submit essay"},
            )
        ).json()
        plan = await client.post(
            "/weekly-plans",
            json={
                "week_start": "2026-06-08",
                "week_end": "2026-06-14",
                "items": [
                    {
                        "task_id": task["id"],
                        "title": "Submit essay",
                        "planned_minutes": 60,
                    }
                ],
            },
        )
        completed = await client.patch(
            f"/tasks/{task['id']}",
            json={"expected_version": task["version"], "status": "completed"},
        )
        with database.session() as connection:
            result = NextActionService(
                connection,
                account,
                now=lambda: FIXED_NOW,
            ).recommend(NextActionRequest(available_minutes=30))

    assert plan.status_code == 201
    assert completed.status_code == 200
    assert result.status == "conflict"
    assert "plan_task_conflict" in {item.code for item in result.uncertainties}
    assert all(
        item.task_id != task["id"]
        for item in [result.recommendation, *result.alternatives]
        if item is not None
    )


async def test_candidate_collection_is_bounded_and_reports_omissions(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        account = await _account(client, "Next action bounded owner")
        project = (await client.post("/projects", json={"title": "Study queue"})).json()
        for index in range(25):
            created = await client.post(
                "/tasks",
                json={
                    "project_id": project["id"],
                    "title": f"Study item {index + 1}",
                    "priority": 3,
                    "estimated_minutes": 30,
                },
            )
            assert created.status_code == 201
        with database.session() as connection:
            result = NextActionService(
                connection,
                account,
                now=lambda: FIXED_NOW,
            ).recommend(NextActionRequest(available_minutes=30))

    assert result.candidate_count >= 25
    assert result.omitted_candidate_count == result.candidate_count - 20
    assert len(result.alternatives) == 3
    assert "candidate_limit_reached" in {
        item.code for item in result.uncertainties
    }
