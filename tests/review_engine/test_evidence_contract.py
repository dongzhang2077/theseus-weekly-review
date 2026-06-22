from __future__ import annotations

import pytest

from review_engine.rules import EVIDENCE_SCHEMA_VERSION, analyze_week
from tests.support import load_sample_payload


@pytest.fixture
def evidence() -> dict:
    return analyze_week(load_sample_payload())["evidence"]


def test_evidence_contract_exposes_stable_summary_sections(evidence: dict) -> None:
    assert evidence["schema_version"] == EVIDENCE_SCHEMA_VERSION
    assert {
        "summary",
        "goals",
        "projects",
        "plan",
        "activity",
        "reflections",
    }.issubset(evidence)

    assert evidence["summary"] == {
        "planned_total_minutes": 660,
        "actual_total_minutes": 450,
        "goal_count": 2,
        "project_count": 3,
        "time_log_count": 5,
        "reflection_count": 1,
    }
    assert evidence["plan"]["planned_capacity_minutes"] == 1800
    assert evidence["plan"]["planned_slack_minutes"] == 1140
    assert evidence["plan"]["item_count"] == 3


def test_evidence_contract_tracks_goal_and_project_context(evidence: dict) -> None:
    assert evidence["goals"] == [
        {
            "id": 1,
            "title": "Build Theseus MVP",
            "priority": 1,
            "active_status": True,
            "actual_minutes": 300,
            "project_ids": [1, 2],
            "active_project_count": 2,
            "project_breakdown": [
                {
                    "id": 1,
                    "title": "Theseus backend",
                    "status": "active",
                    "stage": "startup",
                    "actual_minutes": 240,
                },
                {
                    "id": 2,
                    "title": "Theseus frontend",
                    "status": "active",
                    "stage": "startup",
                    "actual_minutes": 60,
                },
            ],
        },
        {
            "id": 2,
            "title": "Internship preparation",
            "priority": 2,
            "active_status": True,
            "actual_minutes": 0,
            "project_ids": [3],
            "active_project_count": 1,
            "project_breakdown": [
                {
                    "id": 3,
                    "title": "Resume and applications",
                    "status": "active",
                    "stage": "stable",
                    "actual_minutes": 0,
                }
            ],
        },
    ]

    resume_project = next(
        project for project in evidence["projects"] if project["title"] == "Resume and applications"
    )
    assert resume_project["goal_title"] == "Internship preparation"
    assert resume_project["planned_minutes"] == 120
    assert resume_project["actual_minutes"] == 0
    assert resume_project["difference_minutes"] == -120
    assert resume_project["difference_ratio"] == 1
    assert resume_project["inactive_days"] == 30


def test_evidence_contract_keeps_activity_and_legacy_fields(evidence: dict) -> None:
    assert evidence["activity"] == {
        "mix": {
            "consuming": 300,
            "neutral": 0,
            "restore": 60,
            "destroy": 90,
        },
        "total_minutes": 450,
        "unlinked_minutes": 150,
    }
    assert evidence["reflections"] == {
        "count": 1,
        "small_win_count": 1,
        "mood_note_count": 0,
        "free_note_count": 1,
    }

    assert evidence["actual_total_minutes"] == 450
    assert evidence["planned_total_minutes"] == 660
    assert evidence["activity_mix"] == {"consuming": 300, "restore": 60, "destroy": 90}
    assert evidence["actual_by_goal"] == {"Build Theseus MVP": 300}
