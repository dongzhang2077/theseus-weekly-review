from collections.abc import Mapping
from typing import Any

from backend.app.schemas import WeeklyReviewResult
from backend.app.services.review_writer import (
    OpenCodeGoReviewWriter,
    OpenAIReviewWriter,
    ReviewWriterConfigurationError,
    ReviewWriterError,
    TemplateSupportiveReviewWriter,
    build_chat_completions_payload,
    build_openai_responses_payload,
    build_structured_review_prompt,
    parse_chat_completions_generated_text,
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


def test_chat_completions_payload_uses_json_guardrails() -> None:
    payload = build_chat_completions_payload(sample_result(), "deepseek-test")

    assert payload["model"] == "deepseek-test"
    assert payload["response_format"] == {"type": "json_object"}
    assert "exactly one key named generated_text" in str(payload["messages"])
    assert "Use only the provided structured facts" in str(payload["messages"])
    assert "Progress on Theseus backend" in str(payload["messages"])


def test_opencode_go_writer_preserves_structured_review_fields() -> None:
    result = sample_result()
    transport = FakeOpenAITransport(
        {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": '{"generated_text":"You protected meaningful backend progress."}',
                    }
                }
            ]
        }
    )

    rewritten = OpenCodeGoReviewWriter(
        api_key="test-key",
        transport=transport,
    ).rewrite(result)

    assert rewritten.generated_text == "You protected meaningful backend progress."
    assert rewritten.wins == result.wins
    assert rewritten.insights == result.insights
    assert rewritten.risk_flags == result.risk_flags
    assert rewritten.next_steps == result.next_steps
    assert transport.calls[0]["url"].endswith("/zen/go/v1/chat/completions")
    assert transport.calls[0]["headers"]["Authorization"] == "Bearer test-key"
    assert transport.calls[0]["payload"]["model"] == "deepseek-v4-pro"


def test_parse_openai_generated_text_supports_output_text() -> None:
    response = {"output_text": '{"generated_text":"Keep the next step small."}'}

    assert parse_openai_generated_text(response) == "Keep the next step small."


def test_parse_chat_completions_generated_text() -> None:
    response = {
        "choices": [
            {"message": {"content": '{"generated_text":"Keep one restart block."}'}}
        ]
    }

    assert (
        parse_chat_completions_generated_text(response)
        == "Keep one restart block."
    )


def test_parse_chat_completions_rejects_missing_content() -> None:
    response = {"choices": [{"message": {"content": None}}]}

    try:
        parse_chat_completions_generated_text(response)
    except ReviewWriterError as exc:
        assert "generated_text" in str(exc)
    else:
        raise AssertionError("Expected ReviewWriterError")


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


def test_review_writer_from_environment_selects_opencode_go(monkeypatch) -> None:
    monkeypatch.setenv("THESEUS_REVIEW_WRITER", "opencode_go")
    monkeypatch.setenv("OPENCODE_GO_API_KEY", "test-key")
    monkeypatch.setenv("OPENCODE_GO_MODEL", "deepseek-test")
    monkeypatch.setenv("OPENCODE_GO_ENDPOINT", "https://example.test/chat/completions")

    writer = review_writer_from_environment()

    assert isinstance(writer, OpenCodeGoReviewWriter)
    assert writer.model_name == "opencode-go:deepseek-test"
    assert writer.endpoint == "https://example.test/chat/completions"


def test_review_writer_from_environment_requires_opencode_go_key(monkeypatch) -> None:
    monkeypatch.setenv("THESEUS_REVIEW_WRITER", "opencode_go")
    monkeypatch.delenv("OPENCODE_GO_API_KEY", raising=False)

    try:
        review_writer_from_environment()
    except ReviewWriterConfigurationError as exc:
        assert "OPENCODE_GO_API_KEY" in str(exc)
    else:
        raise AssertionError("Expected ReviewWriterConfigurationError")
