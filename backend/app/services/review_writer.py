from __future__ import annotations

import json
from typing import Protocol

from ..schemas import WeeklyReviewResult


class ReviewWriter(Protocol):
    model_name: str

    def rewrite(self, result: WeeklyReviewResult) -> WeeklyReviewResult:
        """Return the same evidence-backed review with revised generated text."""


class TemplateSupportiveReviewWriter:
    model_name = "template-supportive-v1"

    def rewrite(self, result: WeeklyReviewResult) -> WeeklyReviewResult:
        values = result.model_dump(mode="json")
        values["generated_text"] = render_supportive_text(result)
        return WeeklyReviewResult.model_validate(values)


def build_structured_review_prompt(result: WeeklyReviewResult) -> dict[str, object]:
    payload = result.model_dump(mode="json")
    return {
        "system": (
            "Rewrite the weekly review in supportive second-person language. "
            "Use only the provided structured facts. Do not invent facts, diagnoses, "
            "or more than three next steps. Preserve the meaning of wins, insights, "
            "risks, and next_steps."
        ),
        "user": json.dumps(payload, ensure_ascii=False, sort_keys=True),
        "response_schema": {
            "generated_text": "string",
            "wins": "same meaning as input",
            "insights": "same meaning as input",
            "risk_flags": "same meaning as input",
            "next_steps": "same meaning as input",
        },
    }


def render_supportive_text(result: WeeklyReviewResult) -> str:
    win = result.wins[0].title if result.wins else "You created enough evidence to review the week"
    insight = result.insights[0].title if result.insights else "The week needs more records before strong conclusions"
    next_step = result.next_steps[0].title if result.next_steps else "Keep next week realistic"

    if result.risk_flags:
        risk = result.risk_flags[0]
        risk_line = f"One thing needs attention: {risk.evidence}"
    else:
        risk_line = "No major risk signal needs attention."

    return "\n".join(
        [
            f"You moved this forward: {win}.",
            f"The clearest pattern is: {insight}.",
            risk_line,
            f"Next, {next_step.lower()}.",
        ]
    )
