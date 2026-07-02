from backend.app.schemas import WeeklyReviewResult
from backend.app.services.review_writer import (
    TemplateSupportiveReviewWriter,
    build_structured_review_prompt,
)
from review_engine.rules import analyze_week
from tests.support import load_sample_payload


def sample_result() -> WeeklyReviewResult:
    return WeeklyReviewResult.model_validate(analyze_week(load_sample_payload()))


def test_template_writer_preserves_structured_review_fields() -> None:
    result = sample_result()
    rewritten = TemplateSupportiveReviewWriter().rewrite(result)

    assert rewritten.wins == result.wins
    assert rewritten.insights == result.insights
    assert rewritten.risk_flags == result.risk_flags
    assert rewritten.next_steps == result.next_steps
    assert rewritten.evidence == result.evidence
    assert rewritten.generated_text != result.generated_text
    assert "lazy" not in rewritten.generated_text.lower()
    assert "failing" not in rewritten.generated_text.lower()


def test_structured_prompt_uses_evidence_bound_guardrails() -> None:
    prompt = build_structured_review_prompt(sample_result())

    assert "Use only the provided structured facts" in str(prompt["system"])
    assert "generated_text" in prompt["response_schema"]
    assert "Progress on Theseus backend" in str(prompt["user"])
