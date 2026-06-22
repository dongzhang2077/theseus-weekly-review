from datetime import date

from backend.app.db.repositories import WeeklyReviewRepository
from backend.app.schemas import WeeklyReviewGenerateRequest
from backend.app.services import ReviewService


def test_sample_to_sqlite_to_stored_review(seeded_connection) -> None:
    request = WeeklyReviewGenerateRequest(
        week_start=date(2026, 6, 8),
        week_end=date(2026, 6, 14),
    )

    generated = ReviewService(seeded_connection).generate(request)
    stored = WeeklyReviewRepository(seeded_connection).get_by_week(
        request.week_start.isoformat(), request.week_end.isoformat()
    )

    assert stored == generated
    assert generated.evidence["schema_version"] == "sprint2.review_evidence.v1"
    assert generated.evidence["summary"]["actual_total_minutes"] == 450
    assert generated.evidence["activity"]["mix"] == {
        "consuming": 300,
        "neutral": 0,
        "restore": 60,
        "destroy": 90,
    }
    assert generated.evidence["projects"][0]["title"] == "Theseus backend"
    assert generated.evidence["projects"][0]["planned_minutes"] == 300
    assert generated.evidence["projects"][0]["actual_minutes"] == 240
    assert generated.evidence["actual_total_minutes"] == 450
