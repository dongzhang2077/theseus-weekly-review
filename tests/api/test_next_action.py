from __future__ import annotations

from datetime import date

import httpx
import pytest

from backend.app.main import create_app
from tests.support import create_and_select_api_user


pytestmark = pytest.mark.anyio


async def _create_task_context(client: httpx.AsyncClient, title: str) -> dict:
    goal = (
        await client.post(
            "/goals",
            json={"title": f"{title} goal", "priority": 1},
        )
    ).json()
    project = (
        await client.post(
            "/projects",
            json={
                "goal_id": goal["id"],
                "title": f"{title} project",
                "stage": "startup",
                "weekly_min_minutes": 60,
                "weekly_target_minutes": 180,
            },
        )
    ).json()
    response = await client.post(
        "/tasks",
        json={
            "project_id": project["id"],
            "title": title,
            "priority": 1,
            "estimated_minutes": 25,
            "due_date": date.today().isoformat(),
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_next_action_is_authenticated_and_explicit_in_openapi(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        unauthorized = await client.post(
            "/assistant/next-action",
            json={"available_minutes": 30},
        )
        schema = (await client.get("/openapi.json")).json()

    assert unauthorized.status_code == 401
    operation = schema["paths"]["/assistant/next-action"]["post"]
    assert operation["security"] == [{"HTTPBearer": []}]
    assert operation["requestBody"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/NextActionRequest"
    }
    assert operation["responses"]["200"]["content"]["application/json"][
        "schema"
    ] == {"$ref": "#/components/schemas/NextActionRead"}


async def test_next_action_returns_structured_local_evidence(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client, "Next action API owner")
        task = await _create_task_context(client, "Submit assignment")
        response = await client.post(
            "/assistant/next-action",
            json={"available_minutes": 30},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["context_version"] == "next-action-v1"
    assert payload["status"] == "ready"
    assert payload["available_time_source"] == "request"
    assert payload["recommendation"]["task_id"] == task["id"]
    assert payload["recommendation"]["title"] == "Submit assignment"
    assert payload["recommendation"]["evidence"]
    assert payload["uncertainties"][0]["code"] == "calendar_unavailable"
    assert "user_id" not in response.text
    assert "generated_text" not in response.text


async def test_next_action_does_not_leak_another_account(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client, "Next action first account")
        first_task = await _create_task_context(client, "Private first task")
        await create_and_select_api_user(client, "Next action second account")
        response = await client.post(
            "/assistant/next-action",
            json={"available_minutes": 30},
        )

    assert response.status_code == 200
    assert response.json()["status"] == "empty"
    assert response.json()["recommendation"] is None
    assert str(first_task["id"]) not in {
        str(item.get("task_id"))
        for item in response.json()["alternatives"]
    }
    assert "Private first task" not in response.text


async def test_next_action_rejects_invalid_available_time(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client, "Next action validation owner")
        too_short = await client.post(
            "/assistant/next-action",
            json={"available_minutes": 4},
        )
        too_long = await client.post(
            "/assistant/next-action",
            json={"available_minutes": 721},
        )

    assert too_short.status_code == 422
    assert too_long.status_code == 422


async def test_next_action_reports_invalid_account_timezone(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client, "Next action timezone owner")
        profile = await client.patch(
            "/auth/me",
            json={"timezone": "Not/A_Timezone"},
        )
        response = await client.post(
            "/assistant/next-action",
            json={"available_minutes": 30},
        )

    assert profile.status_code == 200
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "invalid_account_timezone"
