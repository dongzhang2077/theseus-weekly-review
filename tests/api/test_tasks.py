import httpx
import pytest

from backend.app.main import create_app
from tests.support import create_and_select_api_user


pytestmark = pytest.mark.anyio


async def test_task_openapi_exposes_versioned_contract_without_public_provenance(
    database,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        schema = (await client.get("/openapi.json")).json()

    assert {"get", "post"} <= set(schema["paths"]["/tasks"])
    assert {"get", "patch"} <= set(schema["paths"]["/tasks/{task_id}"])
    task_create = schema["components"]["schemas"]["TaskCreate"]["properties"]
    task_update = schema["components"]["schemas"]["TaskUpdate"]["properties"]
    planned_item = schema["components"]["schemas"]["PlannedItemCreate"]["properties"]
    assert "created_source" not in task_create
    assert {"expected_version", "status", "archived"} <= set(task_update)
    assert "task_id" in planned_item


async def test_task_api_requires_authenticated_account(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/tasks")

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "not_authenticated"


async def test_task_api_creates_filters_and_reads_durable_tasks(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client)
        project = (await client.post("/projects", json={"title": "Final report"})).json()
        later = await client.post(
            "/tasks",
            json={
                "project_id": project["id"],
                "title": "Draft discussion",
                "priority": 2,
                "due_date": "2026-08-02",
            },
        )
        sooner = await client.post(
            "/tasks",
            json={
                "project_id": project["id"],
                "title": "Draft findings",
                "description": "Include limitations.",
                "priority": 1,
                "estimated_minutes": 180,
                "due_date": "2026-08-01",
            },
        )
        listed = await client.get(
            f"/tasks?project_id={project['id']}&status=open&due_to=2026-08-01"
        )
        detail = await client.get(f"/tasks/{sooner.json()['id']}")

    assert later.status_code == 201
    assert sooner.status_code == 201
    assert sooner.json()["status"] == "open"
    assert sooner.json()["created_source"] == "user"
    assert sooner.json()["version"] == 1
    assert sooner.json()["completed_at"] is None
    assert [task["title"] for task in listed.json()] == ["Draft findings"]
    assert detail.json() == sooner.json()


async def test_task_api_enforces_lifecycle_archive_and_version_conflicts(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client)
        project = (await client.post("/projects", json={"title": "Final report"})).json()
        task = (
            await client.post(
                "/tasks",
                json={"project_id": project["id"], "title": "Draft findings"},
            )
        ).json()
        completed = await client.patch(
            f"/tasks/{task['id']}",
            json={"expected_version": 1, "status": "completed"},
        )
        invalid = await client.patch(
            f"/tasks/{task['id']}",
            json={"expected_version": 2, "status": "open"},
        )
        reopened = await client.patch(
            f"/tasks/{task['id']}",
            json={"expected_version": 2, "status": "in_progress"},
        )
        stale = await client.patch(
            f"/tasks/{task['id']}",
            json={"expected_version": 2, "title": "Stale title"},
        )
        archived = await client.patch(
            f"/tasks/{task['id']}",
            json={"expected_version": 3, "archived": True},
        )
        hidden_list = await client.get("/tasks")
        hidden_detail = await client.get(f"/tasks/{task['id']}")
        visible_detail = await client.get(
            f"/tasks/{task['id']}?include_archived=true"
        )
        restored = await client.patch(
            f"/tasks/{task['id']}",
            json={"expected_version": 4, "archived": False},
        )

    assert completed.status_code == 200
    assert completed.json()["completed_at"] is not None
    assert invalid.status_code == 409
    assert invalid.json()["detail"]["code"] == "invalid_task_transition"
    assert reopened.json()["status"] == "in_progress"
    assert reopened.json()["completed_at"] is None
    assert stale.status_code == 409
    assert stale.json()["detail"]["code"] == "version_conflict"
    assert stale.json()["detail"]["current"]["version"] == 3
    assert archived.json()["archived_at"] is not None
    assert hidden_list.json() == []
    assert hidden_detail.status_code == 404
    assert visible_detail.status_code == 200
    assert restored.json()["archived_at"] is None


async def test_task_api_hides_other_accounts_and_rejects_claimed_provenance(
    database,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        first = await create_and_select_api_user(client, "First task owner")
        first_authorization = client.headers["Authorization"]
        project = (await client.post("/projects", json={"title": "Private"})).json()
        task = (
            await client.post(
                "/tasks",
                json={"project_id": project["id"], "title": "Private task"},
            )
        ).json()
        second = await create_and_select_api_user(client, "Second task owner")
        foreign_create = await client.post(
            "/tasks",
            json={"project_id": project["id"], "title": "Cross-account task"},
        )
        foreign_get = await client.get(f"/tasks/{task['id']}?include_archived=true")
        foreign_patch = await client.patch(
            f"/tasks/{task['id']}",
            json={"expected_version": 1, "title": "Take over"},
        )
        own_project = (await client.post("/projects", json={"title": "Own"})).json()
        claimed_source = await client.post(
            "/tasks",
            json={
                "project_id": own_project["id"],
                "title": "Claimed assistant task",
                "created_source": "assistant_approved",
            },
        )
        client.headers["Authorization"] = first_authorization
        first_tasks = await client.get("/tasks")

    assert second["id"] != first["id"]
    assert foreign_create.status_code == 409
    assert foreign_get.status_code == 404
    assert foreign_patch.status_code == 404
    assert claimed_source.status_code == 422
    assert [item["title"] for item in first_tasks.json()] == ["Private task"]


async def test_weekly_plan_can_reference_task_and_preserves_ad_hoc_items(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client)
        project = (await client.post("/projects", json={"title": "Final report"})).json()
        other_project = (await client.post("/projects", json={"title": "Other"})).json()
        task = (
            await client.post(
                "/tasks",
                json={"project_id": project["id"], "title": "Draft findings"},
            )
        ).json()
        created = await client.post(
            "/weekly-plans",
            json={
                "week_start": "2026-07-27",
                "week_end": "2026-08-02",
                "items": [
                    {
                        "task_id": task["id"],
                        "title": "Draft findings section",
                        "planned_minutes": 120,
                    },
                    {
                        "title": "Inbox cleanup",
                        "planned_minutes": 30,
                    },
                ],
            },
        )
        mismatch = await client.post(
            "/weekly-plans",
            json={
                "week_start": "2026-08-03",
                "week_end": "2026-08-09",
                "items": [
                    {
                        "task_id": task["id"],
                        "project_id": other_project["id"],
                        "title": "Wrong Project",
                        "planned_minutes": 30,
                    }
                ],
            },
        )

    assert created.status_code == 201
    linked, ad_hoc = created.json()["items"]
    assert linked["task_id"] == task["id"]
    assert linked["project_id"] == project["id"]
    assert linked["title"] == "Draft findings section"
    assert ad_hoc["task_id"] is None
    assert mismatch.status_code == 409


async def test_time_log_task_link_derives_project_and_keeps_title_snapshot(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client)
        project = (await client.post("/projects", json={"title": "Final report"})).json()
        task = (
            await client.post(
                "/tasks",
                json={"project_id": project["id"], "title": "Draft findings"},
            )
        ).json()
        created = await client.post(
            "/time-logs",
            json={
                "task_id": task["id"],
                "date": "2026-07-22",
                "duration_minutes": 45,
                "activity_name": "Focused writing",
                "activity_type": "consuming",
            },
        )
        await client.patch(
            f"/tasks/{task['id']}",
            json={"expected_version": 1, "title": "Revise findings"},
        )
        logs = await client.get("/time-logs")

    assert created.status_code == 201
    assert created.json()["project_id"] == project["id"]
    assert created.json()["task_id"] == task["id"]
    assert logs.json()[0]["task_title"] == "Draft findings"


async def test_task_survives_database_and_application_restart(database) -> None:
    first_app = create_app(database.path)
    first_transport = httpx.ASGITransport(app=first_app)
    async with httpx.AsyncClient(
        transport=first_transport,
        base_url="http://test",
    ) as client:
        await create_and_select_api_user(
            client,
            "Restart owner",
            email="restart-owner@example.com",
        )
        project = (await client.post("/projects", json={"title": "Final report"})).json()
        created = (
            await client.post(
                "/tasks",
                json={"project_id": project["id"], "title": "Persist across restart"},
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
                "email": "restart-owner@example.com",
                "password": "correct horse battery staple",
            },
        )
        client.headers["Authorization"] = (
            f"Bearer {login.json()['access_token']}"
        )
        tasks = await client.get("/tasks")

    assert login.status_code == 200
    assert [task["id"] for task in tasks.json()] == [created["id"]]
    assert tasks.json()[0]["title"] == "Persist across restart"
