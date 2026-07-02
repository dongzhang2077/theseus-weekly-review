from datetime import date

import pytest

from backend.app.db.repositories import WeeklyReviewRepository
from backend.app.schemas import WeeklyReviewGenerateRequest
from backend.app.services import ReviewService, WeeklyPlanNotFound


REQUEST = WeeklyReviewGenerateRequest(
    week_start=date(2026, 6, 8),
    week_end=date(2026, 6, 14),
)


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


def test_service_rejects_week_without_plan(connection) -> None:
    with pytest.raises(WeeklyPlanNotFound):
        ReviewService(connection).generate(REQUEST)
