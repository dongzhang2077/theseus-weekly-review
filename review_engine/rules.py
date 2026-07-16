from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from typing import Any

from review_engine.baseline import evaluate_projects_health


ACTIVITY_TYPES = ("consuming", "neutral", "restore", "destroy")
EVIDENCE_SCHEMA_VERSION = "sprint2.review_evidence.v1"
PLAN_DRIFT_MIN_RATIO = 0.5
PLAN_DRIFT_MIN_MINUTES = 60
PLAN_MIN_REVIEW_MINUTES = 60
DORMANCY_MEDIUM_DAYS = 14
DORMANCY_HIGH_DAYS = 21
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

    evidence = _build_evidence(
        goals=goals,
        projects=projects,
        goals_by_id=goals_by_id,
        projects_by_id=projects_by_id,
        weekly_plan=weekly_plan,
        time_logs=time_logs,
        reflections=reflections,
        planned_by_project=planned_by_project,
        actual_by_project=actual_by_project,
        actual_by_goal=actual_by_goal,
        activity_mix=activity_mix,
    )

    wins = _detect_wins(projects_by_id, actual_by_project, activity_mix, reflections)
    insights = []
    risk_flags = []
    next_steps = []

    alignment = _check_goal_alignment(goals, projects, actual_by_goal, actual_by_project)
    insights.extend(alignment["insights"])
    risk_flags.extend(alignment["risk_flags"])

    plan_gap = _check_plan_gap(projects_by_id, planned_by_project, actual_by_project)
    insights.extend(plan_gap["insights"])
    risk_flags.extend(plan_gap["risk_flags"])

    energy = _check_activity_mix(activity_mix)
    insights.extend(energy["insights"])
    risk_flags.extend(energy["risk_flags"])

    dormancy = _check_dormancy(
        projects,
        actual_by_project,
        _last_log_dates_by_project(time_logs),
        weekly_plan.get("week_end"),
    )
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


def _build_evidence(
    *,
    goals: list[dict[str, Any]],
    projects: list[dict[str, Any]],
    goals_by_id: dict[int, dict[str, Any]],
    projects_by_id: dict[int, dict[str, Any]],
    weekly_plan: dict[str, Any],
    time_logs: list[dict[str, Any]],
    reflections: list[dict[str, Any]],
    planned_by_project: dict[int, int],
    actual_by_project: dict[int, int],
    actual_by_goal: dict[int, int],
    activity_mix: dict[str, int],
) -> dict[str, Any]:
    planned_total = sum(
        int(item.get("planned_minutes", 0))
        for item in weekly_plan.get("items", [])
    )
    actual_total = sum(int(log.get("duration_minutes", 0)) for log in time_logs)
    capacity = int(weekly_plan.get("planned_capacity_minutes", 0))
    slack_minutes = capacity - planned_total if capacity > 0 else None
    slack_percent = (slack_minutes / capacity) if capacity > 0 and slack_minutes is not None else None
    slack_target_percent = int(weekly_plan.get("slack_target_percent", 20))
    required_slack_minutes = round(capacity * (slack_target_percent / 100)) if capacity > 0 else None
    last_log_dates_by_project = _last_log_dates_by_project(time_logs)
    inactive_days_by_project = _inactive_days_by_project(
        projects,
        last_log_dates_by_project,
        weekly_plan.get("week_end"),
    )

    evidence = {
        "schema_version": EVIDENCE_SCHEMA_VERSION,
        "summary": {
            "planned_total_minutes": planned_total,
            "actual_total_minutes": actual_total,
            "goal_count": len(goals),
            "project_count": len(projects),
            "time_log_count": len(time_logs),
            "reflection_count": len(reflections),
        },
        "goals": _goal_evidence(goals, projects, actual_by_goal, actual_by_project),
        "projects": _project_evidence(
            projects,
            goals_by_id,
            planned_by_project,
            actual_by_project,
            last_log_dates_by_project,
            weekly_plan.get("week_end"),
        ),
        "plan": {
            "week_start": weekly_plan.get("week_start"),
            "week_end": weekly_plan.get("week_end"),
            "planned_capacity_minutes": capacity,
            "slack_target_percent": slack_target_percent,
            "planned_total_minutes": planned_total,
            "planned_slack_minutes": slack_minutes,
            "planned_slack_percent": slack_percent,
            "required_slack_minutes": required_slack_minutes,
            "slack_status": _slack_status(capacity, planned_total, slack_target_percent),
            "item_count": len(weekly_plan.get("items", [])),
            "project_drift": _plan_project_drift(projects_by_id, planned_by_project, actual_by_project),
            "unplanned_project_minutes": _unplanned_project_minutes(
                planned_by_project, actual_by_project
            ),
            "unplanned_projects": _unplanned_projects(
                projects_by_id, planned_by_project, actual_by_project
            ),
        },
        "activity": {
            "mix": _complete_activity_mix(activity_mix),
            "total_minutes": actual_total,
            "unlinked_minutes": _unlinked_minutes(time_logs),
        },
        "reflections": {
            "count": len(reflections),
            "small_win_count": sum(1 for item in reflections if item.get("small_win")),
            "mood_note_count": sum(1 for item in reflections if item.get("mood_note")),
            "free_note_count": sum(1 for item in reflections if item.get("free_note")),
        },
        "dormancy": {
            "projects": _dormancy_evidence(
                projects,
                actual_by_project,
                last_log_dates_by_project,
                weekly_plan.get("week_end"),
            )
        },
        "stage_health": {
            "projects": evaluate_projects_health(
                projects,
                actual_by_project,
                inactive_days_by_project,
            )
        },
    }

    # Sprint 1 compatibility keys remain available while Sprint 2 consumers move to
    # the structured sections above.
    evidence.update(
        {
            "planned_by_project": _label_project_minutes(projects_by_id, planned_by_project),
            "actual_by_project": _label_project_minutes(projects_by_id, actual_by_project),
            "actual_by_goal": _label_goal_minutes(goals_by_id, actual_by_goal),
            "activity_mix": activity_mix,
            "planned_total_minutes": planned_total,
            "actual_total_minutes": actual_total,
            "reflection_count": len(reflections),
        }
    )
    return evidence


