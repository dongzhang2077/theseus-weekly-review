from __future__ import annotations

import httpx
import pytest

from backend.app.main import create_app
from backend.app.services import import_sample_week
from tests.support import create_and_select_api_user, load_sample_payload


pytestmark = pytest.mark.anyio

WEEK_QUERY = {
    "week_start": "2026-06-08",
    "week_end": "2026-06-14",
}


async def test_assistant_context_is_authenticated_and_read_only_in_openapi(
    database,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        unauthorized = await client.get("/assistant/context", params=WEEK_QUERY)
        schema = (await client.get("/openapi.json")).json()

    assert unauthorized.status_code == 401
    assert set(schema["paths"]["/assistant/context"]) == {"get"}
    operation = schema["paths"]["/assistant/context"]["get"]
    assert operation["security"] == [{"HTTPBearer": []}]
    assert operation["responses"]["200"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/AssistantContextRead"
    }


async def test_assistant_context_returns_stable_empty_shape(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        user = await create_and_select_api_user(client, "Empty context owner")
        response = await client.get("/assistant/context", params=WEEK_QUERY)

    assert response.status_code == 200
    payload = response.json()
    assert payload == {
        "context_version": "v1",
        "user_id": user["id"],
        "timezone": "UTC",
        "locale": "en",
        "week_start": "2026-06-08",
        "week_end": "2026-06-14",
        "goals": [],
        "projects": [],
        "tasks": [],
        "activities": [],
        "weekly_plan": None,
        "open_focus_sessions": [],
        "time_logs": [],
        "latest_review": None,
        "preferences": [],
    }


async def test_assistant_context_aggregates_owned_week_without_generated_text(
    database,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        user = await create_and_select_api_user(client, "Context owner")
        with database.session() as connection:
            import_sample_week(connection, user["id"], load_sample_payload())
        projects = (await client.get("/projects")).json()
        inactive_goal = (
            await client.post(
                "/goals",
                json={
                    "title": "Paused direction",
                    "priority": 9,
                    "active_status": False,
                },
            )
        ).json()
        archived_project = (
            await client.post(
                "/projects",
                json={
                    "goal_id": inactive_goal["id"],
                    "title": "Archived experiment",
                    "stage": "dormant",
                    "weekly_min_minutes": 0,
                    "weekly_target_minutes": 0,
                    "status": "archived",
                },
            )
        ).json()
        archived_activity = (
            await client.post(
                "/activities",
                json={
                    "project_id": archived_project["id"],
                    "name": "Old workflow",
                    "activity_type": "neutral",
                },
            )
        ).json()
        active_activity = (
            await client.post(
                "/activities",
                json={
                    "project_id": projects[0]["id"],
                    "name": "Current workflow",
                    "activity_type": "neutral",
                },
            )
        ).json()
        open_task = (
            await client.post(
                "/tasks",
                json={
                    "project_id": projects[0]["id"],
                    "title": "Current outcome",
                },
            )
        ).json()
        completed_task = (
            await client.post(
                "/tasks",
                json={
                    "project_id": projects[0]["id"],
                    "title": "Finished outcome",
                },
            )
        ).json()
        completed_task = (
            await client.patch(
                f"/tasks/{completed_task['id']}",
                json={
                    "expected_version": completed_task["version"],
                    "status": "completed",
                },
            )
        ).json()
        preference = await client.post(
            "/preferences",
            json={
                "preference_key": "focus.default_minutes",
                "value": 45,
            },
        )
        generated = await client.post(
            "/reviews/weekly/generate",
            json={**WEEK_QUERY, "mode": "deterministic_first"},
        )
        response = await client.get("/assistant/context", params=WEEK_QUERY)

    assert preference.status_code == 201
    assert generated.status_code == 200
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["goals"]) == 2
    assert len(payload["projects"]) == 3
    assert {item["id"] for item in payload["tasks"]} == {open_task["id"]}
    assert completed_task["id"] not in {item["id"] for item in payload["tasks"]}
    assert {item["id"] for item in payload["activities"]} == {
        active_activity["id"]
    }
    assert archived_activity["id"] not in {
        item["id"] for item in payload["activities"]
    }
    assert len(payload["time_logs"]) == 5
    assert payload["weekly_plan"]["week_start"] == WEEK_QUERY["week_start"]
    assert payload["preferences"][0]["preference_key"] == "focus.default_minutes"
    assert payload["latest_review"]["id"] == generated.json()["id"]
    assert payload["latest_review"]["risk_flags"] == generated.json()["risk_flags"]
    assert "generated_text" not in payload["latest_review"]
    assert "evidence" not in payload["latest_review"]
    assert {item["user_id"] for item in payload["goals"]} == {user["id"]}
    assert {item["user_id"] for item in payload["time_logs"]} == {user["id"]}


async def test_assistant_context_does_not_leak_another_account(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        owner = await create_and_select_api_user(client, "First context owner")
        with database.session() as connection:
            import_sample_week(connection, owner["id"], load_sample_payload())

        second = await create_and_select_api_user(client, "Second context owner")
        response = await client.get("/assistant/context", params=WEEK_QUERY)

    assert response.status_code == 200
    payload = response.json()
    assert payload["user_id"] == second["id"]
    assert payload["goals"] == []
    assert payload["projects"] == []
    assert payload["weekly_plan"] is None
    assert payload["time_logs"] == []


@pytest.mark.parametrize(
    ("week_start", "week_end"),
    (
        ("2026-06-14", "2026-06-08"),
        ("2026-01-01", "2026-02-15"),
    ),
)
async def test_assistant_context_rejects_invalid_or_unbounded_windows(
    database,
    week_start: str,
    week_end: str,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client, "Window owner")
        response = await client.get(
            "/assistant/context",
            params={"week_start": week_start, "week_end": week_end},
        )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "invalid_context_window"
