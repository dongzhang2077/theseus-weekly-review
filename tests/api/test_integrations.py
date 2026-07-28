from __future__ import annotations

import httpx
import pytest

from backend.app.main import create_app
from backend.app.services import import_sample_week
from tests.support import create_and_select_api_user, load_sample_payload


pytestmark = pytest.mark.anyio

WEEK_QUERY = {
    "week_start": "2026-06-08",
    "week_end": "2026-06-14",
}
WEEKLY_PROPOSAL_REQUEST = {
    "review_week_start": "2026-06-08",
    "review_week_end": "2026-06-14",
    "target_week_start": "2026-06-15",
    "target_week_end": "2026-06-21",
}


async def _pair(
    client: httpx.AsyncClient,
    *,
    identity: str = "local-user-001",
    scopes: list[str] | None = None,
) -> dict:
    response = await client.post(
        "/integrations/pair",
        json={
            "label": "Local test channel",
            "channel_type": "local_test",
            "external_identity": identity,
            "scopes": scopes or ["context:read"],
            "expires_in_seconds": 3600,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _channel_headers(
    pairing: dict,
    *,
    message_id: str = "message-001",
    identity: str = "local-user-001",
) -> dict:
    return {
        "Authorization": f"Bearer {pairing['access_token']}",
        "X-Channel-Type": "local_test",
        "X-External-Identity": identity,
        "X-External-Message-ID": message_id,
    }


async def test_pairing_shows_secret_once_and_hashes_sensitive_values(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        user = await create_and_select_api_user(client, "Integration owner")
        pairing = await _pair(client)
        listed = await client.get("/integrations")
        schema = (await client.get("/openapi.json")).json()

    assert pairing["access_token"].startswith("ths_int_")
    assert pairing["credential"]["user_id"] == user["id"]
    assert pairing["credential"]["scopes"] == ["context:read"]
    assert listed.status_code == 200
    assert listed.json() == [pairing["credential"]]
    assert "access_token" not in listed.text
    assert "external_identity" not in listed.text
    assert schema["paths"]["/integrations/pair"]["post"]["security"] == [
        {"HTTPBearer": []}
    ]
    assert schema["paths"]["/integrations/channel/context"]["get"][
        "responses"
    ]["200"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/AssistantContextRead"
    }

    with database.session() as connection:
        credential = connection.execute(
            "SELECT token_hash FROM integration_credentials"
        ).fetchone()
        binding = connection.execute(
            "SELECT external_identity_hash FROM channel_bindings"
        ).fetchone()
        receipt_columns = {
            row["name"]
            for row in connection.execute(
                "PRAGMA table_info(integration_message_receipts)"
            ).fetchall()
        }
    assert credential["token_hash"] != pairing["access_token"]
    assert binding["external_identity_hash"] != "local-user-001"
    assert "response_json" not in receipt_columns


async def test_channel_context_is_scoped_and_replay_is_idempotent(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        user = await create_and_select_api_user(client, "Context channel owner")
        with database.session() as connection:
            import_sample_week(connection, user["id"], load_sample_payload())
        pairing = await _pair(client)
        headers = _channel_headers(pairing)
        first = await client.get(
            "/integrations/channel/context", params=WEEK_QUERY, headers=headers
        )
        replay = await client.get(
            "/integrations/channel/context", params=WEEK_QUERY, headers=headers
        )

    assert first.status_code == 200
    assert replay.status_code == 200
    assert replay.json() == first.json()
    assert first.json()["user_id"] == user["id"]
    with database.session() as connection:
        receipt_count = connection.execute(
            "SELECT COUNT(*) FROM integration_message_receipts"
        ).fetchone()[0]
    assert receipt_count == 1


async def test_channel_proposal_is_scoped_pending_and_replay_safe(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        user = await create_and_select_api_user(client, "Channel proposal owner")
        with database.session() as connection:
            import_sample_week(connection, user["id"], load_sample_payload())
        generated = await client.post("/reviews/weekly/generate", json=WEEK_QUERY)
        plans_before = (await client.get("/weekly-plans")).json()
        pairing = await _pair(client, scopes=["proposal:create"])
        headers = _channel_headers(pairing, message_id="proposal-message-001")

        first = await client.post(
            "/integrations/channel/proposals/weekly-adjustment",
            json=WEEKLY_PROPOSAL_REQUEST,
            headers=headers,
        )
        replay = await client.post(
            "/integrations/channel/proposals/weekly-adjustment",
            json=WEEKLY_PROPOSAL_REQUEST,
            headers=headers,
        )
        conflict = await client.post(
            "/integrations/channel/proposals/weekly-adjustment",
            json={**WEEKLY_PROPOSAL_REQUEST, "target_week_end": "2026-06-22"},
            headers=headers,
        )
        plans_after = (await client.get("/weekly-plans")).json()
        schema = (await client.get("/openapi.json")).json()

    assert generated.status_code == 200
    assert first.status_code == 201
    assert replay.status_code == 201
    assert replay.json()["id"] == first.json()["id"]
    assert first.json()["status"] == "pending"
    assert first.json()["user_id"] == user["id"]
    assert plans_after == plans_before
    assert conflict.status_code == 409
    assert conflict.json()["detail"]["code"] == "external_message_replay_conflict"
    operation = schema["paths"]["/integrations/channel/proposals/weekly-adjustment"][
        "post"
    ]
    assert operation["security"] == [{"HTTPBearer": []}]
    assert operation["requestBody"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/AssistantWeeklyPlanProposalRequest"
    }
    assert operation["responses"]["201"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/ProposalRead"
    }
    with database.session() as connection:
        assert connection.execute(
            "SELECT COUNT(*) FROM integration_message_receipts"
        ).fetchone()[0] == 1


async def test_channel_proposal_rolls_back_receipts_when_source_is_missing(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        user = await create_and_select_api_user(client, "Retry channel proposal owner")
        pairing = await _pair(client, scopes=["proposal:create"])
        headers = _channel_headers(pairing, message_id="proposal-retry-001")
        missing = await client.post(
            "/integrations/channel/proposals/weekly-adjustment",
            json=WEEKLY_PROPOSAL_REQUEST,
            headers=headers,
        )
        with database.session() as connection:
            import_sample_week(connection, user["id"], load_sample_payload())
        generated = await client.post("/reviews/weekly/generate", json=WEEK_QUERY)
        retry = await client.post(
            "/integrations/channel/proposals/weekly-adjustment",
            json=WEEKLY_PROPOSAL_REQUEST,
            headers=headers,
        )

    assert missing.status_code == 404
    assert generated.status_code == 200
    assert retry.status_code == 201
    with database.session() as connection:
        assert connection.execute(
            "SELECT COUNT(*) FROM integration_message_receipts"
        ).fetchone()[0] == 1


async def test_channel_proposal_requires_proposal_scope(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client, "Read-only proposal owner")
        pairing = await _pair(client, scopes=["context:read"])
        denied = await client.post(
            "/integrations/channel/proposals/weekly-adjustment",
            json=WEEKLY_PROPOSAL_REQUEST,
            headers=_channel_headers(pairing, message_id="proposal-denied-001"),
        )

    assert denied.status_code == 403
    assert denied.json()["detail"]["code"] == "integration_scope_denied"
    assert "proposal:create" not in denied.text


async def test_channel_proposal_decision_is_scoped_replay_safe_and_never_executes(
    database,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        user = await create_and_select_api_user(client, "Channel decision owner")
        with database.session() as connection:
            import_sample_week(connection, user["id"], load_sample_payload())
        generated = await client.post("/reviews/weekly/generate", json=WEEK_QUERY)
        identity = f"decision-user-{id(client)}"
        pairing = await _pair(
            client,
            identity=identity,
            scopes=["proposal:create", "proposal:decide"],
        )
        proposal = await client.post(
            "/integrations/channel/proposals/weekly-adjustment",
            json=WEEKLY_PROPOSAL_REQUEST,
            headers=_channel_headers(
                pairing,
                message_id="proposal-decision-source",
                identity=identity,
            ),
        )
        plans_before = (await client.get("/weekly-plans")).json()
        payload = {"expected_version": proposal.json()["version"], "decision": "approve"}
        first = await client.post(
            f"/integrations/channel/proposals/{proposal.json()['id']}/decision",
            json=payload,
            headers=_channel_headers(
                pairing,
                message_id="proposal-decision-001",
                identity=identity,
            ),
        )
        replay = await client.post(
            f"/integrations/channel/proposals/{proposal.json()['id']}/decision",
            json=payload,
            headers=_channel_headers(
                pairing,
                message_id="proposal-decision-001",
                identity=identity,
            ),
        )
        conflict = await client.post(
            f"/integrations/channel/proposals/{proposal.json()['id']}/decision",
            json={**payload, "decision": "reject"},
            headers=_channel_headers(
                pairing,
                message_id="proposal-decision-001",
                identity=identity,
            ),
        )
        edit = await client.post(
            f"/integrations/channel/proposals/{proposal.json()['id']}/decision",
            json={"expected_version": proposal.json()["version"], "decision": "edit"},
            headers=_channel_headers(
                pairing,
                message_id="proposal-decision-edit",
                identity=identity,
            ),
        )
        plans_after = (await client.get("/weekly-plans")).json()
        detail = await client.get(f"/proposals/{proposal.json()['id']}")
        schema = (await client.get("/openapi.json")).json()

    assert generated.status_code == 200
    assert proposal.status_code == 201
    assert first.status_code == 200
    assert replay.status_code == 200
    assert replay.json() == first.json()
    assert first.json()["decision"] == "approve"
    assert first.json()["proposal_id"] == proposal.json()["id"]
    assert conflict.status_code == 409
    assert conflict.json()["detail"]["code"] == "external_message_replay_conflict"
    assert edit.status_code == 422
    assert plans_after == plans_before
    assert detail.json()["proposal"]["status"] == "approved"
    assert len(detail.json()["decisions"]) == 1
    assert detail.json()["actions"] == []
    operation = schema["paths"][
        "/integrations/channel/proposals/{proposal_id}/decision"
    ]["post"]
    assert operation["security"] == [{"HTTPBearer": []}]
    assert operation["requestBody"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/ChannelProposalDecisionRequest"
    }
    assert operation["responses"]["200"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/ProposalDecisionRead"
    }
    with database.session() as connection:
        assert connection.execute(
            "SELECT COUNT(*) FROM integration_message_receipts"
        ).fetchone()[0] == 2


async def test_channel_proposal_decision_requires_its_own_scope(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        user = await create_and_select_api_user(client, "Proposal-only channel owner")
        identity = f"decision-user-{id(client)}"
        pairing = await _pair(
            client, identity=identity, scopes=["proposal:create"]
        )
        denied = await client.post(
            "/integrations/channel/proposals/1/decision",
            json={"expected_version": 1, "decision": "approve"},
            headers=_channel_headers(
                pairing,
                message_id="proposal-decision-denied",
                identity=identity,
            ),
        )

    assert denied.status_code == 403
    assert denied.json()["detail"]["code"] == "integration_scope_denied"
    assert "proposal:decide" not in denied.text


async def test_channel_execution_requires_approval_scope_and_replays_once(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        user = await create_and_select_api_user(client, "Channel execution owner")
        with database.session() as connection:
            import_sample_week(connection, user["id"], load_sample_payload())
        assert (await client.post("/reviews/weekly/generate", json=WEEK_QUERY)).status_code == 200
        identity = f"execution-user-{id(client)}"
        pairing = await _pair(client, identity=identity, scopes=["proposal:create", "proposal:decide", "action:execute", "action:undo"])
        proposal = await client.post("/integrations/channel/proposals/weekly-adjustment", json=WEEKLY_PROPOSAL_REQUEST, headers=_channel_headers(pairing, message_id="execution-source", identity=identity))
        pending = await client.post(f"/integrations/channel/proposals/{proposal.json()['id']}/execute-weekly-plan", json={"expected_version": proposal.json()["version"]}, headers=_channel_headers(pairing, message_id="execution-pending", identity=identity))
        approved = await client.post(f"/integrations/channel/proposals/{proposal.json()['id']}/decision", json={"expected_version": proposal.json()["version"], "decision":"approve"}, headers=_channel_headers(pairing, message_id="execution-approve", identity=identity))
        first = await client.post(f"/integrations/channel/proposals/{proposal.json()['id']}/execute-weekly-plan", json={"expected_version": 2}, headers=_channel_headers(pairing, message_id="execution-001", identity=identity))
        replay = await client.post(f"/integrations/channel/proposals/{proposal.json()['id']}/execute-weekly-plan", json={"expected_version": 2}, headers=_channel_headers(pairing, message_id="execution-001", identity=identity))
        conflict = await client.post(f"/integrations/channel/proposals/{proposal.json()['id']}/execute-weekly-plan", json={"expected_version": 3}, headers=_channel_headers(pairing, message_id="execution-001", identity=identity))
        undo = await client.post(f"/integrations/channel/proposals/{proposal.json()['id']}/actions/{first.json()['action']['id']}/undo-weekly-plan", json={"expected_version": 3}, headers=_channel_headers(pairing, message_id="undo-001", identity=identity))
        undo_replay = await client.post(f"/integrations/channel/proposals/{proposal.json()['id']}/actions/{first.json()['action']['id']}/undo-weekly-plan", json={"expected_version": 3}, headers=_channel_headers(pairing, message_id="undo-001", identity=identity))
        undo_conflict = await client.post(f"/integrations/channel/proposals/{proposal.json()['id']}/actions/{first.json()['action']['id']}/undo-weekly-plan", json={"expected_version": 4}, headers=_channel_headers(pairing, message_id="undo-001", identity=identity))
        detail = await client.get(f"/proposals/{proposal.json()['id']}")
        schema = (await client.get("/openapi.json")).json()

    assert proposal.status_code == 201
    assert pending.status_code == 409 and pending.json()["detail"]["code"] == "proposal_not_approved"
    assert approved.status_code == 200
    assert first.status_code == replay.status_code == 200
    assert first.json() == replay.json()
    assert first.json()["proposal"]["status"] == "executed"
    assert first.json()["action"]["status"] == "succeeded"
    assert conflict.status_code == 409 and conflict.json()["detail"]["code"] == "external_message_replay_conflict"
    assert undo.status_code == undo_replay.status_code == 200
    assert undo.json() == undo_replay.json()
    assert undo.json()["proposal"]["status"] == "undone"
    assert undo.json()["action"]["status"] == "succeeded"
    assert undo.json()["undone_action"]["id"] == first.json()["action"]["id"]
    assert undo.json()["undone_action"]["status"] == "undone"
    assert undo_conflict.status_code == 409 and undo_conflict.json()["detail"]["code"] == "external_message_replay_conflict"
    assert len(detail.json()["actions"]) == 2
    operation = schema["paths"]["/integrations/channel/proposals/{proposal_id}/execute-weekly-plan"]["post"]
    assert operation["requestBody"]["content"]["application/json"]["schema"] == {"$ref": "#/components/schemas/ChannelProposalExecutionRequest"}
    assert operation["responses"]["200"]["content"]["application/json"]["schema"] == {"$ref": "#/components/schemas/AssistantWeeklyPlanExecutionRead"}
    undo_operation = schema["paths"]["/integrations/channel/proposals/{proposal_id}/actions/{action_id}/undo-weekly-plan"]["post"]
    assert undo_operation["requestBody"]["content"]["application/json"]["schema"] == {"$ref": "#/components/schemas/ChannelProposalUndoRequest"}
    assert undo_operation["responses"]["200"]["content"]["application/json"]["schema"] == {"$ref": "#/components/schemas/AssistantWeeklyPlanUndoRead"}


async def test_channel_undo_requires_its_own_scope(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client, "Undo scope owner")
        identity = f"undo-scope-{id(client)}"
        pairing = await _pair(client, identity=identity, scopes=["action:execute"])
        denied = await client.post(
            "/integrations/channel/proposals/1/actions/1/undo-weekly-plan",
            json={"expected_version": 1},
            headers=_channel_headers(pairing, message_id="undo-denied", identity=identity),
        )

    assert denied.status_code == 403
    assert denied.json()["detail"]["code"] == "integration_scope_denied"
    assert "action:undo" not in denied.text


async def test_scope_expiry_identity_and_replay_conflicts_are_controlled(
    database,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client, "Restricted channel owner")
        restricted = await _pair(client, scopes=["proposal:create"])
        denied = await client.get(
            "/integrations/channel/context",
            params=WEEK_QUERY,
            headers=_channel_headers(restricted),
        )

        readable = await _pair(client, identity="local-user-002")
        wrong_identity_headers = _channel_headers(readable)
        wrong_identity = await client.get(
            "/integrations/channel/context",
            params=WEEK_QUERY,
            headers=wrong_identity_headers,
        )

        valid_headers = {
            **wrong_identity_headers,
            "X-External-Identity": "local-user-002",
        }
        first = await client.get(
            "/integrations/channel/context",
            params=WEEK_QUERY,
            headers=valid_headers,
        )
        conflict = await client.get(
            "/integrations/channel/context",
            params={"week_start": "2026-06-09", "week_end": "2026-06-14"},
            headers=valid_headers,
        )
        with database.session() as connection:
            connection.execute(
                """
                UPDATE integration_credentials
                SET created_at = ?, expires_at = ?
                WHERE id = ?
                """,
                (
                    "2019-01-01T00:00:00+00:00",
                    "2020-01-01T00:00:00+00:00",
                    readable["credential"]["id"],
                ),
            )
        expired = await client.get(
            "/integrations/channel/context",
            params=WEEK_QUERY,
            headers={**valid_headers, "X-External-Message-ID": "message-002"},
        )

    assert denied.status_code == 403
    assert denied.json()["detail"]["code"] == "integration_scope_denied"
    assert wrong_identity.status_code == 401
    assert wrong_identity.json()["detail"]["code"] == "integration_access_denied"
    assert "local-user" not in wrong_identity.text
    assert first.status_code == 200
    assert conflict.status_code == 409
    assert conflict.json()["detail"]["code"] == "external_message_replay_conflict"
    assert expired.status_code == 401


async def test_revocation_is_immediate_and_preserves_domain_data(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        user = await create_and_select_api_user(client, "Revocation owner")
        browser_authorization = client.headers["Authorization"]
        pairing = await _pair(client)
        with database.session() as connection:
            import_sample_week(connection, user["id"], load_sample_payload())
        revoked = await client.delete(
            f"/integrations/{pairing['credential']['id']}",
            headers={"Authorization": browser_authorization},
        )
        denied = await client.get(
            "/integrations/channel/context",
            params=WEEK_QUERY,
            headers=_channel_headers(pairing, message_id="after-revoke"),
        )

    assert revoked.status_code == 204
    assert denied.status_code == 401
    with database.session() as connection:
        assert connection.execute(
            "SELECT COUNT(*) FROM goals WHERE user_id = ?", (user["id"],)
        ).fetchone()[0] > 0


async def test_pairing_and_management_are_account_isolated(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        first = await create_and_select_api_user(client, "First integration owner")
        pairing = await _pair(client)
        await create_and_select_api_user(client, "Second integration owner")
        listed = await client.get("/integrations")
        missing = await client.delete(
            f"/integrations/{pairing['credential']['id']}"
        )
        duplicate_identity = await client.post(
            "/integrations/pair",
            json={
                "label": "Duplicate binding",
                "channel_type": "local_test",
                "external_identity": "local-user-001",
                "scopes": ["context:read"],
                "expires_in_seconds": 3600,
            },
        )

    assert first["id"] == pairing["credential"]["user_id"]
    assert listed.json() == []
    assert missing.status_code == 404
    assert duplicate_identity.status_code == 409
