from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from agent.workflows import (
    WeeklyAdjustmentDecision,
    open_weekly_adjustment_workflow,
)
from backend.app.db import Database
from backend.app.schemas import AssistantWeeklyPlanProposalRequest


def main() -> None:
    arguments = _parser().parse_args()
    database = Database(arguments.database)
    database.initialize()
    with database.session() as connection:
        with open_weekly_adjustment_workflow(
            connection,
            arguments.user_id,
            arguments.checkpoint,
        ) as workflow:
            if arguments.command == "start":
                result = workflow.start(
                    arguments.workflow_id,
                    AssistantWeeklyPlanProposalRequest(
                        review_week_start=arguments.review_week_start,
                        review_week_end=arguments.review_week_end,
                        target_week_start=arguments.target_week_start,
                        target_week_end=arguments.target_week_end,
                    ),
                )
            elif arguments.command == "resume":
                result = workflow.resume(
                    arguments.workflow_id,
                    WeeklyAdjustmentDecision(decision=arguments.decision),
                )
            else:
                result = workflow.read(arguments.workflow_id)
    print(result.model_dump_json(indent=2))


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run the bounded STORY-026 Weekly Adjustment workflow",
    )
    parser.add_argument("--database", type=Path, required=True)
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--user-id", type=int, required=True)
    parser.add_argument("--workflow-id", required=True)
    commands = parser.add_subparsers(dest="command", required=True)

    start = commands.add_parser("start")
    start.add_argument("--review-week-start", type=date.fromisoformat, required=True)
    start.add_argument("--review-week-end", type=date.fromisoformat, required=True)
    start.add_argument("--target-week-start", type=date.fromisoformat, required=True)
    start.add_argument("--target-week-end", type=date.fromisoformat, required=True)

    resume = commands.add_parser("resume")
    resume.add_argument("--decision", choices=("approve", "reject"), required=True)
    commands.add_parser("status")
    return parser


if __name__ == "__main__":
    main()
