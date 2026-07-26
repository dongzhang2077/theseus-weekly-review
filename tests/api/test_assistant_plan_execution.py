from __future__ import annotations

from copy import deepcopy

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
DRAFT_REQUEST = {**REVIEW_WEEK, **TARGET_WEEK}
EXECUTION_HEADERS = {"Idempotency-Key": "weekly-plan-execution-1"}


async def _prepare_proposal(client, database, display_name: str):
    user = await create_and_select_api_user(client, display_name)
    with database.session() as connection:
        import_sample_week(connection, user["id"], load_sample_payload())
    generated = await client.post(
        "/reviews/weekly/generate",
        json={
            "week_start": REVIEW_WEEK["review_week_start"],
            "week_end": REVIEW_WEEK["review_week_end"],
        },
    )
    drafted = await client.post(
        "/assistant/proposals/weekly-adjustment",
        json=DRAFT_REQUEST,
        headers={"Idempotency-Key": f"draft-{user['id']}-weekly-plan"},
    )
    assert generated.status_code == 200
    assert drafted.status_code == 201
    return user, drafted.json()


async def _approve(client, proposal, *, decided_after=None):
    response = await client.post(
        f"/proposals/{proposal['id']}/decisions",
        json={
            "expected_version": proposal["version"],
            "decision": "edit" if decided_after is not None else "approve",
            **(
                {"decided_after": decided_after}
                if decided_after is not None
                else {}
            ),
        },
    )
    assert response.status_code == 200
    return response.json()


