import httpx
import pytest

from backend.app.main import create_app


pytestmark = pytest.mark.anyio


async def test_project_api_creates_linked_project_and_lists_by_id(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        goal = (await client.post("/goals", json={"title": "Build MVP"})).json()
        first = await client.post(
            "/projects",
            json={
                "goal_id": goal["id"],
                "title": "Backend",
                "stage": "startup",
                "weekly_min_minutes": 120,
                "weekly_target_minutes": 300,
            },
        )
        second = await client.post("/projects", json={"title": "Unlinked"})
        response = await client.get("/projects")

    assert first.status_code == 201
    assert second.status_code == 201
    assert [project["title"] for project in response.json()] == ["Backend", "Unlinked"]
    assert response.json()[0]["goal_id"] == goal["id"]


async def test_project_api_returns_controlled_error_for_missing_goal(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/projects", json={"goal_id": 999, "title": "Missing"})

    assert response.status_code == 409
    assert response.json()["detail"] == "The project could not be persisted"
