from __future__ import annotations

import sqlite3

import httpx
import pytest

from backend.app.main import create_app
from backend.app.services import WeeklyPlanService, import_sample_week
from tests.api.test_assistant_plan_execution import (
    DRAFT_REQUEST,
    REVIEW_WEEK,
    TARGET_WEEK,
    _approve,
    _prepare_proposal,
)
from tests.support import create_and_select_api_user, load_sample_payload


pytestmark = pytest.mark.anyio


async def _execute(client, proposal, *, key: str):
    approved = await _approve(client, proposal)
    response = await client.post(
        f"/assistant/proposals/{proposal['id']}/execute-weekly-plan",
        json={"expected_version": approved["proposal"]["version"]},
        headers={"Idempotency-Key": key},
    )
    assert response.status_code == 200
    return response.json()


def _plan_command(plan):
    return {
        "week_start": plan["week_start"],
        "week_end": plan["week_end"],
        "planned_capacity_minutes": plan["planned_capacity_minutes"],
        "slack_target_percent": plan["slack_target_percent"],
        "items": [
            {
                "project_id": item["project_id"],
                "task_id": item["task_id"],
                "title": item["title"],
                "planned_minutes": item["planned_minutes"],
                "priority": item["priority"],
                "is_completed": item["is_completed"],
            }
            for item in plan["items"]
        ],
        "note": plan["note"],
    }


