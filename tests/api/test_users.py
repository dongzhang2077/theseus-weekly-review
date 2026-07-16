import httpx
import pytest

from backend.app.main import create_app
from tests.support import LOCAL_USER_HEADER, create_and_select_api_user


pytestmark = pytest.mark.anyio


async def test_user_api_creates_lists_and_survives_app_restart(database) -> None:
    first_app = create_app(database.path)
    first_transport = httpx.ASGITransport(app=first_app)
    async with httpx.AsyncClient(
        transport=first_transport,
        base_url="http://test",
    ) as client:
        created = await client.post(
            "/users",
            json={
                "display_name": "Douglas",
                "timezone": "America/Vancouver",
                "locale": "en-CA",
            },
        )

    second_app = create_app(database.path)
    second_transport = httpx.ASGITransport(app=second_app)
    async with httpx.AsyncClient(
        transport=second_transport,
        base_url="http://test",
    ) as client:
        listed = await client.get("/users")
        fetched = await client.get(f"/users/{created.json()['id']}")

    assert created.status_code == 201
    assert listed.json() == [created.json()]
    assert fetched.json() == created.json()


async def test_user_context_is_required_and_unknown_user_returns_404(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        missing = await client.get("/goals")
        unknown = await client.get(
            "/goals",
            headers={LOCAL_USER_HEADER: "999"},
        )

    assert missing.status_code == 422
    assert unknown.status_code == 404
    assert unknown.json()["detail"] == "Local user 999 was not found"


async def test_user_creation_trims_text_and_rejects_blank_names(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        trimmed = await client.post(
            "/users",
            json={"display_name": "  Douglas  ", "timezone": "  UTC  "},
        )
        blank = await client.post("/users", json={"display_name": "   "})

    assert trimmed.status_code == 201
    assert trimmed.json()["display_name"] == "Douglas"
    assert trimmed.json()["timezone"] == "UTC"
    assert blank.status_code == 422


async def test_user_context_isolates_records_and_rejects_cross_user_links(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        first = await create_and_select_api_user(client, "First")
        first_goal = (
            await client.post("/goals", json={"title": "First goal"})
        ).json()

        second = await create_and_select_api_user(client, "Second")
        second_goal = await client.post("/goals", json={"title": "Second goal"})
        cross_user_project = await client.post(
            "/projects",
            json={"goal_id": first_goal["id"], "title": "Invalid project"},
        )
        second_goals = await client.get("/goals")
        first_goals = await client.get(
            "/goals",
            headers={LOCAL_USER_HEADER: str(first["id"])},
        )

    assert second_goal.status_code == 201
    assert cross_user_project.status_code == 409
    assert [goal["title"] for goal in second_goals.json()] == ["Second goal"]
    assert [goal["title"] for goal in first_goals.json()] == ["First goal"]
    assert second_goals.json()[0]["user_id"] == second["id"]