def _goal_evidence(
    goals: list[dict[str, Any]],
    projects: list[dict[str, Any]],
    actual_by_goal: dict[int, int],
    actual_by_project: dict[int, int],
) -> list[dict[str, Any]]:
    projects_by_goal: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for project in projects:
        goal_id = project.get("goal_id")
        if goal_id is not None:
            projects_by_goal[int(goal_id)].append(project)

    goal_rows = []
    for goal in sorted(goals, key=lambda item: (item.get("priority", 99), item.get("id", 0))):
        goal_id = int(goal["id"])
        project_breakdown = _goal_project_breakdown(
            projects_by_goal.get(goal_id, []), actual_by_project
        )
        goal_rows.append(
            {
                "id": goal_id,
                "title": goal["title"],
                "priority": goal.get("priority", 99),
                "active_status": bool(goal.get("active_status", True)),
                "actual_minutes": actual_by_goal.get(goal_id, 0),
                "project_ids": [project["id"] for project in project_breakdown],
                "active_project_count": sum(
                    1 for project in projects_by_goal.get(goal_id, []) if project.get("status") == "active"
                ),
                "project_breakdown": project_breakdown,
            }
        )
    return goal_rows


def _goal_project_breakdown(
    projects: list[dict[str, Any]], actual_by_project: dict[int, int]
) -> list[dict[str, Any]]:
    breakdown = []
    for project in sorted(projects, key=lambda item: item.get("id", 0)):
        project_id = int(project["id"])
        breakdown.append(
            {
                "id": project_id,
                "title": project["title"],
                "status": project.get("status"),
                "stage": project.get("stage"),
                "actual_minutes": actual_by_project.get(project_id, 0),
            }
        )
    return breakdown


def _project_evidence(
    projects: list[dict[str, Any]],
    goals_by_id: dict[int, dict[str, Any]],
    planned_by_project: dict[int, int],
    actual_by_project: dict[int, int],
    last_log_dates_by_project: dict[int, date],
    week_end: str | date | datetime | None,
) -> list[dict[str, Any]]:
    project_rows = []
    for project in sorted(projects, key=lambda item: item.get("id", 0)):
        project_id = int(project["id"])
        goal_id = project.get("goal_id")
        goal = goals_by_id.get(goal_id) if goal_id is not None else None
        planned_minutes = planned_by_project.get(project_id, 0)
        actual_minutes = actual_by_project.get(project_id, 0)
        difference_minutes = actual_minutes - planned_minutes
        last_activity_date = _effective_last_activity_date(
            project.get("last_activity_date"),
            last_log_dates_by_project.get(project_id),
        )
        plan_status = _plan_status(planned_minutes, actual_minutes)
        project_rows.append(
            {
                "id": project_id,
                "title": project["title"],
                "goal_id": goal_id,
                "goal_title": goal["title"] if goal else None,
                "stage": project.get("stage"),
                "status": project.get("status"),
                "weekly_min_minutes": int(project.get("weekly_min_minutes", 0)),
                "weekly_target_minutes": int(project.get("weekly_target_minutes", 0)),
                "planned_minutes": planned_minutes,
                "actual_minutes": actual_minutes,
                "difference_minutes": difference_minutes,
                "difference_ratio": (
                    abs(difference_minutes) / planned_minutes if planned_minutes > 0 else None
                ),
                "plan_status": plan_status,
                "last_activity_date": last_activity_date,
                "inactive_days": _days_since(last_activity_date, week_end),
            }
        )
    return project_rows