async def test_execute_weekly_plan_requires_authentication_and_is_typed(
    database,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        unauthorized = await client.post(
            "/assistant/proposals/1/execute-weekly-plan",
            json={"expected_version": 2},
            headers=EXECUTION_HEADERS,
        )
        schema = (await client.get("/openapi.json")).json()

    assert unauthorized.status_code == 401
    operation = schema[
        "paths"
    ]["/assistant/proposals/{proposal_id}/execute-weekly-plan"]["post"]
    assert operation["security"] == [{"HTTPBearer": []}]
    assert operation["requestBody"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/AssistantProposalExecutionRequest"
    }
    assert operation["responses"]["200"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/AssistantWeeklyPlanExecutionRead"
    }


async def test_execute_weekly_plan_requires_approval_and_applies_exactly_once(
    database,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        user, proposal = await _prepare_proposal(
            client,
            database,
            "Execution owner",
        )
        plans_before = (await client.get("/weekly-plans")).json()
        pending_attempt = await client.post(
            f"/assistant/proposals/{proposal['id']}/execute-weekly-plan",
            json={"expected_version": proposal["version"]},
            headers=EXECUTION_HEADERS,
        )
        detail_after_pending = await client.get(f"/proposals/{proposal['id']}")

        approved = await _approve(client, proposal)
        first = await client.post(
            f"/assistant/proposals/{proposal['id']}/execute-weekly-plan",
            json={"expected_version": approved["proposal"]["version"]},
            headers=EXECUTION_HEADERS,
        )
        replay = await client.post(
            f"/assistant/proposals/{proposal['id']}/execute-weekly-plan",
            json={"expected_version": approved["proposal"]["version"]},
            headers=EXECUTION_HEADERS,
        )
        key_conflict = await client.post(
            f"/assistant/proposals/{proposal['id']}/execute-weekly-plan",
            json={"expected_version": 99},
            headers=EXECUTION_HEADERS,
        )
        plans_after = (await client.get("/weekly-plans")).json()
        detail = (await client.get(f"/proposals/{proposal['id']}")).json()

    assert pending_attempt.status_code == 409
    assert pending_attempt.json()["detail"]["code"] == "proposal_not_approved"
    assert detail_after_pending.json()["actions"] == []
    assert first.status_code == 200
    assert replay.status_code == 200
    result = first.json()
    assert replay.json() == result
    assert result["proposal"]["user_id"] == user["id"]
    assert result["proposal"]["status"] == "executed"
    assert result["proposal"]["version"] == 3
    assert result["action"]["status"] == "succeeded"
    assert result["action"]["operation"] == "weekly_plan.create"
    assert result["action"]["reversible"] is True
    assert result["action"]["verification"] == {
        "status": "verified",
        "operation": "weekly_plan.create",
        "weekly_plan_id": result["weekly_plan"]["id"],
        "matches_after": True,
    }
    resume_item = next(
        item
        for item in result["weekly_plan"]["items"]
        if item["title"] == "Update resume and apply to two roles"
    )
    assert resume_item["planned_minutes"] == 30
    assert len(plans_before) == 1
    assert len(plans_after) == 2
    assert len(detail["actions"]) == 1
    assert detail["actions"][0]["id"] == result["action"]["id"]
    assert key_conflict.status_code == 409
    assert key_conflict.json()["detail"]["code"] == "idempotency_conflict"


async def test_execute_weekly_plan_uses_edited_approved_after_state(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        _, proposal = await _prepare_proposal(
            client,
            database,
            "Edited execution owner",
        )
        edited_after = deepcopy(proposal["after"])
        resume_item = next(
            item
            for item in edited_after["weekly_plan"]["items"]
            if item["title"] == "Update resume and apply to two roles"
        )
        resume_item["planned_minutes"] = 45
        approved = await _approve(
            client,
            proposal,
            decided_after=edited_after,
        )
        response = await client.post(
            f"/assistant/proposals/{proposal['id']}/execute-weekly-plan",
            json={"expected_version": approved["proposal"]["version"]},
            headers=EXECUTION_HEADERS,
        )

    assert response.status_code == 200
    persisted_item = next(
        item
        for item in response.json()["weekly_plan"]["items"]
        if item["title"] == "Update resume and apply to two roles"
    )
    assert persisted_item["planned_minutes"] == 45
    assert response.json()["action"]["request"]["after"] == edited_after


async def test_execute_weekly_plan_replaces_matching_target_plan(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        user = await create_and_select_api_user(client, "Replace execution owner")
        with database.session() as connection:
            import_sample_week(connection, user["id"], load_sample_payload())
        reviewed_plan = (await client.get("/weekly-plans")).json()[0]
        target = await client.post(
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
                        "planned_minutes": item["planned_minutes"],
                        "priority": item["priority"],
                        "is_completed": item["is_completed"],
                    }
                    for item in reviewed_plan["items"]
                ],
                "note": reviewed_plan["note"],
            },
        )
        await client.post(
            "/reviews/weekly/generate",
            json={
                "week_start": REVIEW_WEEK["review_week_start"],
                "week_end": REVIEW_WEEK["review_week_end"],
            },
        )
        drafted = await client.post(
            "/assistant/proposals/weekly-adjustment",
            json=DRAFT_REQUEST,
            headers={"Idempotency-Key": "replace-target-draft"},
        )
        approved = await _approve(client, drafted.json())
        executed = await client.post(
            f"/assistant/proposals/{drafted.json()['id']}/execute-weekly-plan",
            json={"expected_version": approved["proposal"]["version"]},
            headers={"Idempotency-Key": "replace-target-execution"},
        )
        plans = (await client.get("/weekly-plans")).json()

    assert target.status_code == 201
    assert executed.status_code == 200
    assert executed.json()["action"]["operation"] == "weekly_plan.replace"
    assert executed.json()["weekly_plan"]["id"] == target.json()["id"]
    assert len(plans) == 2


async def test_execute_weekly_plan_detects_target_drift_without_partial_action(
    database,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        _, proposal = await _prepare_proposal(
            client,
            database,
            "Drift execution owner",
        )
        approved = await _approve(client, proposal)
        target_created = await client.post(
            "/weekly-plans",
            json=proposal["after"]["weekly_plan"],
        )
        response = await client.post(
            f"/assistant/proposals/{proposal['id']}/execute-weekly-plan",
            json={"expected_version": approved["proposal"]["version"]},
            headers=EXECUTION_HEADERS,
        )
        detail = (await client.get(f"/proposals/{proposal['id']}")).json()
        plans = (await client.get("/weekly-plans")).json()

    assert target_created.status_code == 201
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "weekly_plan_state_conflict"
    assert response.json()["detail"]["current"]["id"] == target_created.json()["id"]
    assert detail["proposal"]["status"] == "approved"
    assert detail["actions"] == []
    assert len(plans) == 2


async def test_execute_weekly_plan_is_account_isolated(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        _, proposal = await _prepare_proposal(
            client,
            database,
            "First execution owner",
        )
        approved = await _approve(client, proposal)
        await create_and_select_api_user(client, "Other execution owner")
        response = await client.post(
            f"/assistant/proposals/{proposal['id']}/execute-weekly-plan",
            json={"expected_version": approved["proposal"]["version"]},
            headers=EXECUTION_HEADERS,
        )
        other_plans = await client.get("/weekly-plans")

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "proposal_not_found"
    assert other_plans.json() == []


async def test_execute_weekly_plan_rolls_back_action_when_plan_is_invalid(
    database,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client, "Invalid execution owner")
        created = await client.post(
            "/proposals",
            json={
                "proposal_type": "weekly_plan_adjustment",
                "title": "Invalid project adjustment",
                "before": {"weekly_plan": None},
                "after": {
                    "weekly_plan": {
                        "week_start": "2026-06-15",
                        "week_end": "2026-06-21",
                        "planned_capacity_minutes": 300,
                        "slack_target_percent": 20,
                        "items": [
                            {
                                "project_id": 999999,
                                "title": "Unavailable project",
                                "planned_minutes": 30,
                                "priority": 1,
                            }
                        ],
                        "note": "",
                    }
                },
            },
        )
        approved = await _approve(client, created.json())
        executed = await client.post(
            f"/assistant/proposals/{created.json()['id']}/execute-weekly-plan",
            json={"expected_version": approved["proposal"]["version"]},
            headers=EXECUTION_HEADERS,
        )
        detail = (await client.get(f"/proposals/{created.json()['id']}")).json()
        plans = await client.get("/weekly-plans")

    assert created.status_code == 201
    assert executed.status_code == 409
    assert executed.json()["detail"]["code"] == "weekly_plan_persistence_conflict"
    assert detail["proposal"]["status"] == "approved"
    assert detail["actions"] == []
    assert plans.json() == []
