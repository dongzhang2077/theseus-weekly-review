import httpx
import pytest

from backend.app.main import create_app


pytestmark = pytest.mark.anyio


async def test_goal_api_creates_and_lists_in_priority_order(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        second = await client.post("/goals", json={"title": "Second", "priority": 2})
        first = await client.post("/goals", json={"title": "First", "priority": 1})
        response = await client.get("/goals")

    assert second.status_code == 201
    assert first.status_code == 201
    assert [goal["title"] for goal in response.json()] == ["First", "Second"]
    assert response.json()[0]["created_at"]
    assert response.json()[0]["updated_at"]


async def test_goal_api_rejects_invalid_payload(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/goals", json={"id": 1, "title": ""})

    assert response.status_code == 422
