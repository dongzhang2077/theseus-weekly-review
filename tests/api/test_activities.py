import httpx
import pytest

from backend.app.main import create_app
from tests.support import create_and_select_api_user


pytestmark = pytest.mark.anyio


async def test_activity_openapi_exposes_versioned_authenticated_contract(
    database,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        schema = (await client.get("/openapi.json")).json()

    assert {"get", "post"} <= set(schema["paths"]["/activities"])
    assert {"get", "patch"} <= set(schema["paths"]["/activities/{activity_id}"])
    activity_create = schema["components"]["schemas"]["ActivityCreate"]["properties"]
    activity_update = schema["components"]["schemas"]["ActivityUpdate"]["properties"]
    assert activity_create["type_source"]["default"] == "user_selected"
    assert activity_create["type_source"]["const"] == "user_selected"
    assert {"expected_version", "project_id", "activity_type"} <= set(activity_update)
    assert "type_source" not in activity_update


async def test_activity_api_requires_authenticated_account(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/activities")

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "not_authenticated"


async def test_activity_api_creates_filters_corrects_and_preserves_log_snapshot(
    database,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client)
        project = (await client.post("/projects", json={"title": "Final report"})).json()
        other = (await client.post("/projects", json={"title": "Applications"})).json()
        created_response = await client.post(
            "/activities",
            json={
                "project_id": project["id"],
                "name": "  Focused writing  ",
                "description": "Drafting",
                "activity_type": "consuming",
            },
        )
        created = created_response.json()
        saved_log = await client.post(
            "/time-logs",
            json={
                "activity_id": created["id"],
                "project_id": project["id"],
                "date": "2026-07-22",
                "duration_minutes": 25,
                "activity_name": created["name"],
                "activity_type": created["activity_type"],
                "type_source": created["type_source"],
            },
        )
        corrected = await client.patch(
            f"/activities/{created['id']}",
            json={
                "expected_version": 1,
                "project_id": other["id"],
                "name": "Focused revision",
                "activity_type": "restore",
            },
        )
        filtered = await client.get(f"/activities?project_id={other['id']}")
        detail = await client.get(f"/activities/{created['id']}")
        logs = await client.get("/time-logs")

    assert created_response.status_code == 201
    assert created["name"] == "Focused writing"
    assert created["version"] == 1
    assert saved_log.status_code == 201
    assert corrected.status_code == 200
    assert corrected.json()["version"] == 2
    assert corrected.json()["type_source"] == "user_corrected"
    assert filtered.json() == [corrected.json()]
    assert detail.json() == corrected.json()
    assert logs.json()[0]["activity_id"] == created["id"]
    assert logs.json()[0]["activity_name"] == "Focused writing"
    assert logs.json()[0]["activity_type"] == "consuming"


async def test_activity_api_rejects_stale_foreign_and_claimed_provenance(
    database,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client, "First activity owner")
        first_authorization = client.headers["Authorization"]
        project = (await client.post("/projects", json={"title": "Private"})).json()
        activity = (
            await client.post(
                "/activities",
                json={
                    "project_id": project["id"],
                    "name": "Private activity",
                    "activity_type": "neutral",
                },
            )
        ).json()
        updated = await client.patch(
            f"/activities/{activity['id']}",
            json={"expected_version": 1, "name": "Current title"},
        )
        stale = await client.patch(
            f"/activities/{activity['id']}",
            json={"expected_version": 1, "name": "Stale title"},
        )

        await create_and_select_api_user(client, "Second activity owner")
        foreign_create = await client.post(
            "/activities",
            json={
                "project_id": project["id"],
                "name": "Cross-account activity",
                "activity_type": "neutral",
            },
        )
        foreign_get = await client.get(f"/activities/{activity['id']}")
        foreign_patch = await client.patch(
            f"/activities/{activity['id']}",
            json={"expected_version": 2, "name": "Take over"},
        )
        claimed_source = await client.post(
            "/activities",
            json={
                "name": "Claimed AI activity",
                "activity_type": "neutral",
                "type_source": "ai_suggested",
            },
        )
        client.headers["Authorization"] = first_authorization
        first_activities = await client.get("/activities")

    assert updated.status_code == 200
    assert stale.status_code == 409
    assert stale.json()["detail"]["code"] == "version_conflict"
    assert stale.json()["detail"]["current"]["version"] == 2
    assert foreign_create.status_code == 409
    assert foreign_get.status_code == 404
    assert foreign_patch.status_code == 404
    assert claimed_source.status_code == 422
    assert [item["name"] for item in first_activities.json()] == ["Current title"]


async def test_activity_survives_database_and_application_restart(database) -> None:
    first_app = create_app(database.path)
    first_transport = httpx.ASGITransport(app=first_app)
    async with httpx.AsyncClient(
        transport=first_transport,
        base_url="http://test",
    ) as client:
        await create_and_select_api_user(
            client,
            "Restart activity owner",
            email="activity-restart@example.com",
        )
        created = (
            await client.post(
                "/activities",
                json={
                    "name": "Persist across restart",
                    "activity_type": "neutral",
                },
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
                "email": "activity-restart@example.com",
                "password": "correct horse battery staple",
            },
        )
        client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"
        activities = await client.get("/activities")

    assert login.status_code == 200
    assert [activity["id"] for activity in activities.json()] == [created["id"]]
    assert activities.json()[0]["name"] == "Persist across restart"
