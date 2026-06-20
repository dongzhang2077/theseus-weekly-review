from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from typing import Any


ACTIVITY_TYPES = ("consuming", "neutral", "restore", "destroy")
DESTROY_RISK_MINUTES = 120
DESTROY_RISK_RATIO = 0.25
RESTORE_SUPPORT_RATIO = 0.25


def analyze_week(payload: dict[str, Any]) -> dict[str, Any]:
    goals = payload.get("goals", [])
    projects = payload.get("projects", [])
    weekly_plan = payload.get("weekly_plan", {})
    time_logs = payload.get("time_logs", [])
    reflections = payload.get("daily_reflections", [])

    goals_by_id = {goal["id"]: goal for goal in goals}
    projects_by_id = {project["id"]: project for project in projects}

    planned_by_project = _planned_minutes_by_project(weekly_plan.get("items", []))
    actual_by_project = _actual_minutes_by_project(time_logs)
    actual_by_goal = _actual_minutes_by_goal(projects_by_id, time_logs)
    activity_mix = _activity_mix(time_logs)

    evidence = {
        "planned_by_project": _label_project_minutes(projects_by_id, planned_by_project),
        "actual_by_project": _label_project_minutes(projects_by_id, actual_by_project),
        "actual_by_goal": _label_goal_minutes(goals_by_id, actual_by_goal),
        "activity_mix": activity_mix,
        "planned_total_minutes": sum(planned_by_project.values()),
        "actual_total_minutes": sum(log.get("duration_minutes", 0) for log in time_logs),
        "reflection_count": len(reflections),
    }

    wins = _detect_wins(projects_by_id, actual_by_project, activity_mix, reflections)
    insights = []
    risk_flags = []
    next_steps = []

    alignment = _check_goal_alignment(goals, actual_by_goal)
    insights.extend(alignment["insights"])
    risk_flags.extend(alignment["risk_flags"])

    plan_gap = _check_plan_gap(projects_by_id, planned_by_project, actual_by_project)
    insights.extend(plan_gap["insights"])
    risk_flags.extend(plan_gap["risk_flags"])

    energy = _check_activity_mix(activity_mix)
    insights.extend(energy["insights"])
    risk_flags.extend(energy["risk_flags"])

    dormancy = _check_dormancy(projects, actual_by_project, weekly_plan.get("week_end"))
    risk_flags.extend(dormancy["risk_flags"])

    slack = _check_slack(weekly_plan)
    risk_flags.extend(slack["risk_flags"])

    next_steps.extend(_build_next_steps(risk_flags, projects_by_id))

    return {
        "week_start": weekly_plan.get("week_start"),
        "week_end": weekly_plan.get("week_end"),
        "wins": wins[:3],
        "insights": insights[:5],
        "risk_flags": risk_flags[:8],
        "next_steps": next_steps[:3],
        "evidence": evidence,
        "generated_text": _render_review_text(wins, insights, risk_flags, next_steps),
    }


def _planned_minutes_by_project(items: list[dict[str, Any]]) -> dict[int, int]:
    totals: dict[int, int] = defaultdict(int)
    for item in items:
        project_id = item.get("project_id")
        if project_id is not None:
            totals[int(project_id)] += int(item.get("planned_minutes", 0))
    return dict(totals)


def _actual_minutes_by_project(time_logs: list[dict[str, Any]]) -> dict[int, int]:
    totals: dict[int, int] = defaultdict(int)
    for log in time_logs:
        project_id = log.get("project_id")
        if project_id is not None:
            totals[int(project_id)] += int(log.get("duration_minutes", 0))
    return dict(totals)


def _actual_minutes_by_goal(
    projects_by_id: dict[int, dict[str, Any]], time_logs: list[dict[str, Any]]
) -> dict[int, int]:
    totals: dict[int, int] = defaultdict(int)
    for log in time_logs:
        project = projects_by_id.get(log.get("project_id"))
        if project and project.get("goal_id") is not None:
            totals[int(project["goal_id"])] += int(log.get("duration_minutes", 0))
    return dict(totals)


def _activity_mix(time_logs: list[dict[str, Any]]) -> dict[str, int]:
    totals: dict[str, int] = {activity_type: 0 for activity_type in ACTIVITY_TYPES}
    for log in time_logs:
        activity_type = log.get("activity_type", "neutral")
        if activity_type not in totals:
            activity_type = "neutral"
        totals[activity_type] += int(log.get("duration_minutes", 0))
    return dict(totals)


