import httpx
import pytest

from backend.app.main import create_app
from tests.support import create_and_select_api_user


pytestmark = pytest.mark.anyio


async def test_mobile_import_creates_normalized_time_logs(database) -> None:
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
        response = await client.post(
            "/imports/mobile-time-logs",
            json={
                "time_logs": [
                    {
                        "source_record_id": "mobile-1",
                        "project_id": project["id"],
                        "date": "2026-06-10",
                        "start_time": "09:00",
                        "end_time": "10:30",
                        "duration_minutes": 90,
                        "activity_name": "Backend schema design",
                        "activity_type": "consume",
                        "type_source": "user_selected",
                        "note": "Imported from phone.",
                    },
                    {
                        "source_record_id": "mobile-2",
                        "date": "2026-06-10",
                        "duration_minutes": 30,
                        "activity_name": "Walk",
                        "activity_type": "restore",
                    },
                    {
                        "source_record_id": "mobile-3",
                        "date": "2026-06-10",
                        "duration_minutes": 45,
                        "activity_name": "Unmapped activity",
                        "activity_type": "focus",
                    },
                ]
            },
        )
        time_logs = (await client.get("/time-logs")).json()
        projects = (await client.get("/projects")).json()

    assert response.status_code == 201
    assert response.json() == {"imported": 2, "skipped": 1, "needs_mapping": 2}
    assert [log["activity_name"] for log in time_logs] == ["Walk", "Backend schema design"]
    assert time_logs[0]["project_id"] is None
    assert time_logs[1]["activity_type"] == "consuming"
    assert time_logs[1]["project_id"] == project["id"]
    assert time_logs[1]["note"] == "Imported from phone."
    assert projects[0]["last_activity_date"] == "2026-06-10"


async def test_mobile_import_skips_duplicate_source_records_and_missing_project(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client)
        response = await client.post(
            "/imports/mobile-time-logs",
            json={
                "time_logs": [
                    {
                        "source_record_id": "duplicate",
                        "project_id": 999,
                        "date": "2026-06-10",
                        "duration_minutes": 30,
                        "activity_name": "Backend",
                        "activity_type": "consuming",
                    },
                    {
                        "source_record_id": "duplicate",
                        "date": "2026-06-10",
                        "duration_minutes": 30,
                        "activity_name": "Backend duplicate",
                        "activity_type": "consuming",
                    },
                ]
            },
        )
        time_logs = (await client.get("/time-logs")).json()

    assert response.status_code == 201
    assert response.json() == {"imported": 0, "skipped": 2, "needs_mapping": 1}
    assert time_logs == []


async def test_mobile_import_validates_payload_shape(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client)
        empty_batch = await client.post(
            "/imports/mobile-time-logs",
            json={"time_logs": []},
        )
        invalid_time_pair = await client.post(
            "/imports/mobile-time-logs",
            json={
                "time_logs": [
                    {
                        "date": "2026-06-10",
                        "start_time": "09:00",
                        "duration_minutes": 30,
                        "activity_name": "Backend",
                        "activity_type": "consuming",
                    }
                ]
            },
        )
        invalid_duration = await client.post(
            "/imports/mobile-time-logs",
            json={
                "time_logs": [
                    {
                        "date": "2026-06-10",
                        "duration_minutes": 0,
                        "activity_name": "Backend",
                        "activity_type": "consuming",
                    }
                ]
            },
        )

    assert empty_batch.status_code == 422
    assert invalid_time_pair.status_code == 422
    assert invalid_duration.status_code == 422
