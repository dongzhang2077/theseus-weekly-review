from __future__ import annotations

import httpx
import pytest

from backend.app.main import create_app
from tests.support import create_and_select_api_user


pytestmark = pytest.mark.anyio


async def test_focus_openapi_exposes_two_tap_contract(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        schema = (await client.get("/openapi.json")).json()

    assert {"get", "post"} <= set(schema["paths"]["/focus-sessions"])
    assert {"get"} <= set(schema["paths"]["/focus-sessions/{session_id}"])
    assert {"post"} <= set(
        schema["paths"]["/focus-sessions/{session_id}/commands"]
    )
    command = schema["components"]["schemas"]["FocusSessionCommand"]["properties"]
    assert command["command"]["enum"] == ["end", "cancel"]
    assert "note" not in command


async def test_focus_api_starts_ends_replays_and_isolates_accounts(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client, "First focus owner")
        first_authorization = client.headers["Authorization"]
        project = (await client.post("/projects", json={"title": "Final report"})).json()
        activity = (
            await client.post(
                "/activities",
                json={
                    "project_id": project["id"],
                    "name": "Focused writing",
                    "activity_type": "consuming",
                },
            )
        ).json()
        task = (
            await client.post(
                "/tasks",
                json={"project_id": project["id"], "title": "Draft findings"},
            )
        ).json()

        missing_key = await client.post(
            "/focus-sessions",
            json={"activity_id": activity["id"]},
        )
        started = await client.post(
            "/focus-sessions",
            headers={"Idempotency-Key": "api-start"},
            json={"activity_id": activity["id"], "task_id": task["id"]},
        )
        replayed_start = await client.post(
            "/focus-sessions",
            headers={"Idempotency-Key": "api-start"},
            json={"activity_id": activity["id"], "task_id": task["id"]},
        )
        open_sessions = await client.get("/focus-sessions?state=open")

        await create_and_select_api_user(client, "Second focus owner")
        foreign_start = await client.post(
            "/focus-sessions",
            headers={"Idempotency-Key": "foreign-start"},
            json={"activity_id": activity["id"]},
        )
        foreign_get = await client.get(
            f"/focus-sessions/{started.json()['id']}"
        )

        client.headers["Authorization"] = first_authorization
        ended = await client.post(
            f"/focus-sessions/{started.json()['id']}/commands",
            headers={"Idempotency-Key": "api-end"},
            json={"command": "end", "expected_version": 1},
        )
        replayed_end = await client.post(
            f"/focus-sessions/{started.json()['id']}/commands",
            headers={"Idempotency-Key": "api-end"},
            json={"command": "end", "expected_version": 1},
        )
        new_end = await client.post(
            f"/focus-sessions/{started.json()['id']}/commands",
            headers={"Idempotency-Key": "api-end-again"},
            json={"command": "end", "expected_version": 1},
        )
        logs = await client.get("/time-logs")
        task_after = await client.get(f"/tasks/{task['id']}")

    assert missing_key.status_code == 422
    assert started.status_code == 201
    assert replayed_start.json() == started.json()
    assert open_sessions.json() == [started.json()]
    assert foreign_start.status_code == 409
    assert foreign_get.status_code == 404
    assert ended.status_code == 200
    assert replayed_end.json() == ended.json()
    assert ended.json()["session"]["status"] == "completed"
    assert ended.json()["session"]["version"] == 2
    assert len(ended.json()["time_logs"]) == 1
    assert ended.json()["time_logs"][0]["duration_seconds"] >= 1
    assert new_end.status_code == 409
    assert new_end.json()["detail"]["code"] == "version_conflict"
    assert len(logs.json()) == 1
    assert logs.json()[0]["focus_session_id"] == started.json()["id"]
    assert task_after.json()["status"] == "in_progress"


async def test_running_focus_survives_database_and_application_restart(database) -> None:
    first_app = create_app(database.path)
    first_transport = httpx.ASGITransport(app=first_app)
    async with httpx.AsyncClient(
        transport=first_transport,
        base_url="http://test",
    ) as client:
        await create_and_select_api_user(
            client,
            "Focus restart owner",
            email="focus-restart@example.com",
        )
        activity = (
            await client.post(
                "/activities",
                json={"name": "Persistent timer", "activity_type": "neutral"},
            )
        ).json()
        started = (
            await client.post(
                "/focus-sessions",
                headers={"Idempotency-Key": "restart-start"},
                json={"activity_id": activity["id"]},
            )
        ).json()

    database.initialize()
    second_app = create_app(database.path)
    second_transport = httpx.ASGITransport(app=second_app)
    async with httpx.AsyncClient(
        transport=second_transport,
        base_url="http://test",
    ) as client:
        login = await client.post(
            "/auth/login",
            json={
                "email": "focus-restart@example.com",
                "password": "correct horse battery staple",
            },
        )
        client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"
        running = await client.get("/focus-sessions?state=open")
        ended = await client.post(
            f"/focus-sessions/{started['id']}/commands",
            headers={"Idempotency-Key": "restart-end"},
            json={"command": "end", "expected_version": 1},
        )

    assert login.status_code == 200
    assert [item["id"] for item in running.json()] == [started["id"]]
    assert running.json()[0]["status"] == "running"
    assert ended.status_code == 200
    assert ended.json()["session"]["status"] == "completed"
