import httpx
import pytest

from backend.app.main import create_app
from tests.support import load_sample_payload, seed_sample_week


pytestmark = pytest.mark.anyio


async def test_generate_endpoint_persists_review(database) -> None:
    app = create_app(database.path)
    with database.session() as connection:
        seed_sample_week(connection)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/reviews/weekly/generate",
            json={"week_start": "2026-06-08", "week_end": "2026-06-14"},
        )

    assert response.status_code == 200
    assert response.json()["id"] == 1
    with database.session() as connection:
        count = connection.execute("SELECT COUNT(*) FROM weekly_reviews").fetchone()[0]
    assert count == 1


async def test_generate_endpoint_returns_404_without_plan(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/reviews/weekly/generate",
            json={"week_start": "2026-06-08", "week_end": "2026-06-14"},
        )

    assert response.status_code == 404
    assert response.json()["detail"].startswith("No weekly plan exists")


async def test_generate_endpoint_supports_supportive_text_mode(database) -> None:
    app = create_app(database.path)
    with database.session() as connection:
        seed_sample_week(connection)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/reviews/weekly/generate",
            json={
                "week_start": "2026-06-08",
                "week_end": "2026-06-14",
                "mode": "supportive_text",
            },
        )

    assert response.status_code == 200
    assert response.json()["model_name"] == "template-supportive-v1"
    assert response.json()["generated_text"].startswith("You moved this forward:")


async def test_generate_endpoint_returns_502_for_misconfigured_writer(
    database,
    monkeypatch,
) -> None:
    monkeypatch.setenv("THESEUS_REVIEW_WRITER", "openai")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    app = create_app(database.path)
    with database.session() as connection:
        seed_sample_week(connection)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/reviews/weekly/generate",
            json={
                "week_start": "2026-06-08",
                "week_end": "2026-06-14",
                "mode": "supportive_text",
            },
        )

    assert response.status_code == 502
    assert "OPENAI_API_KEY" in response.json()["detail"]


async def test_analyze_endpoint_preserves_in_memory_compatibility(database) -> None:
    app = create_app(database.path)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/reviews/weekly/analyze", json=load_sample_payload())

    assert response.status_code == 200
    assert response.json()["evidence"]["actual_total_minutes"] == 450
