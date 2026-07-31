from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

from backend.app.main import create_app
from backend.app.services import (
    AssistantContextPolicyViolation,
    import_sample_week,
    serialize_provider_envelope,
)
from tests.support import create_and_select_api_user, load_sample_payload


pytestmark = pytest.mark.anyio

WINDOW = {
    "window_start": "2026-06-08",
    "window_end": "2026-06-14",
}
DENIED_KEYS = {
    "access_token",
    "api_key",
    "credentials",
    "description",
    "email",
    "evidence",
    "generated_text",
    "note",
    "oauth_token",
    "pairing_token",
    "password",
    "preferences",
    "provenance",
    "raw_audio",
    "refresh_token",
    "session_token",
    "time_logs",
    "transcript_history",
    "user_id",
}


async def test_gateway_routes_are_authenticated_and_typed(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        status_response = await client.get("/assistant/gateway/status")
        envelope_response = await client.post(
            "/assistant/gateway/envelope",
            json={
                **WINDOW,
                "purpose": "weekly_review",
                "utterance": "How did this week go?",
            },
        )
        schema = (await client.get("/openapi.json")).json()

    assert status_response.status_code == 401
    assert envelope_response.status_code == 401
    status_operation = schema["paths"]["/assistant/gateway/status"]["get"]
    envelope_operation = schema["paths"]["/assistant/gateway/envelope"]["post"]
    assert status_operation["security"] == [{"HTTPBearer": []}]
    assert envelope_operation["security"] == [{"HTTPBearer": []}]
    assert envelope_operation["requestBody"]["content"]["application/json"][
        "schema"
    ] == {"$ref": "#/components/schemas/AssistantGatewayEnvelopeRequest"}
    assert envelope_operation["responses"]["200"]["content"]["application/json"][
        "schema"
    ] == {"$ref": "#/components/schemas/AssistantGatewayContextEnvelope"}


async def test_weekly_review_envelope_is_minimal_and_reconciles_aggregates(
    database,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    sample = load_sample_payload()
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        user = await create_and_select_api_user(client, "Gateway context owner")
        with database.session() as connection:
            import_sample_week(connection, user["id"], sample)
        generated = await client.post(
            "/reviews/weekly/generate",
            json={
                "week_start": WINDOW["window_start"],
                "week_end": WINDOW["window_end"],
                "mode": "deterministic_first",
            },
        )
        response = await client.post(
            "/assistant/gateway/envelope",
            json={
                **WINDOW,
                "purpose": "weekly_review",
                "utterance": "Summarize the useful patterns in this week.",
            },
        )

    assert generated.status_code == 200
    assert response.status_code == 200
    payload = response.json()
    assert payload["gateway_version"] == "v1"
    assert payload["included_sections"] == [
        "projects",
        "weekly_plan",
        "time_summary",
        "review_summary",
    ]
    assert payload["tasks"] == []
    assert payload["running_focus"] == []
    assert payload["time_summary"]["total_minutes"] == sum(
        item["duration_minutes"] for item in sample["time_logs"]
    )
    assert payload["time_summary"]["record_count"] == len(sample["time_logs"])
    assert payload["weekly_plan"]["planned_minutes"] == sum(
        item["planned_minutes"] for item in sample["weekly_plan"]["items"]
    )
    assert payload["review_summary"]["id"] == generated.json()["id"]
    assert not (_all_keys(payload) & DENIED_KEYS)
    assert user["email"] not in json.dumps(payload)


async def test_gateway_context_is_account_scoped(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        owner = await create_and_select_api_user(client, "Gateway first owner")
        with database.session() as connection:
            import_sample_week(connection, owner["id"], load_sample_payload())

        second = await create_and_select_api_user(client, "Gateway second owner")
        response = await client.post(
            "/assistant/gateway/envelope",
            json={
                **WINDOW,
                "purpose": "weekly_review",
                "utterance": "Review my own week.",
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert second["id"] != owner["id"]
    assert payload["projects"] == []
    assert payload["weekly_plan"] is None
    assert payload["time_summary"] == {
        "total_minutes": 0,
        "record_count": 0,
        "by_project": [],
        "by_activity_type": [],
        "by_date": [],
    }
    assert payload["review_summary"] is None


@pytest.mark.parametrize(
    "utterance",
    (
        "Use sk-abcdefghijklmnopqrstuvwxyz123456 for this request.",
        "My account is private.student@example.com.",
        "Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456",
        "Pair with ths_int_abcdefghijklmnopqrstuvwxyz123456.",
        "Telegram token 123456789:abcdefghijklmnopqrstuvwxyzABCDE",
    ),
)
async def test_gateway_rejects_sensitive_values_in_explicit_input(
    database,
    utterance: str,
) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client, "Sensitive context owner")
        response = await client.post(
            "/assistant/gateway/envelope",
            json={
                **WINDOW,
                "purpose": "task_status",
                "utterance": utterance,
            },
        )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "sensitive_context_rejected"


async def test_gateway_rejects_sensitive_persisted_text(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        user = await create_and_select_api_user(client, "Stored sensitive owner")
        with database.session() as connection:
            import_sample_week(connection, user["id"], load_sample_payload())
        project = (await client.get("/projects")).json()[0]
        created = await client.post(
            "/tasks",
            json={
                "project_id": project["id"],
                "title": "Contact private.student@example.com",
            },
        )
        response = await client.post(
            "/assistant/gateway/envelope",
            json={
                **WINDOW,
                "purpose": "task_status",
                "utterance": "What is open?",
            },
        )

    assert created.status_code == 201
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "sensitive_context_rejected"


async def test_gateway_is_bounded_and_reports_omitted_records(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        user = await create_and_select_api_user(client, "Bounded context owner")
        with database.session() as connection:
            import_sample_week(connection, user["id"], load_sample_payload())
        project = (await client.get("/projects")).json()[0]
        for index in range(22):
            created = await client.post(
                "/tasks",
                json={
                    "project_id": project["id"],
                    "title": f"Bounded task {index + 1}",
                    "priority": 3,
                },
            )
            assert created.status_code == 201
        response = await client.post(
            "/assistant/gateway/envelope",
            json={
                **WINDOW,
                "purpose": "task_status",
                "utterance": "Which Tasks are open?",
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["tasks"]) == 20
    assert payload["omitted_counts"]["tasks"] == 2


async def test_missing_cloud_configuration_does_not_block_local_envelope(
    database,
    monkeypatch,
) -> None:
    monkeypatch.setenv("THESEUS_ASSISTANT_PROVIDER", "openai")
    monkeypatch.delenv("THESEUS_ASSISTANT_MODEL", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client, "Local fallback owner")
        status_response = await client.get("/assistant/gateway/status")
        envelope_response = await client.post(
            "/assistant/gateway/envelope",
            json={
                **WINDOW,
                "purpose": "focus_status",
                "utterance": "What is running?",
            },
        )

    assert status_response.status_code == 200
    assert status_response.json() == {
        "gateway_version": "v1",
        "provider": "openai",
        "configured": False,
        "model": None,
        "cloud_calls_enabled": False,
    }
    assert envelope_response.status_code == 200


async def test_configured_provider_status_never_returns_the_api_key(
    database,
    monkeypatch,
) -> None:
    secret = "sk-local-only-abcdefghijklmnopqrstuvwxyz123456"
    monkeypatch.setenv("THESEUS_ASSISTANT_PROVIDER", "openai")
    monkeypatch.setenv("THESEUS_ASSISTANT_MODEL", "explicit-test-model")
    monkeypatch.setenv("OPENAI_API_KEY", secret)
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client, "Configured provider owner")
        response = await client.get("/assistant/gateway/status")

    assert response.status_code == 200
    assert response.json() == {
        "gateway_version": "v1",
        "provider": "openai",
        "configured": True,
        "model": "explicit-test-model",
        "cloud_calls_enabled": False,
    }
    assert secret not in response.text


async def test_unsupported_provider_is_visible_without_breaking_fallback(
    database,
    monkeypatch,
) -> None:
    monkeypatch.setenv("THESEUS_ASSISTANT_PROVIDER", "unknown-provider")
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client, "Unsupported provider owner")
        response = await client.get("/assistant/gateway/status")

    assert response.status_code == 200
    assert response.json()["provider"] == "unsupported"
    assert response.json()["configured"] is False
    assert response.json()["cloud_calls_enabled"] is False


async def test_sensitive_model_configuration_is_not_returned(
    database,
    monkeypatch,
) -> None:
    secret = "sk-model-field-abcdefghijklmnopqrstuvwxyz123456"
    monkeypatch.setenv("THESEUS_ASSISTANT_PROVIDER", "openai")
    monkeypatch.setenv("THESEUS_ASSISTANT_MODEL", secret)
    monkeypatch.setenv("OPENAI_API_KEY", "configured-but-never-returned")
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await create_and_select_api_user(client, "Sensitive model owner")
        response = await client.get("/assistant/gateway/status")

    assert response.status_code == 200
    assert response.json()["configured"] is False
    assert response.json()["model"] is None
    assert secret not in response.text


def test_serializer_rejects_denied_fields_and_raw_history() -> None:
    with pytest.raises(AssistantContextPolicyViolation):
        serialize_provider_envelope(
            {
                "gateway_version": "v1",
                "utterance": "Review the week",
                "api_key": "not-even-a-real-secret",
            }
        )
    with pytest.raises(AssistantContextPolicyViolation):
        serialize_provider_envelope(
            {
                "gateway_version": "v1",
                "utterance": "Review the week",
                "time_logs": [{"note": "raw history"}],
            }
        )


def _all_keys(value: Any) -> set[str]:
    if isinstance(value, dict):
        return set(value) | {
            child_key
            for child in value.values()
            for child_key in _all_keys(child)
        }
    if isinstance(value, list):
        return {
            child_key
            for child in value
            for child_key in _all_keys(child)
        }
    return set()