def _plan_project_drift(
    projects_by_id: dict[int, dict[str, Any]],
    planned_by_project: dict[int, int],
    actual_by_project: dict[int, int],
) -> list[dict[str, Any]]:
    rows = []
    for project_id in sorted(set(planned_by_project) | set(actual_by_project)):
        planned_minutes = planned_by_project.get(project_id, 0)
        actual_minutes = actual_by_project.get(project_id, 0)
        difference_minutes = actual_minutes - planned_minutes
        project = projects_by_id.get(project_id, {"title": f"Project {project_id}"})
        rows.append(
            {
                "project_id": project_id,
                "project_title": project["title"],
                "planned_minutes": planned_minutes,
                "actual_minutes": actual_minutes,
                "difference_minutes": difference_minutes,
                "difference_ratio": (
                    abs(difference_minutes) / planned_minutes if planned_minutes > 0 else None
                ),
                "status": _plan_status(planned_minutes, actual_minutes),
            }
        )
    return rows


def _unplanned_project_minutes(
    planned_by_project: dict[int, int],
    actual_by_project: dict[int, int],
) -> int:
    return sum(
        minutes
        for project_id, minutes in actual_by_project.items()
        if minutes > 0 and planned_by_project.get(project_id, 0) == 0
    )


def _unplanned_projects(
    projects_by_id: dict[int, dict[str, Any]],
    planned_by_project: dict[int, int],
    actual_by_project: dict[int, int],
) -> list[dict[str, Any]]:
    rows = []
    for project_id, actual_minutes in sorted(actual_by_project.items()):
        if actual_minutes <= 0 or planned_by_project.get(project_id, 0) > 0:
            continue
        project = projects_by_id.get(project_id, {"title": f"Project {project_id}"})
        rows.append(
            {
                "project_id": project_id,
                "project_title": project["title"],
                "actual_minutes": actual_minutes,
            }
        )
    return rows


def _plan_status(planned_minutes: int, actual_minutes: int) -> str:
    if planned_minutes <= 0 and actual_minutes > 0:
        return "unplanned"
    if planned_minutes <= 0:
        return "not_planned"
    difference_minutes = actual_minutes - planned_minutes
    if _is_major_plan_drift(planned_minutes, actual_minutes):
        return "over_plan" if difference_minutes > 0 else "under_plan"
    return "on_track"


def _is_major_plan_drift(planned_minutes: int, actual_minutes: int) -> bool:
    if planned_minutes <= 0:
        return actual_minutes >= PLAN_DRIFT_MIN_MINUTES
    difference_minutes = abs(actual_minutes - planned_minutes)
    return (
        planned_minutes >= PLAN_MIN_REVIEW_MINUTES
        and difference_minutes >= PLAN_DRIFT_MIN_MINUTES
        and difference_minutes / planned_minutes >= PLAN_DRIFT_MIN_RATIO
    )


def _slack_status(
    capacity_minutes: int,
    planned_total_minutes: int,
    slack_target_percent: int,
) -> str:
    if capacity_minutes <= 0:
        return "unknown"
    required_slack = capacity_minutes * (slack_target_percent / 100)
    planned_slack = capacity_minutes - planned_total_minutes
    return "tight" if planned_slack < required_slack else "healthy"


def _dormancy_evidence(
    projects: list[dict[str, Any]],
    actual_by_project: dict[int, int],
    last_log_dates_by_project: dict[int, date],
    week_end: str | date | datetime | None,
) -> list[dict[str, Any]]:
    rows = []
    for project in sorted(projects, key=lambda item: item.get("id", 0)):
        project_id = int(project["id"])
        if project.get("status") != "active" or project.get("stage") == "dormant":
            continue
        last_activity_date = _effective_last_activity_date(
            project.get("last_activity_date"),
            last_log_dates_by_project.get(project_id),
        )
        actual_minutes = actual_by_project.get(project_id, 0)
        inactive_days = _days_since(last_activity_date, week_end)
        rows.append(
            {
                "project_id": project_id,
                "project_title": project["title"],
                "stage": project.get("stage"),
                "weekly_min_minutes": int(project.get("weekly_min_minutes", 0)),
                "actual_minutes": actual_minutes,
                "last_activity_date": last_activity_date,
                "inactive_days": inactive_days,
                "risk_level": _dormancy_risk_level(inactive_days),
                "missed_weekly_minimum": (
                    int(project.get("weekly_min_minutes", 0)) > 0 and actual_minutes == 0
                ),
            }
        )
    return rows