def _detect_wins(
    projects_by_id: dict[int, dict[str, Any]],
    actual_by_project: dict[int, int],
    activity_mix: dict[str, int],
    reflections: list[dict[str, Any]],
) -> list[dict[str, str]]:
    wins = []
    if actual_by_project:
        top_project_id, top_minutes = max(actual_by_project.items(), key=lambda item: item[1])
        top_project = projects_by_id.get(top_project_id, {"title": "Unlinked project"})
        wins.append(
            {
                "title": f"Progress on {top_project['title']}",
                "evidence": f"{top_project['title']} received {top_minutes / 60:.1f} hours.",
            }
        )
    if activity_mix.get("restore", 0) > 0:
        wins.append(
            {
                "title": "Recovery work was visible",
                "evidence": f"Restore activities received {activity_mix['restore'] / 60:.1f} hours.",
            }
        )
    small_wins = [item.get("small_win") for item in reflections if item.get("small_win")]
    if small_wins:
        wins.append({"title": "Daily reflection captured a small win", "evidence": small_wins[0]})
    if not wins:
        wins.append(
            {
                "title": "Weekly evidence was collected",
                "evidence": "The week has enough structured data to review.",
            }
        )
    return wins


def _check_goal_alignment(goals: list[dict[str, Any]], actual_by_goal: dict[int, int]) -> dict[str, list[dict[str, str]]]:
    insights = []
    risk_flags = []
    active_goals = [goal for goal in goals if goal.get("active_status", True)]
    for goal in sorted(active_goals, key=lambda item: item.get("priority", 99)):
        minutes = actual_by_goal.get(goal["id"], 0)
        if minutes > 0:
            insights.append(
                {
                    "title": f"{goal['title']} received attention",
                    "evidence": f"Actual goal-linked time was {minutes / 60:.1f} hours.",
                }
            )
        else:
            risk_flags.append(
                {
                    "type": "alignment_gap",
                    "severity": "medium",
                    "evidence": f"{goal['title']} received 0 goal-linked minutes.",
                }
            )
    return {"insights": insights, "risk_flags": risk_flags}


def _check_plan_gap(
    projects_by_id: dict[int, dict[str, Any]],
    planned_by_project: dict[int, int],
    actual_by_project: dict[int, int],
) -> dict[str, list[dict[str, str]]]:
    insights = []
    risk_flags = []
    for project_id, planned_minutes in planned_by_project.items():
        actual_minutes = actual_by_project.get(project_id, 0)
        if planned_minutes < 60:
            continue
        project = projects_by_id.get(project_id, {"title": f"Project {project_id}"})
        diff = actual_minutes - planned_minutes
        diff_ratio = abs(diff) / planned_minutes
        if diff_ratio >= 0.5:
            risk_flags.append(
                {
                    "type": "plan_drift",
                    "severity": "medium",
                    "evidence": (
                        f"{project['title']} planned {planned_minutes / 60:.1f}h "
                        f"and logged {actual_minutes / 60:.1f}h."
                    ),
                }
            )
        else:
            insights.append(
                {
                    "title": f"{project['title']} roughly matched the plan",
                    "evidence": (
                        f"Planned {planned_minutes / 60:.1f}h and logged {actual_minutes / 60:.1f}h."
                    ),
                }
            )
    return {"insights": insights, "risk_flags": risk_flags}


def _check_activity_mix(activity_mix: dict[str, int]) -> dict[str, list[dict[str, str]]]:
    insights = []
    risk_flags = []
    consuming = activity_mix.get("consuming", 0)
    neutral = activity_mix.get("neutral", 0)
    restore = activity_mix.get("restore", 0)
    destroy = activity_mix.get("destroy", 0)
    total = consuming + neutral + restore + destroy

    if consuming > 0:
        insights.append(
            {
                "title": "Consuming work was measurable",
                "evidence": (
                    f"Activity mix: consuming {consuming / 60:.1f}h, "
                    f"neutral {neutral / 60:.1f}h, restore {restore / 60:.1f}h, "
                    f"destroy {destroy / 60:.1f}h."
                ),
            }
        )
    if restore > 0:
        title = "Recovery can be counted as support work"
        if consuming > 0 and restore / consuming >= RESTORE_SUPPORT_RATIO:
            title = "Recovery meaningfully supported the week"
        insights.append(
            {
                "title": title,
                "evidence": f"Restore activities received {restore / 60:.1f} hours.",
            }
        )
    destroy_ratio = destroy / total if total > 0 else 0
    if destroy >= DESTROY_RISK_MINUTES and destroy_ratio >= DESTROY_RISK_RATIO:
        risk_flags.append(
            {
                "type": "destroy_pattern",
                "severity": "medium",
                "evidence": (
                    f"Destroy-labeled activities reached {destroy / 60:.1f}h "
                    f"of {total / 60:.1f}h logged time."
                ),
            }
        )
    if consuming > 0 and restore / consuming < 0.2:
        risk_flags.append(
            {
                "type": "slack_risk",
                "severity": "medium",
                "evidence": "Restore time was below 20% of consuming time.",
            }
        )
    return {"insights": insights, "risk_flags": risk_flags}


