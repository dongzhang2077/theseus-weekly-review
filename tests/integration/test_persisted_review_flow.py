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
    assert generated.evidence == {
        "actual_by_goal": {"Build Theseus MVP": 300},
        "actual_by_project": {"Theseus backend": 240, "Theseus frontend": 60},
        "actual_total_minutes": 450,
        "activity_mix": {"consuming": 300, "destroy": 90, "restore": 60},
        "planned_by_project": {
            "Resume and applications": 120,
            "Theseus backend": 300,
            "Theseus frontend": 240,
        },
        "planned_total_minutes": 660,
        "reflection_count": 1,
    }
