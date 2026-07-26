from __future__ import annotations

import httpx
import pytest

from backend.app.main import create_app
from backend.app.services import import_sample_week
from tests.support import create_and_select_api_user, load_sample_payload


pytestmark = pytest.mark.anyio

REVIEW_WEEK = {
    "review_week_start": "2026-06-08",
    "review_week_end": "2026-06-14",
}
TARGET_WEEK = {
    "target_week_start": "2026-06-15",
    "target_week_end": "2026-06-21",
}
REQUEST = {**REVIEW_WEEK, **TARGET_WEEK}
IDEMPOTENCY_HEADERS = {"Idempotency-Key": "weekly-adjustment-1"}


async def test_weekly_adjustment_requires_authentication_and_has_typed_openapi(
    database,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        unauthorized = await client.post(
            "/assistant/proposals/weekly-adjustment",
            json=REQUEST,
            headers=IDEMPOTENCY_HEADERS,
        )
        schema = (await client.get("/openapi.json")).json()

    assert unauthorized.status_code == 401
    operation = schema["paths"]["/assistant/proposals/weekly-adjustment"]["post"]
    assert operation["security"] == [{"HTTPBearer": []}]
    assert operation["requestBody"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/AssistantWeeklyPlanProposalRequest"
    }
    assert operation["responses"]["201"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/ProposalRead"
    }


async def test_weekly_adjustment_creates_one_pending_diff_without_writing_plan(
    database,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        user = await create_and_select_api_user(client, "Proposal owner")
        with database.session() as connection:
            import_sample_week(connection, user["id"], load_sample_payload())
        generated = await client.post(
            "/reviews/weekly/generate",
            json={
                "week_start": REVIEW_WEEK["review_week_start"],
                "week_end": REVIEW_WEEK["review_week_end"],
            },
        )
        plans_before = (await client.get("/weekly-plans")).json()

        first = await client.post(
            "/assistant/proposals/weekly-adjustment",
            json=REQUEST,
            headers=IDEMPOTENCY_HEADERS,
        )
        replay = await client.post(
            "/assistant/proposals/weekly-adjustment",
            json=REQUEST,
            headers=IDEMPOTENCY_HEADERS,
        )
        semantic_replay = await client.post(
            "/assistant/proposals/weekly-adjustment",
            json=REQUEST,
            headers={"Idempotency-Key": "weekly-adjustment-2"},
        )
        plans_after = (await client.get("/weekly-plans")).json()
        pending = (await client.get("/proposals", params={"status": "pending"})).json()

    assert generated.status_code == 200
    assert first.status_code == 201
    assert replay.status_code == 201
    assert semantic_replay.status_code == 201
    proposal = first.json()
    assert replay.json()["id"] == proposal["id"]
    assert semantic_replay.json()["id"] == proposal["id"]
    assert proposal["user_id"] == user["id"]
    assert proposal["proposal_type"] == "weekly_plan_adjustment"
    assert proposal["source"] == "deterministic"
    assert proposal["status"] == "pending"
    assert proposal["before"] == {"weekly_plan": None}
    after = proposal["after"]["weekly_plan"]
    assert after["week_start"] == TARGET_WEEK["target_week_start"]
    assert after["week_end"] == TARGET_WEEK["target_week_end"]
    resume_item = next(
        item
        for item in after["items"]
        if item["title"] == "Update resume and apply to two roles"
    )
    assert resume_item["planned_minutes"] == 30
    assert proposal["evidence"][1]["review_id"] == generated.json()["id"]
    assert proposal["evidence"][2] == {
        "kind": "project_drift",
        "project_id": resume_item["project_id"],
        "project_title": "Resume and applications",
        "planned_minutes": 120,
        "actual_minutes": 0,
        "suggested_minutes": 30,
        "source": "weekly_review.evidence.plan.project_drift",
    }
    assert plans_after == plans_before
    assert [item["id"] for item in pending] == [proposal["id"]]


async def test_weekly_adjustment_rejects_idempotency_key_reuse(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        user = await create_and_select_api_user(client, "Idempotency owner")
        with database.session() as connection:
            import_sample_week(connection, user["id"], load_sample_payload())
        await client.post(
            "/reviews/weekly/generate",
            json={
                "week_start": REVIEW_WEEK["review_week_start"],
                "week_end": REVIEW_WEEK["review_week_end"],
            },
        )
        first = await client.post(
            "/assistant/proposals/weekly-adjustment",
            json=REQUEST,
            headers=IDEMPOTENCY_HEADERS,
        )
        conflict = await client.post(
            "/assistant/proposals/weekly-adjustment",
            json={**REQUEST, "target_week_end": "2026-06-22"},
            headers=IDEMPOTENCY_HEADERS,
        )
        pending = (await client.get("/proposals", params={"status": "pending"})).json()

    assert first.status_code == 201
    assert conflict.status_code == 409
    assert conflict.json()["detail"]["code"] == "idempotency_conflict"
    assert [item["id"] for item in pending] == [first.json()["id"]]


async def test_weekly_adjustment_failure_leaves_no_partial_receipt(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        user = await create_and_select_api_user(client, "Retry proposal owner")
        missing = await client.post(
            "/assistant/proposals/weekly-adjustment",
            json=REQUEST,
            headers=IDEMPOTENCY_HEADERS,
        )
        with database.session() as connection:
            import_sample_week(connection, user["id"], load_sample_payload())
        await client.post(
            "/reviews/weekly/generate",
            json={
                "week_start": REVIEW_WEEK["review_week_start"],
                "week_end": REVIEW_WEEK["review_week_end"],
            },
        )
        retry = await client.post(
            "/assistant/proposals/weekly-adjustment",
            json=REQUEST,
            headers=IDEMPOTENCY_HEADERS,
        )

    assert missing.status_code == 404
    assert retry.status_code == 201


async def test_weekly_adjustment_does_not_force_change_when_target_is_already_smaller(
    database,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        user = await create_and_select_api_user(client, "No adjustment owner")
        with database.session() as connection:
            import_sample_week(connection, user["id"], load_sample_payload())
        await client.post(
            "/reviews/weekly/generate",
            json={
                "week_start": REVIEW_WEEK["review_week_start"],
                "week_end": REVIEW_WEEK["review_week_end"],
            },
        )
        reviewed_plan = (await client.get("/weekly-plans")).json()[0]
        target_minutes = {
            "Design backend schema and API": 240,
            "Draft review page layout": 60,
            "Update resume and apply to two roles": 30,
        }
        target_plan = await client.post(
            "/weekly-plans",
            json={
                "week_start": TARGET_WEEK["target_week_start"],
                "week_end": TARGET_WEEK["target_week_end"],
                "planned_capacity_minutes": reviewed_plan["planned_capacity_minutes"],
                "slack_target_percent": reviewed_plan["slack_target_percent"],
                "items": [
                    {
                        "project_id": item["project_id"],
                        "task_id": item["task_id"],
                        "title": item["title"],
                        "planned_minutes": target_minutes[item["title"]],
                        "priority": item["priority"],
                        "is_completed": False,
                    }
                    for item in reviewed_plan["items"]
                ],
                "note": reviewed_plan["note"],
            },
        )
        response = await client.post(
            "/assistant/proposals/weekly-adjustment",
            json=REQUEST,
            headers=IDEMPOTENCY_HEADERS,
        )
        proposals = await client.get("/proposals")

    assert target_plan.status_code == 201
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "weekly_adjustment_unavailable"
    assert proposals.json() == []


async def test_weekly_adjustment_does_not_use_another_accounts_review(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        owner = await create_and_select_api_user(client, "Review owner")
        with database.session() as connection:
            import_sample_week(connection, owner["id"], load_sample_payload())
        generated = await client.post(
            "/reviews/weekly/generate",
            json={
                "week_start": REVIEW_WEEK["review_week_start"],
                "week_end": REVIEW_WEEK["review_week_end"],
            },
        )

        await create_and_select_api_user(client, "Other proposal owner")
        response = await client.post(
            "/assistant/proposals/weekly-adjustment",
            json=REQUEST,
            headers=IDEMPOTENCY_HEADERS,
        )
        proposals = await client.get("/proposals")

    assert generated.status_code == 200
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "weekly_review_not_found"
    assert proposals.json() == []


async def test_weekly_adjustment_rejects_stale_review(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        user = await create_and_select_api_user(client, "Stale review owner")
        with database.session() as connection:
            import_sample_week(connection, user["id"], load_sample_payload())
        generated = await client.post(
            "/reviews/weekly/generate",
            json={
                "week_start": REVIEW_WEEK["review_week_start"],
                "week_end": REVIEW_WEEK["review_week_end"],
            },
        )
        with database.session() as connection:
            connection.execute(
                "UPDATE weekly_reviews SET stale_at = CURRENT_TIMESTAMP "
                "WHERE id = ? AND user_id = ?",
                (generated.json()["id"], user["id"]),
            )

        response = await client.post(
            "/assistant/proposals/weekly-adjustment",
            json=REQUEST,
            headers=IDEMPOTENCY_HEADERS,
        )
        proposals = await client.get("/proposals")

    assert generated.status_code == 200
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "weekly_review_stale"
    assert proposals.json() == []


@pytest.mark.parametrize(
    "payload",
    (
        {**REQUEST, "review_week_end": "2026-06-01"},
        {**REQUEST, "target_week_end": "2026-08-01"},
    ),
)
async def test_weekly_adjustment_rejects_invalid_windows(database, payload) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client, "Invalid window owner")
        response = await client.post(
            "/assistant/proposals/weekly-adjustment",
            json=payload,
            headers=IDEMPOTENCY_HEADERS,
        )

    assert response.status_code == 422
