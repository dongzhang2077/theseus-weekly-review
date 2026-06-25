from __future__ import annotations

from review_engine.baseline import evaluate_project_health, evaluate_projects_health
from review_engine.rules import analyze_week
from tests.support import load_sample_payload


def project(stage: str = "startup", **overrides: object) -> dict:
    values = {
        "id": 1,
        "title": "Review engine",
        "stage": stage,
        "status": "active",
        "weekly_min_minutes": 0,
        "weekly_target_minutes": 0,
    }
    values.update(overrides)
    return values


def test_stage_health_distinguishes_core_statuses() -> None:
    assert evaluate_project_health(project("startup"), 360).status == "healthy"
    assert evaluate_project_health(project("stable"), 45).status == "maintenance"
    assert evaluate_project_health(project("stable"), 0).status == "drift"
    assert evaluate_project_health(project("sprint"), 900).status == "overheated"
    assert evaluate_project_health(project("dormant"), 0).status == "dormant"
    assert evaluate_project_health(project("wake_up"), 0, inactive_days=30).status == "wake_up_risk"


def test_stage_health_uses_project_target_overrides() -> None:
    health = evaluate_project_health(
        project("startup", weekly_min_minutes=180, weekly_target_minutes=480),
        actual_minutes=240,
    )

    assert health.status == "maintenance"
    assert health.min_minutes == 180
    assert health.target_minutes == 480
    assert health.max_minutes == 720


def test_evaluate_projects_health_returns_stable_rows() -> None:
    rows = evaluate_projects_health(
        [
            project("stable", id=2, title="Stable ops"),
            project("wake_up", id=1, title="Restart"),
        ],
        actual_by_project={2: 60},
        inactive_days_by_project={1: 24, 2: 2},
    )

    assert rows == [
        {
            "project_id": 1,
            "project_title": "Restart",
            "stage": "wake_up",
            "status": "wake_up_risk",
            "actual_minutes": 0,
            "min_minutes": 30,
            "target_minutes": 90,
            "max_minutes": 180,
            "inactive_days": 24,
            "reason": "Wake-up project needs a visible restart block.",
        },
        {
            "project_id": 2,
            "project_title": "Stable ops",
            "stage": "stable",
            "status": "maintenance",
            "actual_minutes": 60,
            "min_minutes": 30,
            "target_minutes": 120,
            "max_minutes": 240,
            "inactive_days": 2,
            "reason": "Logged time covered the minimum but stayed below target.",
        },
    ]


def test_analyze_week_exposes_stage_health_evidence() -> None:
    result = analyze_week(load_sample_payload())

    stage_health = result["evidence"]["stage_health"]["projects"]
    assert [row["status"] for row in stage_health] == [
        "maintenance",
        "drift",
        "wake_up_risk",
    ]
    assert stage_health[0]["project_title"] == "Theseus backend"
    assert stage_health[0]["target_minutes"] == 480
    assert stage_health[2]["inactive_days"] == 30