def _dormancy_risk_level(inactive_days: int | None) -> str:
    if inactive_days is None:
        return "unknown"
    if inactive_days >= DORMANCY_HIGH_DAYS:
        return "high"
    if inactive_days >= DORMANCY_MEDIUM_DAYS:
        return "medium"
    return "none"


def _complete_activity_mix(activity_mix: dict[str, int]) -> dict[str, int]:
    return {activity_type: int(activity_mix.get(activity_type, 0)) for activity_type in ACTIVITY_TYPES}


def _unlinked_minutes(time_logs: list[dict[str, Any]]) -> int:
    return sum(
        int(log.get("duration_minutes", 0))
        for log in time_logs
        if log.get("project_id") is None
    )


def _last_log_dates_by_project(time_logs: list[dict[str, Any]]) -> dict[int, date]:
    dates: dict[int, date] = {}
    for log in time_logs:
        project_id = log.get("project_id")
        if project_id is None:
            continue
        log_date = _coerce_date(log.get("date"))
        if log_date is None:
            continue
        project_key = int(project_id)
        if project_key not in dates or log_date > dates[project_key]:
            dates[project_key] = log_date
    return dates


def _inactive_days_by_project(
    projects: list[dict[str, Any]],
    last_log_dates_by_project: dict[int, date],
    week_end: str | date | datetime | None,
) -> dict[int, int | None]:
    inactive_days = {}
    for project in projects:
        project_id = int(project["id"])
        last_activity_date = _effective_last_activity_date(
            project.get("last_activity_date"),
            last_log_dates_by_project.get(project_id),
        )
        inactive_days[project_id] = _days_since(last_activity_date, week_end)
    return inactive_days


def _effective_last_activity_date(
    project_last_activity_date: str | date | datetime | None,
    last_log_date: date | None,
) -> str | None:
    project_date = _coerce_date(project_last_activity_date) if project_last_activity_date else None
    candidates = [item for item in (project_date, last_log_date) if item is not None]
    if not candidates:
        return None
    return max(candidates).isoformat()


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


def _check_goal_alignment(
    goals: list[dict[str, Any]],
    projects: list[dict[str, Any]],
    actual_by_goal: dict[int, int],
    actual_by_project: dict[int, int],
) -> dict[str, list[dict[str, str]]]:
    insights = []
    risk_flags = []
    projects_by_goal: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for project in projects:
        goal_id = project.get("goal_id")
        if goal_id is not None:
            projects_by_goal[int(goal_id)].append(project)

    active_goals = [goal for goal in goals if goal.get("active_status", True)]
    for goal in sorted(active_goals, key=lambda item: item.get("priority", 99)):
        goal_id = int(goal["id"])
        minutes = actual_by_goal.get(goal_id, 0)
        project_breakdown = _goal_project_breakdown(
            projects_by_goal.get(goal_id, []), actual_by_project
        )
        if minutes > 0:
            insights.append(
                {
                    "title": f"{goal['title']} received attention",
                    "evidence": (
                        f"Priority {goal.get('priority', 99)} goal received {minutes / 60:.1f}h "
                        f"across {_format_project_minutes(project_breakdown)}."
                    ),
                }
            )
        else:
            risk_flags.append(
                {
                    "type": "alignment_gap",
                    "severity": "medium",
                    "evidence": (
                        f"Priority {goal.get('priority', 99)} goal {goal['title']} received "
                        f"0 goal-linked minutes across {_format_project_names(project_breakdown)}."
                    ),
                }
            )
    return {"insights": insights, "risk_flags": risk_flags}


def _format_project_minutes(projects: list[dict[str, Any]]) -> str:
    if not projects:
        return "no linked projects"
    return ", ".join(
        f"{project['title']} ({int(project['actual_minutes']) / 60:.1f}h)"
        for project in projects
    )


def _format_project_names(projects: list[dict[str, Any]]) -> str:
    if not projects:
        return "no linked projects"
    return ", ".join(project["title"] for project in projects)


