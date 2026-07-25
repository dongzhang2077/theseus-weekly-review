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


async def test_time_log_correction_delete_and_undo_are_versioned_and_invalidate_review(
    database,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        user = await create_and_select_api_user(client)
        goal = (await client.post("/goals", json={"title": "Build MVP"})).json()
        project = (
            await client.post(
                "/projects",
                json={"goal_id": goal["id"], "title": "Backend"},
            )
        ).json()
        await client.post(
            "/weekly-plans",
            json={
                "week_start": "2026-07-20",
                "week_end": "2026-07-26",
                "items": [
                    {
                        "project_id": project["id"],
                        "title": "Backend",
                        "planned_minutes": 120,
                    }
                ],
            },
        )
        created = (
            await client.post(
                "/time-logs",
                json={
                    "project_id": project["id"],
                    "date": "2026-07-25",
                    "duration_minutes": 60,
                    "activity_name": "Backend work",
                    "activity_type": "consuming",
                },
            )
        ).json()
        generated = await client.post(
            "/reviews/weekly/generate",
            json={"week_start": "2026-07-20", "week_end": "2026-07-26"},
        )

        corrected = await client.patch(
            f"/time-logs/{created['id']}",
            headers={"Idempotency-Key": "correct-once"},
            json={
                "expected_version": 1,
                "duration_seconds": 1800,
                "activity_type": "neutral",
                "note": "Timer correction",
                "reason": "Timer ran long",
            },
        )
        replay = await client.patch(
            f"/time-logs/{created['id']}",
            headers={"Idempotency-Key": "correct-once"},
            json={
                "expected_version": 1,
                "duration_seconds": 1800,
                "activity_type": "neutral",
                "note": "Timer correction",
                "reason": "Timer ran long",
            },
        )
        with database.session() as connection:
            stale_review = connection.execute(
                """
                SELECT stale_at FROM weekly_reviews
                WHERE user_id = ? AND week_start = '2026-07-20'
                """,
                (user["id"],),
            ).fetchone()
        deleted = await client.delete(
            f"/time-logs/{created['id']}?expected_version=2",
            headers={"Idempotency-Key": "delete-once"},
        )
        hidden = await client.get(f"/time-logs/{created['id']}")
        visible_deleted = await client.get(
            f"/time-logs/{created['id']}?include_deleted=true"
        )
        undo = await client.post(
            (
                f"/time-logs/{created['id']}/revisions/"
                f"{deleted.json()['revision_id']}/undo"
            ),
            headers={"Idempotency-Key": "undo-delete-once"},
            json={"expected_version": 3},
        )
        listed = await client.get(
            "/time-logs?date_from=2026-07-25&date_to=2026-07-25"
        )
        regenerated = await client.post(
            "/reviews/weekly/generate",
            json={"week_start": "2026-07-20", "week_end": "2026-07-26"},
        )

    assert generated.status_code == 200
    assert corrected.status_code == 200
    assert corrected.json()["time_log"]["duration_seconds"] == 1800
    assert corrected.json()["time_log"]["duration_minutes"] == 30
    assert corrected.json()["time_log"]["type_source"] == "user_corrected"
    assert corrected.json()["time_log"]["version"] == 2
    assert corrected.json()["affected_review_weeks"] == [
        {"week_start": "2026-07-20", "week_end": "2026-07-26"}
    ]
    assert replay.json()["revision_id"] == corrected.json()["revision_id"]
    assert stale_review["stale_at"] is not None
    assert deleted.status_code == 200
    assert deleted.json()["time_log"]["deleted_at"] is not None
    assert hidden.status_code == 404
    assert visible_deleted.status_code == 200
    assert undo.status_code == 200
    assert undo.json()["time_log"]["deleted_at"] is None
    assert undo.json()["time_log"]["version"] == 4
    assert [row["id"] for row in listed.json()] == [created["id"]]
    assert regenerated.status_code == 200
    assert regenerated.json()["evidence"]["actual_total_minutes"] == 30
    with database.session() as connection:
        revisions = connection.execute(
            """
            SELECT action FROM time_log_revisions
            WHERE user_id = ? AND time_log_id = ? ORDER BY id
            """,
            (user["id"], created["id"]),
        ).fetchall()
        review = connection.execute(
            """
            SELECT stale_at FROM weekly_reviews
            WHERE user_id = ? AND week_start = '2026-07-20'
            """,
            (user["id"],),
        ).fetchone()
    assert [row["action"] for row in revisions] == ["update", "delete", "restore"]
    assert review["stale_at"] is None


async def test_time_log_mutations_are_account_isolated(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as owner:
        await create_and_select_api_user(owner, "Owner")
        created = (
            await owner.post(
                "/time-logs",
                json={
                    "date": "2026-07-25",
                    "duration_minutes": 20,
                    "activity_name": "Private work",
                    "activity_type": "neutral",
                },
            )
        ).json()
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as other:
        await create_and_select_api_user(other, "Other")
        read = await other.get(
            f"/time-logs/{created['id']}?include_deleted=true"
        )
        changed = await other.patch(
            f"/time-logs/{created['id']}",
            headers={"Idempotency-Key": "foreign-update"},
            json={"expected_version": 1, "duration_minutes": 10},
        )

    assert read.status_code == 404
    assert changed.status_code == 404
