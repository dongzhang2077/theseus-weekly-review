from __future__ import annotations

from copy import deepcopy

from review_engine.rules import analyze_week
from tests.support import load_sample_payload


def base_payload() -> dict:
    return {
        "goals": [
            {
                "id": 1,
                "title": "Quiet goal",
                "description": "",
                "priority": 1,
                "active_status": False,
            }
        ],
        "projects": [
            {
                "id": 1,
                "goal_id": 1,
                "title": "Maintenance project",
                "stage": "stable",
                "deadline": None,
                "weekly_min_minutes": 0,
                "weekly_target_minutes": 120,
                "status": "active",
                "last_activity_date": "2026-06-13",
            }
        ],
        "weekly_plan": {
            "week_start": "2026-06-08",
            "week_end": "2026-06-14",
            "planned_capacity_minutes": 0,
            "slack_target_percent": 20,
            "items": [],
            "note": "",
        },
        "time_logs": [],
        "daily_reflections": [],
    }


def risk_evidence(result: dict, text: str) -> str:
    return next(flag["evidence"] for flag in result["risk_flags"] if text in flag["evidence"])


def risk_types(result: dict) -> list[str]:
    return [flag["type"] for flag in result["risk_flags"]]


def test_dormancy_flags_required_weekly_minimum_with_zero_logged_time() -> None:
    payload = base_payload()
    payload["projects"][0]["weekly_min_minutes"] = 120

    result = analyze_week(payload)

    assert result["risk_flags"] == [
        {
            "type": "dormancy_risk",
            "severity": "medium",
            "evidence": "Maintenance project had a 2.0h weekly minimum but logged 0 minutes.",
        }
    ]
    assert result["evidence"]["dormancy"]["projects"][0]["missed_weekly_minimum"] is True


def test_dormancy_distinguishes_medium_and_high_inactivity_thresholds() -> None:
    medium_payload = base_payload()
    medium_payload["projects"][0]["last_activity_date"] = "2026-05-31"
    high_payload = base_payload()
    high_payload["projects"][0]["last_activity_date"] = "2026-05-24"

    medium = analyze_week(medium_payload)
    high = analyze_week(high_payload)

    assert medium["risk_flags"] == [
        {
            "type": "dormancy_risk",
            "severity": "medium",
            "evidence": (
                "Maintenance project has been inactive for 14 days, "
                "crossing the 14-day dormancy threshold."
            ),
        }
    ]
    assert medium["evidence"]["dormancy"]["projects"][0]["risk_level"] == "medium"

    assert high["risk_flags"] == [
        {
            "type": "dormancy_risk",
            "severity": "high",
            "evidence": (
                "Maintenance project has been inactive for 21 days, "
                "crossing the 21-day wake-up threshold."
            ),
        }
    ]
    assert high["evidence"]["dormancy"]["projects"][0]["risk_level"] == "high"


def test_slack_risk_uses_capacity_and_target_percent() -> None:
    payload = base_payload()
    payload["weekly_plan"]["planned_capacity_minutes"] = 600
    payload["weekly_plan"]["slack_target_percent"] = 20
    payload["weekly_plan"]["items"] = [
        {
            "project_id": 1,
            "title": "Overfilled maintenance plan",
            "planned_minutes": 540,
            "priority": 1,
        }
    ]

    result = analyze_week(payload)

    assert risk_evidence(result, "leaving 1.0h slack") == (
        "Planned 9.0h against 10.0h capacity, leaving 1.0h slack below the "
        "2.0h target (20%)."
    )
    assert result["evidence"]["plan"]["required_slack_minutes"] == 120
    assert result["evidence"]["plan"]["planned_slack_minutes"] == 60
    assert result["evidence"]["plan"]["slack_status"] == "tight"


def test_dormancy_and_slack_edge_cases_do_not_create_false_risks() -> None:
    payload = base_payload()
    payload["projects"] = [
        {
            **payload["projects"][0],
            "id": 1,
            "title": "Intentionally paused project",
            "stage": "dormant",
            "weekly_min_minutes": 120,
            "last_activity_date": "2026-01-01",
        },
        {
            **payload["projects"][0],
            "id": 2,
            "title": "Missing date project",
            "last_activity_date": None,
        },
    ]

    result = analyze_week(payload)

    assert result["risk_flags"] == []
    assert result["evidence"]["plan"]["slack_status"] == "unknown"
    assert result["evidence"]["dormancy"]["projects"] == [
        {
            "project_id": 2,
            "project_title": "Missing date project",
            "stage": "stable",
            "weekly_min_minutes": 0,
            "actual_minutes": 0,
            "last_activity_date": None,
            "inactive_days": None,
            "risk_level": "unknown",
            "missed_weekly_minimum": False,
        }
    ]


def test_sample_week_keeps_high_dormancy_evidence_visible() -> None:
    result = analyze_week(deepcopy(load_sample_payload()))

    assert risk_evidence(result, "Resume and applications has been inactive") == (
        "Resume and applications has been inactive for 30 days, "
        "crossing the 21-day wake-up threshold."
    )
    resume = next(
        project
        for project in result["evidence"]["dormancy"]["projects"]
        if project["project_title"] == "Resume and applications"
    )
    assert resume["risk_level"] == "high"
    assert resume["missed_weekly_minimum"] is True
    assert "slack_risk" not in risk_types(result)