def _check_dormancy(
    projects: list[dict[str, Any]], actual_by_project: dict[int, int], week_end: str | None
) -> dict[str, list[dict[str, str]]]:
    risk_flags = []
    for project in projects:
        if project.get("status") != "active" or project.get("stage") == "dormant":
            continue
        actual_minutes = actual_by_project.get(project["id"], 0)
        if project.get("weekly_min_minutes", 0) > 0 and actual_minutes == 0:
            risk_flags.append(
                {
                    "type": "dormancy_risk",
                    "severity": "medium",
                    "evidence": f"{project['title']} had a weekly minimum but logged 0 minutes.",
                }
            )
        inactive_days = _days_since(project.get("last_activity_date"), week_end)
        if inactive_days is not None and inactive_days >= 21:
            risk_flags.append(
                {
                    "type": "dormancy_risk",
                    "severity": "high",
                    "evidence": f"{project['title']} has been inactive for {inactive_days} days.",
                }
            )
    return {"risk_flags": risk_flags}


def _check_slack(weekly_plan: dict[str, Any]) -> dict[str, list[dict[str, str]]]:
    capacity = int(weekly_plan.get("planned_capacity_minutes", 0))
    if capacity <= 0:
        return {"risk_flags": []}
    planned_total = sum(int(item.get("planned_minutes", 0)) for item in weekly_plan.get("items", []))
    slack_target = int(weekly_plan.get("slack_target_percent", 20)) / 100
    max_planned = capacity * (1 - slack_target)
    if planned_total > max_planned:
        return {
            "risk_flags": [
                {
                    "type": "slack_risk",
                    "severity": "medium",
                    "evidence": (
                        f"Planned {planned_total / 60:.1f}h against {capacity / 60:.1f}h capacity, "
                        f"leaving less than {slack_target:.0%} slack."
                    ),
                }
            ]
        }
    return {"risk_flags": []}


def _build_next_steps(
    risk_flags: list[dict[str, str]], projects_by_id: dict[int, dict[str, Any]]
) -> list[dict[str, str]]:
    steps = []
    risk_types = {flag.get("type") for flag in risk_flags}
    if "alignment_gap" in risk_types or "dormancy_risk" in risk_types:
        steps.append(
            {
                "title": "Protect one small restart block",
                "reason": "A dormant or under-supported goal should restart with a small block, not a large task dump.",
            }
        )
    if "plan_drift" in risk_types:
        steps.append(
            {
                "title": "Reduce next week's plan by one lower-priority item",
                "reason": "Plan drift suggests the week needs a more realistic load.",
            }
        )
    if "slack_risk" in risk_types:
        steps.append(
            {
                "title": "Keep a visible buffer before adding more work",
                "reason": "Slack protects recovery and unexpected tasks.",
            }
        )
    if "destroy_pattern" in risk_types:
        steps.append(
            {
                "title": "Set one boundary around the largest draining activity",
                "reason": "The goal is awareness and containment, not self-blame.",
            }
        )
    if not steps:
        steps.append(
            {
                "title": "Repeat the strongest working pattern next week",
                "reason": "The evidence does not require a major change.",
            }
        )
    return steps


def _render_review_text(
    wins: list[dict[str, str]],
    insights: list[dict[str, str]],
    risk_flags: list[dict[str, str]],
    next_steps: list[dict[str, str]],
) -> str:
    first_win = wins[0]["title"] if wins else "The week has reviewable evidence."
    first_insight = insights[0]["title"] if insights else "The week needs more data before strong conclusions."
    first_step = next_steps[0]["title"] if next_steps else "Keep the next week realistic."
    risk_note = "No major risk was detected." if not risk_flags else f"{len(risk_flags)} risk signal(s) need attention."
    return f"Win: {first_win}\nInsight: {first_insight}\nRisk: {risk_note}\nNext step: {first_step}"


def _label_project_minutes(projects_by_id: dict[int, dict[str, Any]], minutes_by_project: dict[int, int]) -> dict[str, int]:
    labeled = {}
    for project_id, minutes in minutes_by_project.items():
        project = projects_by_id.get(project_id)
        key = project["title"] if project else f"Project {project_id}"
        labeled[key] = minutes
    return labeled


def _label_goal_minutes(goals_by_id: dict[int, dict[str, Any]], minutes_by_goal: dict[int, int]) -> dict[str, int]:
    labeled = {}
    for goal_id, minutes in minutes_by_goal.items():
        goal = goals_by_id.get(goal_id)
        key = goal["title"] if goal else f"Goal {goal_id}"
        labeled[key] = minutes
    return labeled


def _days_since(
    start_date: str | date | datetime | None,
    end_date: str | date | datetime | None,
) -> int | None:
    if not start_date or not end_date:
        return None
    start = _coerce_date(start_date)
    end = _coerce_date(end_date)
    if start is None or end is None:
        return None
    return (end - start).days


def _coerce_date(value: str | date | datetime) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None
