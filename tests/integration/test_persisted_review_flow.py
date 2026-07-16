from datetime import date

from backend.app.db.repositories import WeeklyPlanRepository, WeeklyReviewRepository
from backend.app.schemas import PlannedItemCreate, WeeklyPlanCreate, WeeklyReviewGenerateRequest
from backend.app.services import ReviewService


def test_sample_to_sqlite_to_stored_review(seeded_connection, seeded_user) -> None:
    request = WeeklyReviewGenerateRequest(
        week_start=date(2026, 6, 8),
        week_end=date(2026, 6, 14),
    )

    generated = ReviewService(seeded_connection, seeded_user.id).generate(request)
    stored = WeeklyReviewRepository(seeded_connection, seeded_user.id).get_by_week(
        request.week_start.isoformat(), request.week_end.isoformat()
    )

    assert stored == generated
    assert generated.user_id == seeded_user.id
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


def test_replaced_plan_flows_into_review_evidence(seeded_connection, seeded_user) -> None:
    plans = WeeklyPlanRepository(seeded_connection, seeded_user.id)
    original = plans.get_by_week("2026-06-08", "2026-06-14")
    assert original is not None
    adjusted_items = [
        PlannedItemCreate(
            project_id=item.project_id,
            title=item.title,
            planned_minutes=item.planned_minutes + (60 if index == 0 else 0),
            priority=item.priority,
            is_completed=item.is_completed,
        )
        for index, item in enumerate(original.items)
    ]
    plans.replace(
        original.id,
        WeeklyPlanCreate(
            week_start=original.week_start,
            week_end=original.week_end,
            planned_capacity_minutes=original.planned_capacity_minutes,
            slack_target_percent=original.slack_target_percent,
            items=adjusted_items,
            note="Adjusted from Plan UI",
        ),
    )

    generated = ReviewService(seeded_connection, seeded_user.id).generate(
        WeeklyReviewGenerateRequest(
            week_start=date(2026, 6, 8),
            week_end=date(2026, 6, 14),
        )
    )

    assert generated.evidence["summary"]["planned_total_minutes"] == 720
    assert generated.evidence["projects"][0]["planned_minutes"] == 360
