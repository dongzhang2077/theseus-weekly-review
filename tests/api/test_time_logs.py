import httpx
import pytest

from backend.app.main import create_app
from tests.support import create_and_select_api_user


pytestmark = pytest.mark.anyio


async def test_time_log_api_creates_project_linked_and_ad_hoc_logs(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client)
        goal = (await client.post("/goals", json={"title": "Build MVP"})).json()
        project = (
            await client.post(
            "/projects",
            json={"goal_id": goal["id"], "title": "Backend"},
            )
        ).json()
        linked = await client.post(
            "/time-logs",
            json={
                "project_id": project["id"],
                "date": "2026-06-10",
                "start_time": "09:00",
                "end_time": "10:00",
                "duration_minutes": 60,
                "activity_name": "Backend schema",
                "activity_type": "consuming",
                "type_source": "user_corrected",
            },
        )
        ad_hoc = await client.post(
            "/time-logs",
            json={
                "date": "2026-06-09",
                "duration_minutes": 30,
                "activity_name": "Walk",
                "activity_type": "restore",
            },
        )
        response = await client.get("/time-logs")

    assert linked.status_code == 201
    assert ad_hoc.status_code == 201
    assert [log["activity_name"] for log in response.json()] == ["Walk", "Backend schema"]
    assert response.json()[1]["type_source"] == "user_corrected"
    assert response.json()[1]["project_id"] == project["id"]


async def test_time_log_api_validates_references_types_and_times(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client)
        missing_project = await client.post(
            "/time-logs",
            json={
                "project_id": 999,
                "date": "2026-06-10",
                "duration_minutes": 60,
                "activity_name": "Backend schema",
                "activity_type": "consuming",
            },
        )
        invalid_type = await client.post(
            "/time-logs",
            json={
                "date": "2026-06-10",
                "duration_minutes": 60,
                "activity_name": "Backend schema",
                "activity_type": "unknown",
            },
        )
        invalid_time_pair = await client.post(
            "/time-logs",
            json={
                "date": "2026-06-10",
                "start_time": "09:00",
                "duration_minutes": 60,
                "activity_name": "Backend schema",
                "activity_type": "consuming",
            },
        )
        invalid_duration = await client.post(
            "/time-logs",
            json={
                "date": "2026-06-10",
                "duration_minutes": 0,
                "activity_name": "Backend schema",
                "activity_type": "consuming",
            },
        )

    assert missing_project.status_code == 409
    assert invalid_type.status_code == 422
    assert invalid_time_pair.status_code == 422
    assert invalid_duration.status_code == 422


async def test_time_log_batch_is_ordered_authenticated_and_atomic(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client)
        goal = (await client.post("/goals", json={"title": "Build MVP"})).json()
        project = (
            await client.post(
                "/projects",
                json={"goal_id": goal["id"], "title": "Frontend"},
            )
        ).json()
        created = await client.post(
            "/time-logs/batch",
            json={
                "time_logs": [
                    {
                        "project_id": project["id"],
                        "date": "2026-07-18",
                        "duration_minutes": 30,
                        "activity_name": "Cross-day focus",
                        "activity_type": "consuming",
                    },
                    {
                        "project_id": project["id"],
                        "date": "2026-07-19",
                        "duration_minutes": 20,
                        "activity_name": "Cross-day focus",
                        "activity_type": "consuming",
                    },
                ]
            },
        )
        rejected = await client.post(
            "/time-logs/batch",
            json={
                "time_logs": [
                    {
                        "project_id": project["id"],
                        "date": "2026-07-20",
                        "duration_minutes": 10,
                        "activity_name": "Valid first row",
                        "activity_type": "neutral",
                    },
                    {
                        "project_id": 999,
                        "date": "2026-07-20",
                        "duration_minutes": 10,
                        "activity_name": "Invalid second row",
                        "activity_type": "neutral",
                    },
                ]
            },
        )
        listed = await client.get("/time-logs")

    assert created.status_code == 201
    assert [row["date"] for row in created.json()] == ["2026-07-18", "2026-07-19"]
    assert rejected.status_code == 409
    assert [row["activity_name"] for row in listed.json()] == [
        "Cross-day focus",
        "Cross-day focus",
    ]
