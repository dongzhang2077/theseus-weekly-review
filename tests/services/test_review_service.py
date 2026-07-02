from collections.abc import Mapping
from datetime import date
from typing import Any

import pytest

from backend.app.db.repositories import WeeklyReviewRepository
from backend.app.schemas import WeeklyReviewGenerateRequest
from backend.app.services import ReviewService, WeeklyPlanNotFound
from backend.app.services.review_writer import OpenAIReviewWriter


REQUEST = WeeklyReviewGenerateRequest(
    week_start=date(2026, 6, 8),
    week_end=date(2026, 6, 14),
)


class StaticOpenAITransport:
    def post_json(
        self,
        url: str,
        *,
        headers: Mapping[str, str],
        payload: Mapping[str, Any],
        timeout_seconds: float,
    ) -> Mapping[str, Any]:
        return {"output_text": '{"generated_text":"You kept the backend moving."}'}


def test_service_generates_and_upserts_persisted_review(seeded_connection) -> None:
    service = ReviewService(seeded_connection)

    first = service.generate(REQUEST)
    second = service.generate(REQUEST)
    stored = WeeklyReviewRepository(seeded_connection).get_by_week(
        "2026-06-08", "2026-06-14"
    )
    count = seeded_connection.execute("SELECT COUNT(*) FROM weekly_reviews").fetchone()[0]

    assert first.id == second.id
    assert stored == second
    assert count == 1
    assert second.evidence["actual_total_minutes"] == 450
    assert second.wins[0].title == "Progress on Theseus backend"


def test_service_can_store_supportive_text_mode(seeded_connection) -> None:
    request = WeeklyReviewGenerateRequest(
        week_start=date(2026, 6, 8),
        week_end=date(2026, 6, 14),
        mode="supportive_text",
    )

    review = ReviewService(seeded_connection).generate(request)

    assert review.model_name == "template-supportive-v1"
    assert review.generated_text.startswith("You moved this forward:")
    assert review.wins[0].title == "Progress on Theseus backend"


def test_service_persists_openai_writer_result(seeded_connection) -> None:
    request = WeeklyReviewGenerateRequest(
        week_start=date(2026, 6, 8),
        week_end=date(2026, 6, 14),
        mode="supportive_text",
    )
    writer = OpenAIReviewWriter(
        api_key="test-key",
        model="gpt-test",
        transport=StaticOpenAITransport(),
    )

    review = ReviewService(seeded_connection, writer=writer).generate(request)
    stored = WeeklyReviewRepository(seeded_connection).get_by_week(
        "2026-06-08", "2026-06-14"
    )

    assert review.model_name == "openai:gpt-test"
    assert review.generated_text == "You kept the backend moving."
    assert review.wins[0].title == "Progress on Theseus backend"
    assert stored == review


def test_service_rejects_week_without_plan(connection) -> None:
    with pytest.raises(WeeklyPlanNotFound):
        ReviewService(connection).generate(REQUEST)
