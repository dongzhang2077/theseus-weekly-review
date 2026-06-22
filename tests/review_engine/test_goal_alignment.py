from __future__ import annotations

from review_engine.rules import analyze_week
from tests.support import load_sample_payload


def test_goal_alignment_orders_findings_by_goal_priority() -> None:
    result = analyze_week(load_sample_payload())

    assert result["insights"][0]["title"] == "Build Theseus MVP received attention"
    assert result["risk_flags"][0] == {
        "type": "alignment_gap",
        "severity": "medium",
        "evidence": (
            "Priority 2 goal Internship preparation received 0 goal-linked minutes "
            "across Resume and applications."
        ),
    }


def test_goal_alignment_finding_evidence_names_linked_project_minutes() -> None:
    result = analyze_week(load_sample_payload())

    assert result["insights"][0]["evidence"] == (
        "Priority 1 goal received 5.0h across "
        "Theseus backend (4.0h), Theseus frontend (1.0h)."
    )


def test_goal_alignment_evidence_exposes_project_breakdown() -> None:
    result = analyze_week(load_sample_payload())
    mvp_goal = result["evidence"]["goals"][0]

    assert mvp_goal["title"] == "Build Theseus MVP"
    assert mvp_goal["actual_minutes"] == 300
    assert mvp_goal["project_breakdown"] == [
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
    ]
