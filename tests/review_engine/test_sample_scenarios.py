from __future__ import annotations

import json
from pathlib import Path

from review_engine.rules import analyze_week


ROOT = Path(__file__).resolve().parents[2]
SCENARIOS = ROOT / "data" / "sample" / "scenarios"


def load_scenario(name: str) -> dict:
    return json.loads((SCENARIOS / name).read_text(encoding="utf-8"))


def risk_types(result: dict) -> set[str]:
    return {flag["type"] for flag in result["risk_flags"]}


def insight_titles(result: dict) -> list[str]:
    return [insight["title"] for insight in result["insights"]]


def test_aligned_restore_scenario_counts_activity_mix_and_supportive_recovery() -> None:
    result = analyze_week(load_scenario("aligned_restore_week.json"))

    assert result["evidence"]["activity_mix"] == {
        "consuming": 300,
        "neutral": 0,
        "restore": 180,
        "destroy": 0,
    }
    assert "Build Theseus MVP received attention" in insight_titles(result)
    assert "Review engine roughly matched the plan" in insight_titles(result)
    assert "Recovery meaningfully supported the week" in insight_titles(result)
    assert "destroy_pattern" not in risk_types(result)


def test_overloaded_drift_scenario_exercises_risks_without_blame_language() -> None:
    result = analyze_week(load_scenario("overloaded_drift_week.json"))

    assert result["evidence"]["activity_mix"] == {
        "consuming": 60,
        "neutral": 0,
        "restore": 0,
        "destroy": 240,
    }
    assert {
        "alignment_gap",
        "plan_drift",
        "dormancy_risk",
        "slack_risk",
        "destroy_pattern",
    }.issubset(risk_types(result))
    assert result["evidence"]["summary"]["planned_total_minutes"] == 960
    assert result["evidence"]["plan"]["planned_slack_minutes"] == 0
    assert result["evidence"]["plan"]["slack_status"] == "tight"
    rendered = result["generated_text"].lower()
    assert "lazy" not in rendered
    assert "failing" not in rendered
    assert len(result["next_steps"]) <= 3
