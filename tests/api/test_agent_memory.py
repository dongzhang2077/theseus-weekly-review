from __future__ import annotations

from datetime import datetime, timedelta, timezone

import httpx
import pytest

from backend.app.db.repositories import PreferenceRepository, ProposalRepository
from backend.app.main import create_app
from backend.app.schemas import (
    AgentActionCreate,
    PreferenceCreate,
)
from tests.support import create_and_select_api_user


pytestmark = pytest.mark.anyio


async def test_agent_memory_openapi_exposes_bounded_authenticated_contract(
    database,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        schema = (await client.get("/openapi.json")).json()

    assert {"get", "post"} <= set(schema["paths"]["/preferences"])
    assert {"get", "patch", "delete"} <= set(
        schema["paths"]["/preferences/{preference_id}"]
    )
    assert "post" in schema["paths"]["/preferences/{preference_id}/restore"]
    assert {"get", "post"} <= set(schema["paths"]["/proposals"])
    assert "get" in schema["paths"]["/proposals/{proposal_id}"]
    assert "post" in schema["paths"]["/proposals/{proposal_id}/decisions"]
    assert "post" in schema["paths"]["/proposals/{proposal_id}/outcomes"]
    public_preference = schema["components"]["schemas"]["PreferenceUserCreate"][
        "properties"
    ]
    public_proposal = schema["components"]["schemas"]["ProposalDraftCreate"][
        "properties"
    ]
    assert "source" not in public_preference
    assert "confidence" not in public_preference
    assert "provenance" not in public_preference
    assert "source" not in public_proposal
    assert "/agent-actions" not in schema["paths"]


async def test_agent_memory_api_requires_authentication(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        preference = await client.get("/preferences")
        proposal = await client.get("/proposals")

    assert preference.status_code == 401
    assert proposal.status_code == 401


async def test_preference_api_corrects_deletes_restores_and_exposes_audit(
    database,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client, "Preference API owner")
        created_response = await client.post(
            "/preferences",
            json={
                "preference_key": "focus.default_minutes",
                "value": 25,
            },
        )
        created = created_response.json()
        corrected_response = await client.patch(
            f"/preferences/{created['id']}",
            json={
                "expected_version": created["version"],
                "value": 45,
                "reason": "Longer blocks fit this project",
            },
        )
        corrected = corrected_response.json()["preference"]
        stale = await client.patch(
            f"/preferences/{created['id']}",
            json={"expected_version": 1, "value": 60},
        )
        deleted_response = await client.delete(
            f"/preferences/{created['id']}",
            params={
                "expected_version": corrected["version"],
                "reason": "Temporary removal",
            },
        )
        deleted = deleted_response.json()["preference"]
        active = await client.get("/preferences")
        all_records = await client.get("/preferences?include_deleted=true")
        detail = await client.get(
            f"/preferences/{created['id']}?include_deleted=true"
        )
        restored_response = await client.post(
            f"/preferences/{created['id']}/restore",
            json={
                "expected_version": deleted["version"],
                "reason": "Still useful",
            },
        )

    assert created_response.status_code == 201
    assert created["source"] == "user_stated"
    assert corrected_response.status_code == 200
    assert corrected["value"] == 45
    assert corrected["version"] == 2
    assert stale.status_code == 409
    assert stale.json()["detail"]["current"]["version"] == 2
    assert deleted_response.status_code == 200
    assert deleted["deleted_at"] is not None
    assert active.json() == []
    assert len(all_records.json()) == 1
    assert [item["action"] for item in detail.json()["revisions"]] == [
        "update",
        "delete",
    ]
    assert restored_response.status_code == 200
    assert restored_response.json()["preference"]["deleted_at"] is None
    assert restored_response.json()["preference"]["version"] == 4


async def test_preference_api_corrects_inference_into_user_statement(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        user = await create_and_select_api_user(client, "Inference owner")
        with database.session() as connection:
            inferred = PreferenceRepository(connection, user["id"]).create(
                PreferenceCreate(
                    source="inferred",
                    preference_key="focus.preferred_period",
                    value="morning",
                    provenance={"time_log_ids": [1, 2]},
                    confidence=0.7,
                    review_after=datetime.now(timezone.utc) + timedelta(days=14),
                )
            )
        corrected = await client.patch(
            f"/preferences/{inferred.id}",
            json={
                "expected_version": inferred.version,
                "value": "afternoon",
                "reason": "Morning is not representative",
            },
        )

    assert corrected.status_code == 200
    preference = corrected.json()["preference"]
    assert preference["source"] == "user_stated"
    assert preference["confidence"] is None
    assert preference["value"] == "afternoon"
    assert preference["provenance"]["corrected_from"] == "inferred"


async def test_preference_api_rejects_claimed_inference_and_cross_account_access(
    database,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client, "First memory owner")
        created = (
            await client.post(
                "/preferences",
                json={
                    "preference_key": "focus.default_minutes",
                    "value": 25,
                },
            )
        ).json()
        claimed = await client.post(
            "/preferences",
            json={
                "preference_key": "focus.fabricated",
                "value": True,
                "source": "inferred",
                "confidence": 0.99,
            },
        )

        await create_and_select_api_user(client, "Second memory owner")
        foreign_get = await client.get(f"/preferences/{created['id']}")
        foreign_patch = await client.patch(
            f"/preferences/{created['id']}",
            json={"expected_version": 1, "value": 60},
        )
        foreign_delete = await client.delete(
            f"/preferences/{created['id']}",
            params={"expected_version": 1},
        )

    assert claimed.status_code == 422
    assert foreign_get.status_code == 404
    assert foreign_patch.status_code == 404
    assert foreign_delete.status_code == 404


async def test_proposal_api_records_decision_action_history_and_outcome(
    database,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        user = await create_and_select_api_user(client, "Proposal API owner")
        created_response = await client.post(
            "/proposals",
            json={
                "proposal_type": "weekly_plan_adjustment",
                "title": "Protect a restart block",
                "rationale": "The project has no time this week.",
                "evidence": [{"type": "dormancy_risk", "project_id": 4}],
                "before": {"planned_minutes": 0},
                "after": {"planned_minutes": 30},
            },
        )
        created = created_response.json()
        decision_response = await client.post(
            f"/proposals/{created['id']}/decisions",
            json={
                "expected_version": created["version"],
                "decision": "edit",
                "decided_after": {"planned_minutes": 20},
                "reason": "Keep it small",
            },
        )
        with database.session() as connection:
            repository = ProposalRepository(connection, user["id"])
            action = repository.create_action(
                AgentActionCreate(
                    proposal_id=created["id"],
                    decision_id=decision_response.json()["decisions"][0]["id"],
                    operation="weekly_plan.adjust",
                    request={"planned_minutes": 20},
                    idempotency_key="api-ledger-action",
                    reversible=True,
                )
            )
            repository.finish_action(
                action.id,
                status="succeeded",
                result={"weekly_plan_id": 9},
                verification={"planned_minutes": 20},
            )
        outcome_response = await client.post(
            f"/proposals/{created['id']}/outcomes",
            json={
                "action_id": action.id,
                "result": "completed",
                "usefulness": 5,
                "actual_duration_minutes": 18,
                "energy_feedback": "neutral",
                "note": "Realistic",
            },
        )
        detail = await client.get(f"/proposals/{created['id']}")
        pending = await client.get("/proposals?status=pending")
        approved = await client.get("/proposals?status=approved")

    assert created_response.status_code == 201
    assert created["source"] == "deterministic"
    assert decision_response.status_code == 200
    assert decision_response.json()["proposal"]["status"] == "approved"
    assert outcome_response.status_code == 201
    assert detail.json()["actions"][0]["status"] == "succeeded"
    assert detail.json()["actions"][0]["verification"] == {"planned_minutes": 20}
    assert detail.json()["outcomes"][0]["usefulness"] == 5
    assert detail.json()["outcomes"][0]["personalization_consent"] is False
    assert detail.json()["outcomes"][0]["consent_version"] == 1
    assert pending.json() == []
    assert [item["id"] for item in approved.json()] == [created["id"]]


async def test_personalization_baseline_uses_only_versioned_consent(
    database,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client, "Personalization owner")

        async def add_outcome(
            *,
            result: str,
            usefulness: int,
            consent: bool,
        ) -> tuple[int, dict]:
            proposal = (
                await client.post(
                    "/proposals",
                    json={
                        "proposal_type": "weekly_plan_adjustment",
                        "title": f"Outcome {result} {usefulness}",
                        "before": {},
                        "after": {},
                    },
                )
            ).json()
            response = await client.post(
                f"/proposals/{proposal['id']}/outcomes",
                json={
                    "result": result,
                    "usefulness": usefulness,
                    "personalization_consent": consent,
                },
            )
            assert response.status_code == 201
            return proposal["id"], response.json()

        proposal_id, first = await add_outcome(
            result="completed",
            usefulness=5,
            consent=False,
        )
        empty = await client.get("/personalization/baseline")
        granted = await client.patch(
            f"/proposals/{proposal_id}/outcomes/{first['id']}/consent",
            json={
                "expected_version": first["consent_version"],
                "personalization_consent": True,
            },
        )
        stale = await client.patch(
            f"/proposals/{proposal_id}/outcomes/{first['id']}/consent",
            json={
                "expected_version": first["consent_version"],
                "personalization_consent": False,
            },
        )
        for result, usefulness in (
            ("completed", 4),
            ("partial", 3),
            ("not_completed", 2),
            ("dismissed", 1),
        ):
            await add_outcome(
                result=result,
                usefulness=usefulness,
                consent=True,
            )
        ready = await client.get("/personalization/baseline")
        withdrawn = await client.patch(
            f"/proposals/{proposal_id}/outcomes/{first['id']}/consent",
            json={
                "expected_version": granted.json()["consent_version"],
                "personalization_consent": False,
            },
        )
        after_withdrawal = await client.get("/personalization/baseline")
        schema = (await client.get("/openapi.json")).json()

        await create_and_select_api_user(client, "Other personalization owner")
        isolated = await client.get("/personalization/baseline")
        foreign = await client.patch(
            f"/proposals/{proposal_id}/outcomes/{first['id']}/consent",
            json={
                "expected_version": 2,
                "personalization_consent": False,
            },
        )

    assert empty.status_code == 200
    assert empty.json()["status"] == "insufficient_data"
    assert empty.json()["consented_outcome_count"] == 0
    assert empty.json()["groups"] == []
    assert granted.status_code == 200
    assert granted.json()["personalization_consent"] is True
    assert granted.json()["consent_version"] == 2
    assert granted.json()["consent_updated_at"] is not None
    assert stale.status_code == 409
    assert stale.json()["detail"]["current"]["consent_version"] == 2
    assert ready.status_code == 200
    assert ready.json()["status"] == "ready"
    assert ready.json()["consented_outcome_count"] == 5
    assert ready.json()["remaining_outcome_count"] == 0
    assert ready.json()["ranking_applied"] is False
    assert ready.json()["groups"] == [
        {
            "proposal_type": "weekly_plan_adjustment",
            "outcome_count": 5,
            "rated_outcome_count": 5,
            "average_usefulness": 3.0,
            "completed_count": 2,
            "partial_count": 1,
            "not_completed_count": 1,
            "dismissed_count": 1,
            "completion_rate": 0.625,
        }
    ]
    assert withdrawn.status_code == 200
    assert withdrawn.json()["personalization_consent"] is False
    assert withdrawn.json()["consent_version"] == 3
    assert after_withdrawal.status_code == 200
    assert after_withdrawal.json()["status"] == "insufficient_data"
    assert after_withdrawal.json()["consented_outcome_count"] == 4
    assert after_withdrawal.json()["remaining_outcome_count"] == 1
    assert isolated.status_code == 200
    assert isolated.json()["consented_outcome_count"] == 0
    assert foreign.status_code == 404
    assert (
        schema["paths"]["/personalization/baseline"]["get"]["responses"]["200"][
            "content"
        ]["application/json"]["schema"]
        == {"$ref": "#/components/schemas/PersonalizationBaselineRead"}
    )


async def test_proposal_api_rejects_expired_stale_and_cross_account_decisions(
    database,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client, "First proposal owner")
        expired = (
            await client.post(
                "/proposals",
                json={
                    "proposal_type": "generic",
                    "title": "Expired proposal",
                    "evidence": [],
                    "before": {},
                    "after": {"change": True},
                    "expires_at": "2020-01-01T00:00:00Z",
                },
            )
        ).json()
        expired_decision = await client.post(
            f"/proposals/{expired['id']}/decisions",
            json={"expected_version": 1, "decision": "approve"},
        )

        current = (
            await client.post(
                "/proposals",
                json={
                    "proposal_type": "task_create",
                    "title": "Current proposal",
                    "evidence": [],
                    "before": {},
                    "after": {"title": "Restart"},
                },
            )
        ).json()
        accepted = await client.post(
            f"/proposals/{current['id']}/decisions",
            json={"expected_version": 1, "decision": "approve"},
        )
        stale = await client.post(
            f"/proposals/{current['id']}/decisions",
            json={"expected_version": 1, "decision": "reject"},
        )

        await create_and_select_api_user(client, "Second proposal owner")
        foreign_get = await client.get(f"/proposals/{current['id']}")
        foreign_decision = await client.post(
            f"/proposals/{current['id']}/decisions",
            json={"expected_version": 2, "decision": "reject"},
        )

    assert expired_decision.status_code == 409
    assert expired_decision.json()["detail"]["code"] == "proposal_expired"
    assert accepted.status_code == 200
    assert stale.status_code == 409
    assert stale.json()["detail"]["current"]["version"] == 2
    assert foreign_get.status_code == 404
    assert foreign_decision.status_code == 404
