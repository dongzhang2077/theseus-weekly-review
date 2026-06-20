import httpx
import pytest

from backend.app.main import create_app


pytestmark = pytest.mark.anyio


async def test_weekly_plan_api_creates_plan_with_items_and_lists(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
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