async def test_undo_created_weekly_plan_exactly_once_and_is_typed(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        unauthorized = await client.post(
            "/assistant/proposals/1/actions/1/undo-weekly-plan",
            json={"expected_version": 3},
            headers={"Idempotency-Key": "unauthorized-undo"},
        )
        _, proposal = await _prepare_proposal(client, database, "Create undo owner")
        executed = await _execute(client, proposal, key="create-plan-action")
        path = (
            f"/assistant/proposals/{proposal['id']}/actions/"
            f"{executed['action']['id']}/undo-weekly-plan"
        )
        stale = await client.post(
            path,
            json={"expected_version": executed["proposal"]["version"] - 1},
            headers={"Idempotency-Key": "stale-undo-version"},
        )
        first = await client.post(
            path,
            json={"expected_version": executed["proposal"]["version"]},
            headers={"Idempotency-Key": "undo-created-plan"},
        )
        replay = await client.post(
            path,
            json={"expected_version": executed["proposal"]["version"]},
            headers={"Idempotency-Key": "undo-created-plan"},
        )
        key_conflict = await client.post(
            path,
            json={"expected_version": 99},
            headers={"Idempotency-Key": "undo-created-plan"},
        )
        plans = (await client.get("/weekly-plans")).json()
        detail = (await client.get(f"/proposals/{proposal['id']}")).json()
        schema = (await client.get("/openapi.json")).json()

    assert unauthorized.status_code == 401
    assert stale.status_code == 409
    assert stale.json()["detail"]["code"] == "version_conflict"
    assert first.status_code == 200
    assert replay.json() == first.json()
    result = first.json()
    assert result["proposal"]["status"] == "undone"
    assert result["proposal"]["version"] == 4
    assert result["weekly_plan"] is None
    assert result["undone_action"]["id"] == executed["action"]["id"]
    assert result["undone_action"]["status"] == "undone"
    assert result["action"]["operation"] == "weekly_plan.undo_create"
    assert result["action"]["status"] == "succeeded"
    assert result["action"]["undo_of_action_id"] == executed["action"]["id"]
    assert result["action"]["verification"]["matches_before"] is True
    assert len(plans) == 1
    assert [action["status"] for action in detail["actions"]] == [
        "undone",
        "succeeded",
    ]
    assert key_conflict.status_code == 409
    assert key_conflict.json()["detail"]["code"] == "idempotency_conflict"
    operation = schema["paths"][
        "/assistant/proposals/{proposal_id}/actions/{action_id}/undo-weekly-plan"
    ]["post"]
    assert operation["security"] == [{"HTTPBearer": []}]
    assert operation["requestBody"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/AssistantWeeklyPlanUndoRequest"
    }
    assert operation["responses"]["200"]["content"]["application/json"][
        "schema"
    ] == {"$ref": "#/components/schemas/AssistantWeeklyPlanUndoRead"}


async def test_undo_replaced_weekly_plan_restores_recorded_before_state(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        user = await create_and_select_api_user(client, "Replace undo owner")
        with database.session() as connection:
            import_sample_week(connection, user["id"], load_sample_payload())
        reviewed = (await client.get("/weekly-plans")).json()[0]
        target = await client.post(
            "/weekly-plans",
            json={
                **_plan_command(reviewed),
                "week_start": TARGET_WEEK["target_week_start"],
                "week_end": TARGET_WEEK["target_week_end"],
            },
        )
        assert target.status_code == 201
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
            headers={"Idempotency-Key": "replace-undo-draft"},
        )
        executed = await _execute(
            client,
            drafted.json(),
            key="replace-plan-action",
        )
        undone = await client.post(
            f"/assistant/proposals/{drafted.json()['id']}/actions/"
            f"{executed['action']['id']}/undo-weekly-plan",
            json={"expected_version": executed["proposal"]["version"]},
            headers={"Idempotency-Key": "undo-replaced-plan"},
        )

    assert undone.status_code == 200
    restored = undone.json()["weekly_plan"]
    assert undone.json()["action"]["operation"] == "weekly_plan.undo_replace"
    assert restored["id"] == target.json()["id"]
    assert _plan_command(restored) == _plan_command(target.json())


async def test_undo_rejects_plan_drift_without_partial_audit(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        _, proposal = await _prepare_proposal(client, database, "Undo drift owner")
        executed = await _execute(client, proposal, key="drift-plan-action")
        changed = _plan_command(executed["weekly_plan"])
        changed["note"] = "Changed after assistant execution"
        replaced = await client.put(
            f"/weekly-plans/{executed['weekly_plan']['id']}",
            json=changed,
        )
        response = await client.post(
            f"/assistant/proposals/{proposal['id']}/actions/"
            f"{executed['action']['id']}/undo-weekly-plan",
            json={"expected_version": executed["proposal"]["version"]},
            headers={"Idempotency-Key": "undo-drifted-plan"},
        )
        detail = (await client.get(f"/proposals/{proposal['id']}")).json()

    assert replaced.status_code == 200
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "weekly_plan_state_conflict"
    assert detail["proposal"]["status"] == "executed"
    assert len(detail["actions"]) == 1
    assert detail["actions"][0]["status"] == "succeeded"


async def test_undo_rolls_back_plan_and_pending_action_on_restore_failure(
    database,
    monkeypatch,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        _, proposal = await _prepare_proposal(client, database, "Undo rollback owner")
        executed = await _execute(client, proposal, key="rollback-plan-action")

        def fail_delete(_service, _plan_id):
            raise sqlite3.IntegrityError("forced undo failure")

        monkeypatch.setattr(WeeklyPlanService, "delete", fail_delete)
        response = await client.post(
            f"/assistant/proposals/{proposal['id']}/actions/"
            f"{executed['action']['id']}/undo-weekly-plan",
            json={"expected_version": executed["proposal"]["version"]},
            headers={"Idempotency-Key": "failed-plan-undo"},
        )
        detail = (await client.get(f"/proposals/{proposal['id']}")).json()
        plans = (await client.get("/weekly-plans")).json()

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "weekly_plan_persistence_conflict"
    assert detail["proposal"]["status"] == "executed"
    assert len(detail["actions"]) == 1
    assert detail["actions"][0]["status"] == "succeeded"
    assert any(plan["id"] == executed["weekly_plan"]["id"] for plan in plans)


async def test_undo_is_account_and_action_link_isolated(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        _, proposal = await _prepare_proposal(client, database, "Undo first owner")
        executed = await _execute(client, proposal, key="isolated-plan-action")
        await create_and_select_api_user(client, "Undo second owner")
        response = await client.post(
            f"/assistant/proposals/{proposal['id']}/actions/"
            f"{executed['action']['id']}/undo-weekly-plan",
            json={"expected_version": executed["proposal"]["version"]},
            headers={"Idempotency-Key": "cross-account-undo"},
        )

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "proposal_not_found"
