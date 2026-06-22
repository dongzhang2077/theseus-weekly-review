from __future__ import annotations

from copy import deepcopy

from review_engine.rules import analyze_week
from tests.support import load_sample_payload


def risk_evidence(result: dict, text: str) -> str:
    return next(flag["evidence"] for flag in result["risk_flags"] if text in flag["evidence"])


def test_plan_drift_flags_under_plan_with_project_level_evidence() -> None:
    result = analyze_week(load_sample_payload())

    assert risk_evidence(result, "Theseus frontend planned") == (
        "Theseus frontend planned 4.0h, logged 1.0h, and finished "
        "3.0h under plan (75% difference)."
    )
    assert risk_evidence(result, "Resume and applications planned") == (
        "Resume and applications planned 2.0h, logged 0.0h, and finished "
        "2.0h under plan (100% difference)."
    )


def test_plan_drift_evidence_exposes_project_statuses() -> None:
    result = analyze_week(load_sample_payload())

    assert result["evidence"]["plan"]["project_drift"] == [
        {
            "project_id": 1,
            "project_title": "Theseus backend",
            "planned_minutes": 300,
            "actual_minutes": 240,
            "difference_minutes": -60,
            "difference_ratio": 0.2,
            "status": "on_track",
        },
        {
            "project_id": 2,
            "project_title": "Theseus frontend",
            "planned_minutes": 240,
            "actual_minutes": 60,
            "difference_minutes": -180,
            "difference_ratio": 0.75,
            "status": "under_plan",
        },
        {
            "project_id": 3,
            "project_title": "Resume and applications",
            "planned_minutes": 120,
            "actual_minutes": 0,
            "difference_minutes": -120,
            "difference_ratio": 1,
            "status": "under_plan",
        },
    ]
    assert result["evidence"]["plan"]["unplanned_project_minutes"] == 0
    assert result["evidence"]["plan"]["unplanned_projects"] == []


def test_plan_drift_flags_major_over_plan() -> None:
    payload = load_sample_payload()
    payload["weekly_plan"]["items"][0]["planned_minutes"] = 60

    result = analyze_week(payload)

    assert risk_evidence(result, "Theseus backend planned") == (
        "Theseus backend planned 1.0h, logged 4.0h, and finished "
        "3.0h over plan (300% difference)."
    )
    backend = result["evidence"]["plan"]["project_drift"][0]
    assert backend["status"] == "over_plan"
    assert backend["difference_minutes"] == 180


def test_plan_drift_exposes_unplanned_project_linked_time() -> None:
    payload = deepcopy(load_sample_payload())
    payload["projects"].append(
        {
            "id": 4,
            "goal_id": 1,
            "title": "Demo polish",
            "stage": "sprint",
            "deadline": "2026-06-20",
            "weekly_min_minutes": 0,
            "weekly_target_minutes": 120,
            "status": "active",
            "last_activity_date": None,
        }
    )
    payload["time_logs"].append(
        {
            "project_id": 4,
            "date": "2026-06-13",
            "start_time": "10:00",
            "end_time": "11:30",
            "duration_minutes": 90,
            "activity_name": "Demo polish",
            "activity_type": "consuming",
            "type_source": "user_selected",
            "note": "Unplanned but project-linked demo work.",
        }
    )

    result = analyze_week(payload)

    assert risk_evidence(result, "Demo polish logged") == (
        "Demo polish logged 1.5h without planned time."
    )
    assert result["evidence"]["plan"]["unplanned_project_minutes"] == 90
    assert result["evidence"]["plan"]["unplanned_projects"] == [
        {
            "project_id": 4,
            "project_title": "Demo polish",
            "actual_minutes": 90,
        }
    ]
    assert result["evidence"]["plan"]["project_drift"][-1]["status"] == "unplanned"
