import httpx
import pytest

from backend.app.main import create_app
from tests.support import create_and_select_api_user


pytestmark = pytest.mark.anyio


async def test_weekly_plan_api_creates_plan_with_items_and_lists(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client)
        goal = (await client.post("/goals", json={"title": "Build MVP"})).json()
        backend = (
            await client.post(
            "/projects",
            json={"goal_id": goal["id"], "title": "Backend"},
            )
        ).json()
        frontend = (
            await client.post(
            "/projects",
            json={"goal_id": goal["id"], "title": "Frontend"},
            )
        ).json()
        created = await client.post(
            "/weekly-plans",
            json={
                "week_start": "2026-06-08",
                "week_end": "2026-06-14",
                "planned_capacity_minutes": 1800,
                "slack_target_percent": 20,
                "items": [
                    {
                        "project_id": frontend["id"],
                        "title": "Draft review page",
                        "planned_minutes": 120,
                        "priority": 2,
                    },
                    {
                        "project_id": backend["id"],
                        "title": "Implement API",
                        "planned_minutes": 240,
                        "priority": 1,
                    },
                ],
                "note": "Sprint 1",
            },
        )
        response = await client.get("/weekly-plans")

    assert created.status_code == 201
    assert created.json()["id"] == 1
    assert [item["title"] for item in created.json()["items"]] == [
        "Implement API",
        "Draft review page",
    ]
    assert created.json()["items"][0]["id"]
    assert response.json()[0] == created.json()


async def test_weekly_plan_api_rolls_back_failed_item_creation(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client)
        response = await client.post(
            "/weekly-plans",
            json={
                "week_start": "2026-06-08",
                "week_end": "2026-06-14",
                "items": [
                    {
                        "project_id": 999,
                        "title": "Missing project",
                        "planned_minutes": 30,
                    }
                ],
            },
        )
        plans = await client.get("/weekly-plans")

    assert response.status_code == 409
    assert plans.json() == []


async def test_weekly_plan_api_validates_range_capacity_slack_and_item_minutes(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client)
        invalid_range = await client.post(
            "/weekly-plans",
            json={"week_start": "2026-06-15", "week_end": "2026-06-14"},
        )
        invalid_capacity = await client.post(
            "/weekly-plans",
            json={
                "week_start": "2026-06-08",
                "week_end": "2026-06-14",
                "planned_capacity_minutes": -1,
            },
        )
        invalid_slack = await client.post(
            "/weekly-plans",
            json={
                "week_start": "2026-06-08",
                "week_end": "2026-06-14",
                "slack_target_percent": 101,
            },
        )
        invalid_item = await client.post(
            "/weekly-plans",
            json={
                "week_start": "2026-06-08",
                "week_end": "2026-06-14",
                "items": [{"title": "No time", "planned_minutes": 0}],
            },
        )

    assert invalid_range.status_code == 422
    assert invalid_capacity.status_code == 422
    assert invalid_slack.status_code == 422
    assert invalid_item.status_code == 422


async def test_weekly_plan_api_replaces_and_deletes_a_user_owned_plan(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client)
        created = await client.post(
            "/weekly-plans",
            json={
                "week_start": "2026-06-15",
                "week_end": "2026-06-21",
                "planned_capacity_minutes": 600,
                "items": [{"title": "Original block", "planned_minutes": 60}],
            },
        )
        plan_id = created.json()["id"]
        replaced = await client.put(
            f"/weekly-plans/{plan_id}",
            json={
                "week_start": "2026-06-15",
                "week_end": "2026-06-21",
                "planned_capacity_minutes": 720,
                "items": [{"title": "Adjusted block", "planned_minutes": 120}],
            },
        )
        listed = await client.get("/weekly-plans")
        deleted = await client.delete(f"/weekly-plans/{plan_id}")
        after_delete = await client.get("/weekly-plans")

    assert replaced.status_code == 200
    assert replaced.json()["id"] == plan_id
    assert replaced.json()["planned_capacity_minutes"] == 720
    assert [item["title"] for item in replaced.json()["items"]] == ["Adjusted block"]
    assert listed.json() == [replaced.json()]
    assert deleted.status_code == 204
    assert after_delete.json() == []


async def test_weekly_plan_api_preserves_old_plan_when_replace_fails(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client)
        created = await client.post(
            "/weekly-plans",
            json={
                "week_start": "2026-06-15",
                "week_end": "2026-06-21",
                "items": [{"title": "Keep me", "planned_minutes": 60}],
            },
        )
        plan_id = created.json()["id"]
        failed = await client.put(
            f"/weekly-plans/{plan_id}",
            json={
                "week_start": "2026-06-15",
                "week_end": "2026-06-21",
                "items": [
                    {
                        "project_id": 999,
                        "title": "Missing project",
                        "planned_minutes": 60,
                    }
                ],
            },
        )
        listed = await client.get("/weekly-plans")

    assert failed.status_code == 409
    assert [item["title"] for item in listed.json()[0]["items"]] == ["Keep me"]


async def test_weekly_plan_replace_and_delete_hide_other_users_records(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        first = await create_and_select_api_user(client, "First")
        first_authorization = client.headers["Authorization"]
        created = await client.post(
            "/weekly-plans",
            json={
                "week_start": "2026-06-15",
                "week_end": "2026-06-21",
                "items": [{"title": "Private block", "planned_minutes": 60}],
            },
        )
        plan_id = created.json()["id"]
        second = await create_and_select_api_user(client, "Second")
        replace = await client.put(
            f"/weekly-plans/{plan_id}",
            json={
                "week_start": "2026-06-15",
                "week_end": "2026-06-21",
                "items": [{"title": "Take over", "planned_minutes": 60}],
            },
        )
        delete = await client.delete(f"/weekly-plans/{plan_id}")
        client.headers["Authorization"] = first_authorization
        first_plans = await client.get("/weekly-plans")

    assert second["id"] != first["id"]
    assert replace.status_code == 404
    assert delete.status_code == 404
    assert [item["title"] for item in first_plans.json()[0]["items"]] == [
        "Private block"
    ]
