from datetime import date

from review_engine.rules import _days_since, analyze_week

from backend.app.schemas import WeeklyReviewGenerateRequest
from backend.app.services import ReviewService
from tests.support import load_sample_payload


def test_persisted_context_matches_sample_semantics(seeded_connection) -> None:
    expected = analyze_week(load_sample_payload())
    stored = ReviewService(seeded_connection).generate(
        WeeklyReviewGenerateRequest(
            week_start=date(2026, 6, 8),
            week_end=date(2026, 6, 14),
        )
    )
    actual = stored.model_dump(
        mode="json",
        exclude={"id", "model_name", "created_at", "updated_at"},
    )

    assert actual == expected


def test_dormancy_dates_accept_iso_strings_and_date_values() -> None:
    assert _days_since("2026-05-15", "2026-06-14") == 30
    assert _days_since(date(2026, 5, 15), date(2026, 6, 14)) == 30
    assert _days_since("not-a-date", "2026-06-14") is None
