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


def _channel_headers(pairing: dict, *, message_id: str = "message-001") -> dict:
    return {
        "Authorization": f"Bearer {pairing['access_token']}",
        "X-Channel-Type": "local_test",
        "X-External-Identity": "local-user-001",
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
