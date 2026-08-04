#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from datetime import date, timedelta
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "data" / "sample" / "college_student_month.json"


def build_fixture() -> dict[str, Any]:
    fixture_start = date(2026, 7, 1)
    fixture_end = date(2026, 8, 1)
    logs: list[dict[str, Any]] = []

    def add(
        day: date,
        project_id: int | None,
        start: str,
        end: str,
        minutes: int,
        name: str,
        activity_type: str,
        note: str,
    ) -> None:
        logs.append(
            {
                "project_id": project_id,
                "date": day.isoformat(),
                "start_time": start,
                "end_time": end,
                "duration_minutes": minutes,
                "activity_name": name,
                "activity_type": activity_type,
                "type_source": "user_selected",
                "note": note,
            }
        )

    day = fixture_start
    while day <= fixture_end:
        day_number = (day - fixture_start).days
        weekday = day.weekday()

        if (
            day != date(2026, 7, 12)
            and (day.day % 4 == 0 or day in {date(2026, 7, 31), date(2026, 8, 1)})
        ):
            sleep_minutes = (450, 465, 420, 480, 435, 510, 495)[day_number % 7]
            add(
                day,
                4,
                "00:00",
                "07:30",
                sleep_minutes,
                "Sleep",
                "restore",
                "Overnight sleep recorded after waking.",
            )
        add(
            day,
            4,
            "12:10",
            "13:20",
            70 + (day_number % 3) * 5,
            "Meals and break",
            "restore",
            "Lunch or dinner away from study and work.",
        )

        if day == date(2026, 7, 12):
            day += timedelta(days=1)
            continue

        if weekday in {0, 2}:
            add(
                day,
                1,
                "09:00",
                "11:00",
                120,
                "Sociology lecture",
                "consuming",
                "Summer-term lecture and class notes.",
            )
            add(
                day,
                1,
                "14:00",
                "15:30",
                90,
                "Course reading",
                "consuming",
                "Read the assigned chapter and summarized key ideas.",
            )
            add(
                day,
                4,
                "16:10",
                "16:50",
                40,
                "Campus commute",
                "neutral",
                "Transit between campus and home.",
            )
        elif weekday in {1, 3}:
            add(
                day,
                2,
                "09:30",
                "11:30",
                120 + (day_number % 2) * 30,
                "Research paper",
                "consuming",
                "Worked on sources, outline, or the next draft section.",
            )
            add(
                day,
                3,
                "16:00",
                "21:00",
                300,
                "Cafe shift",
                "consuming",
                "Part-time customer service shift.",
            )
            add(
                day,
                3,
                "15:20",
                "15:55",
                35,
                "Work commute",
                "neutral",
                "Transit to the cafe before the shift.",
            )
        elif weekday == 4:
            add(
                day,
                2,
                "10:00",
                "12:00",
                120,
                "Library study",
                "consuming",
                "Consolidated class notes and prepared the presentation.",
            )
            add(
                day,
                4,
                "16:30",
                "17:25",
                55,
                "Gym session",
                "restore",
                "Strength training and cooldown.",
            )
            add(
                day,
                4,
                "19:30",
                "21:00",
                90,
                "Friends and downtime",
                "restore",
                "Relaxed evening after the study week.",
            )
        elif weekday == 5:
            add(
                day,
                3,
                "09:00",
                "15:00",
                360,
                "Cafe shift",
                "consuming",
                "Weekend part-time shift.",
            )
            add(
                day,
                3,
                "08:20",
                "08:50",
                30,
                "Work commute",
                "neutral",
                "Transit to the cafe before the shift.",
            )
            add(
                day,
                4,
                "17:00",
                "17:45",
                45,
                "Walk outside",
                "restore",
                "Easy walk to recover after standing at work.",
            )
        else:
            add(
                day,
                4,
                "10:30",
                "12:00",
                90,
                "Laundry and groceries",
                "neutral",
                "Weekly home reset and grocery trip.",
            )
            add(
                day,
                1,
                "14:00",
                "15:30",
                90,
                "Weekly course review",
                "consuming",
                "Reviewed notes and identified the next assignment step.",
            )
            add(
                day,
                4,
                "18:00",
                "19:30",
                90,
                "Family call and rest",
                "restore",
                "Unstructured recovery time before the new week.",
            )

        if weekday in {0, 2}:
            add(
                day,
                4,
                "18:00",
                "18:40",
                40,
                "Run or yoga",
                "restore",
                "Short movement session between study blocks.",
            )
        if day.day in {5, 11, 17, 24, 29}:
            add(
                day,
                None,
                "22:30",
                "23:30",
                60 + (day.day % 2) * 20,
                "Late phone scrolling",
                "destroy",
                "Stayed online longer than intended before sleep.",
            )

        day += timedelta(days=1)

    return {
        "fixture_name": "final_defense_college_student_month_v1",
        "fixture_start": fixture_start.isoformat(),
        "fixture_end": fixture_end.isoformat(),
        "persona": {
            "summary": "A college student balancing a summer course, a research paper, part-time cafe work, and personal wellbeing.",
            "timezone": "America/Los_Angeles",
            "privacy": "Synthetic and sanitized; no real person or institution is represented.",
        },
        "goals": [
            {
                "id": 1,
                "title": "Finish the summer term strongly",
                "description": "Keep coursework moving without relying on deadline-week cramming.",
                "priority": 1,
                "active_status": True,
            },
            {
                "id": 2,
                "title": "Maintain steady part-time income",
                "description": "Complete scheduled cafe shifts while protecting study commitments.",
                "priority": 2,
                "active_status": True,
            },
            {
                "id": 3,
                "title": "Protect health and energy",
                "description": "Keep sleep, meals, movement, and recovery visible during a busy month.",
                "priority": 3,
                "active_status": True,
            },
        ],
        "projects": [
            {
                "id": 1,
                "goal_id": 1,
                "title": "Summer sociology course",
                "stage": "stable",
                "deadline": "2026-08-07",
                "weekly_min_minutes": 240,
                "weekly_target_minutes": 480,
                "status": "active",
                "last_activity_date": "2026-08-01",
            },
            {
                "id": 2,
                "goal_id": 1,
                "title": "Research paper and presentation",
                "stage": "sprint",
                "deadline": "2026-08-04",
                "weekly_min_minutes": 180,
                "weekly_target_minutes": 420,
                "status": "active",
                "last_activity_date": "2026-07-31",
            },
            {
                "id": 3,
                "goal_id": 2,
                "title": "Part-time cafe job",
                "stage": "stable",
                "deadline": None,
                "weekly_min_minutes": 600,
                "weekly_target_minutes": 960,
                "status": "active",
                "last_activity_date": "2026-08-01",
            },
            {
                "id": 4,
                "goal_id": 3,
                "title": "Health and daily routines",
                "stage": "stable",
                "deadline": None,
                "weekly_min_minutes": 420,
                "weekly_target_minutes": 720,
                "status": "active",
                "last_activity_date": "2026-08-01",
            },
        ],
        "weekly_plan": {
            "week_start": "2026-07-27",
            "week_end": "2026-08-02",
            "planned_capacity_minutes": 5400,
            "slack_target_percent": 20,
            "items": [
                {
                    "project_id": 1,
                    "title": "Review sociology notes and prepare final questions",
                    "planned_minutes": 420,
                    "priority": 2,
                },
                {
                    "project_id": 2,
                    "title": "Finish presentation outline and evidence cards",
                    "planned_minutes": 900,
                    "priority": 1,
                },
                {
                    "project_id": 3,
                    "title": "Complete three scheduled cafe shifts",
                    "planned_minutes": 960,
                    "priority": 2,
                },
                {
                    "project_id": 4,
                    "title": "Protect sleep, meals, and three movement sessions",
                    "planned_minutes": 1800,
                    "priority": 3,
                },
            ],
            "note": "Full-life time budget for final presentation week: protect the paper block before accepting extra shifts.",
        },
        "time_logs": logs,
        "daily_reflections": [
            {
                "date": "2026-07-03",
                "small_win": "Finished the first week of readings before the weekend.",
                "mood_note": "Tired after the Friday study block, but relieved.",
                "free_note": "Morning study worked better than trying after a shift.",
            },
            {
                "date": "2026-07-07",
                "small_win": "Found two useful sources for the research paper.",
                "mood_note": "Focused in the library.",
                "free_note": "Keep source notes short and attach them to the outline.",
            },
            {
                "date": "2026-07-11",
                "small_win": "Handled a busy cafe shift without skipping lunch.",
                "mood_note": "Physically tired but steady.",
                "free_note": "Do not schedule demanding study immediately after Saturday work.",
            },
            {
                "date": "2026-07-15",
                "small_win": "Asked a question in class that clarified the final assignment.",
                "mood_note": "More confident about the course.",
                "free_note": "Turn the answer into one presentation evidence card.",
            },
            {
                "date": "2026-07-20",
                "small_win": "Returned to the paper after a distracted weekend.",
                "mood_note": "Slow start, better after lunch.",
                "free_note": "Use a 30-minute restart block when momentum is low.",
            },
            {
                "date": "2026-07-24",
                "small_win": "Completed the presentation structure.",
                "mood_note": "Calm after seeing the whole argument on one page.",
                "free_note": "Next week should be editing and practice, not more research.",
            },
            {
                "date": "2026-07-28",
                "small_win": "Protected the morning paper block before the cafe shift.",
                "mood_note": "Busy but in control.",
                "free_note": "The early block is the most reliable time for priority work.",
            },
            {
                "date": "2026-07-31",
                "small_win": "Practised the presentation once without reading the notes.",
                "mood_note": "Nervous, then encouraged.",
                "free_note": "Shorten the opening and keep the demo sequence fixed.",
            },
        ],
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate or verify the sanitized final-defense demo fixture."
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail when the committed fixture differs from deterministic output.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    rendered = json.dumps(build_fixture(), indent=2, ensure_ascii=False) + "\n"
    if args.check:
        if not args.output.exists() or args.output.read_text(encoding="utf-8") != rendered:
            raise SystemExit(f"Fixture is stale: {args.output}")
        print({"status": "ok", "fixture": str(args.output)})
        return
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(rendered, encoding="utf-8")
    print({"status": "written", "fixture": str(args.output)})


if __name__ == "__main__":
    main()