def _check_plan_gap(
    projects_by_id: dict[int, dict[str, Any]],
    planned_by_project: dict[int, int],
    actual_by_project: dict[int, int],
) -> dict[str, list[dict[str, str]]]:
    insights = []
    risk_flags = []
    for project_id in sorted(set(planned_by_project) | set(actual_by_project)):
        planned_minutes = planned_by_project.get(project_id, 0)
        actual_minutes = actual_by_project.get(project_id, 0)
        if planned_minutes < PLAN_MIN_REVIEW_MINUTES and actual_minutes < PLAN_DRIFT_MIN_MINUTES:
            continue
        project = projects_by_id.get(project_id, {"title": f"Project {project_id}"})
        diff = actual_minutes - planned_minutes
        diff_ratio = abs(diff) / planned_minutes if planned_minutes > 0 else None
        plan_status = _plan_status(planned_minutes, actual_minutes)
        if plan_status == "unplanned":
            risk_flags.append(
                {
                    "type": "plan_drift",
                    "severity": "medium",
                    "evidence": (
                        f"{project['title']} logged {actual_minutes / 60:.1f}h without planned time."
                    ),
                }
            )
        elif _is_major_plan_drift(planned_minutes, actual_minutes):
            direction = "over plan" if diff > 0 else "under plan"
            risk_flags.append(
                {
                    "type": "plan_drift",
                    "severity": "medium",
                    "evidence": (
                        f"{project['title']} planned {planned_minutes / 60:.1f}h, "
                        f"logged {actual_minutes / 60:.1f}h, and finished "
                        f"{abs(diff) / 60:.1f}h {direction} "
                        f"({diff_ratio:.0%} difference)."
                    ),
                }
            )
        elif planned_minutes > 0:
            insights.append(
                {
                    "title": f"{project['title']} roughly matched the plan",
                    "evidence": (
                        f"Planned {planned_minutes / 60:.1f}h, logged {actual_minutes / 60:.1f}h, "
                        f"difference {diff / 60:.1f}h."
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
    projects: list[dict[str, Any]],
    actual_by_project: dict[int, int],
    last_log_dates_by_project: dict[int, date],
    week_end: str | date | datetime | None,
) -> dict[str, list[dict[str, str]]]:
    risk_flags = []
    for project in projects:
        if project.get("status") != "active" or project.get("stage") == "dormant":
            continue
        project_id = int(project["id"])
        actual_minutes = actual_by_project.get(project_id, 0)
        if project.get("weekly_min_minutes", 0) > 0 and actual_minutes == 0:
            risk_flags.append(
                {
                    "type": "dormancy_risk",
                    "severity": "medium",
                    "evidence": (
                        f"{project['title']} had a {int(project.get('weekly_min_minutes', 0)) / 60:.1f}h "
                        "weekly minimum but logged 0 minutes."
                    ),
                }
            )
        last_activity_date = _effective_last_activity_date(
            project.get("last_activity_date"),
            last_log_dates_by_project.get(project_id),
        )
        inactive_days = _days_since(last_activity_date, week_end)
        if inactive_days is not None and inactive_days >= DORMANCY_HIGH_DAYS:
            risk_flags.append(
                {
                    "type": "dormancy_risk",
                    "severity": "high",
                    "evidence": (
                        f"{project['title']} has been inactive for {inactive_days} days, "
                        f"crossing the {DORMANCY_HIGH_DAYS}-day wake-up threshold."
                    ),
                }
            )
        elif inactive_days is not None and inactive_days >= DORMANCY_MEDIUM_DAYS:
            risk_flags.append(
                {
                    "type": "dormancy_risk",
                    "severity": "medium",
                    "evidence": (
                        f"{project['title']} has been inactive for {inactive_days} days, "
                        f"crossing the {DORMANCY_MEDIUM_DAYS}-day dormancy threshold."
                    ),
                }
            )
    return {"risk_flags": risk_flags}


def _check_slack(weekly_plan: dict[str, Any]) -> dict[str, list[dict[str, str]]]:
    capacity = int(weekly_plan.get("planned_capacity_minutes", 0))
    if capacity <= 0:
        return {"risk_flags": []}
    planned_total = sum(int(item.get("planned_minutes", 0)) for item in weekly_plan.get("items", []))
    slack_target_percent = int(weekly_plan.get("slack_target_percent", 20))
    slack_target = slack_target_percent / 100
    required_slack = capacity * slack_target
    planned_slack = capacity - planned_total
    if planned_slack < required_slack:
        return {
            "risk_flags": [
                {
                    "type": "slack_risk",
                    "severity": "medium",
                    "evidence": (
                        f"Planned {planned_total / 60:.1f}h against {capacity / 60:.1f}h capacity, "
                        f"leaving {planned_slack / 60:.1f}h slack below the "
                        f"{required_slack / 60:.1f}h target ({slack_target_percent}%)."
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
