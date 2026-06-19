from datetime import date

import pytest
from pydantic import ValidationError

from backend.app.schemas import GoalCreate, TimeLogCreate, WeeklyPlanCreate


def test_create_schema_rejects_database_managed_fields() -> None:
    with pytest.raises(ValidationError):
        GoalCreate.model_validate({"id": 10, "title": "Not accepted"})


def test_weekly_plan_validates_range_and_uses_independent_item_lists() -> None:
    first = WeeklyPlanCreate(week_start=date(2026, 6, 8), week_end=date(2026, 6, 14))
    second = WeeklyPlanCreate(week_start=date(2026, 6, 15), week_end=date(2026, 6, 21))

    assert first.items is not second.items
    assert second.items == []
    with pytest.raises(ValidationError):
        WeeklyPlanCreate(week_start=date(2026, 6, 15), week_end=date(2026, 6, 14))


def test_time_log_requires_start_and_end_times_together() -> None:
    with pytest.raises(ValidationError):
        TimeLogCreate(
            date=date(2026, 6, 10),
            start_time="09:00",
            duration_minutes=30,
            activity_name="Backend",
            activity_type="consuming",
        )
