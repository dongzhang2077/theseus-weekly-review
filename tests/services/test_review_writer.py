from collections.abc import Mapping
from typing import Any

from backend.app.schemas import WeeklyReviewResult
from backend.app.services.review_writer import (
    OpenAIReviewWriter,
    ReviewWriterConfigurationError,
    ReviewWriterError,
    TemplateSupportiveReviewWriter,
    build_openai_responses_payload,
    build_structured_review_prompt,
    parse_openai_generated_text,
    review_writer_from_environment,
)
from review_engine.rules import analyze_week
from tests.support import load_sample_payload


class FakeOpenAITransport:
    def __init__(self, response: Mapping[str, Any]) -> None:
        self.response = response
        self.calls: list[dict[str, Any]] = []

    def post_json(
        self,
        url: str,
        *,
        headers: Mapping[str, str],
        payload: Mapping[str, Any],
        timeout_seconds: float,
    ) -> Mapping[str, Any]:
        self.calls.append(
            {
                "url": url,
                "headers": headers,
                "payload": payload,
                "timeout_seconds": timeout_seconds,
            }
        )
        return self.response


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


def test_openai_payload_uses_structured_output_guardrails() -> None:
    payload = build_openai_responses_payload(sample_result(), "gpt-test")

    assert payload["model"] == "gpt-test"
    assert payload["store"] is False
    assert "Use only the provided structured facts" in str(payload["input"])
    assert "Progress on Theseus backend" in str(payload["input"])
    assert payload["text"]["format"]["type"] == "json_schema"
    assert payload["text"]["format"]["strict"] is True
    assert payload["text"]["format"]["schema"]["required"] == ["generated_text"]


def test_openai_writer_preserves_structured_review_fields() -> None:
    result = sample_result()
    transport = FakeOpenAITransport(
        {
            "output": [
                {
                    "type": "message",
                    "content": [
                        {
                            "type": "output_text",
                            "text": '{"generated_text":"You made backend progress. Restart resume work next."}',
                        }
                    ],
                }
            ]
        }
    )

    rewritten = OpenAIReviewWriter(
        api_key="test-key",
        model="gpt-test",
        transport=transport,
    ).rewrite(result)

    assert rewritten.generated_text == "You made backend progress. Restart resume work next."
    assert rewritten.wins == result.wins
    assert rewritten.insights == result.insights
    assert rewritten.risk_flags == result.risk_flags
    assert rewritten.next_steps == result.next_steps
    assert transport.calls[0]["headers"]["Authorization"] == "Bearer test-key"


def test_parse_openai_generated_text_supports_output_text() -> None:
    response = {"output_text": '{"generated_text":"Keep the next step small."}'}

    assert parse_openai_generated_text(response) == "Keep the next step small."


def test_parse_openai_generated_text_rejects_invalid_response() -> None:
    response = {"output_text": '{"summary":"missing"}'}

    try:
        parse_openai_generated_text(response)
    except ReviewWriterError as exc:
        assert "generated_text" in str(exc)
    else:
        raise AssertionError("Expected ReviewWriterError")


def test_review_writer_from_environment_selects_openai(monkeypatch) -> None:
    monkeypatch.setenv("THESEUS_REVIEW_WRITER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("THESEUS_OPENAI_MODEL", "gpt-test")

    writer = review_writer_from_environment()

    assert isinstance(writer, OpenAIReviewWriter)
    assert writer.model_name == "openai:gpt-test"


def test_review_writer_from_environment_keeps_default_local_writer(monkeypatch) -> None:
    monkeypatch.delenv("THESEUS_REVIEW_WRITER", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    assert review_writer_from_environment() is None


def test_review_writer_from_environment_requires_openai_key(monkeypatch) -> None:
    monkeypatch.setenv("THESEUS_REVIEW_WRITER", "openai")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    try:
        review_writer_from_environment()
    except ReviewWriterConfigurationError as exc:
        assert "OPENAI_API_KEY" in str(exc)
    else:
        raise AssertionError("Expected ReviewWriterConfigurationError")


def test_review_writer_from_environment_uses_default_for_blank_model(monkeypatch) -> None:
    monkeypatch.setenv("THESEUS_REVIEW_WRITER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("THESEUS_OPENAI_MODEL", "  ")

    writer = review_writer_from_environment()

    assert isinstance(writer, OpenAIReviewWriter)
    assert writer.model_name == "openai:gpt-5.5"
