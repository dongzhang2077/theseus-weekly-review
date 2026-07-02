from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from collections.abc import Mapping
from typing import Any, Protocol

from ..schemas import WeeklyReviewResult


OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
DEFAULT_OPENAI_MODEL = "gpt-5.5"
OPENCODE_GO_CHAT_COMPLETIONS_URL = (
    "https://opencode.ai/zen/go/v1/chat/completions"
)
DEFAULT_OPENCODE_GO_MODEL = "deepseek-v4-pro"


class ReviewWriter(Protocol):
    model_name: str

    def rewrite(self, result: WeeklyReviewResult) -> WeeklyReviewResult:
        """Return the same evidence-backed review with revised generated text."""


class ReviewWriterError(RuntimeError):
    pass


class ReviewWriterConfigurationError(ReviewWriterError):
    pass


class JsonTransport(Protocol):
    def post_json(
        self,
        url: str,
        *,
        headers: Mapping[str, str],
        payload: Mapping[str, Any],
        timeout_seconds: float,
    ) -> Mapping[str, Any]:
        """Submit a JSON request and return a decoded JSON response."""


class UrllibJsonTransport:
    def post_json(
        self,
        url: str,
        *,
        headers: Mapping[str, str],
        payload: Mapping[str, Any],
        timeout_seconds: float,
    ) -> Mapping[str, Any]:
        request = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                **headers,
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
                decoded = json.loads(response.read().decode("utf-8"))
                if not isinstance(decoded, Mapping):
                    raise ReviewWriterError(
                        "Review writer response was not a JSON object"
                    )
                return decoded
        except urllib.error.HTTPError as exc:
            raise ReviewWriterError(
                f"Review writer request failed with HTTP {exc.code}"
            ) from exc
        except (OSError, json.JSONDecodeError) as exc:
            raise ReviewWriterError("Review writer request failed") from exc


class TemplateSupportiveReviewWriter:
    model_name = "template-supportive-v1"

    def rewrite(self, result: WeeklyReviewResult) -> WeeklyReviewResult:
        values = result.model_dump(mode="json")
        values["generated_text"] = render_supportive_text(result)
        return WeeklyReviewResult.model_validate(values)


class OpenAIReviewWriter:
    def __init__(
        self,
        *,
        api_key: str,
        model: str = DEFAULT_OPENAI_MODEL,
        endpoint: str = OPENAI_RESPONSES_URL,
        transport: JsonTransport | None = None,
        timeout_seconds: float = 30.0,
    ) -> None:
        if not api_key.strip():
            raise ReviewWriterConfigurationError("OPENAI_API_KEY is required")
        self.api_key = api_key
        self.model = model
        self.endpoint = endpoint
        self.transport = transport or UrllibJsonTransport()
        self.timeout_seconds = timeout_seconds
        self.model_name = f"openai:{model}"

    def rewrite(self, result: WeeklyReviewResult) -> WeeklyReviewResult:
        response = self.transport.post_json(
            self.endpoint,
            headers={"Authorization": f"Bearer {self.api_key}"},
            payload=build_openai_responses_payload(result, self.model),
            timeout_seconds=self.timeout_seconds,
        )
        generated_text = parse_openai_generated_text(response)
        values = result.model_dump(mode="json")
        values["generated_text"] = generated_text
        return WeeklyReviewResult.model_validate(values)


class OpenCodeGoReviewWriter:
    def __init__(
        self,
        *,
        api_key: str,
        model: str = DEFAULT_OPENCODE_GO_MODEL,
        endpoint: str = OPENCODE_GO_CHAT_COMPLETIONS_URL,
        transport: JsonTransport | None = None,
        timeout_seconds: float = 30.0,
    ) -> None:
        if not api_key.strip():
            raise ReviewWriterConfigurationError("OPENCODE_GO_API_KEY is required")
        self.api_key = api_key
        self.model = model
        self.endpoint = endpoint
        self.transport = transport or UrllibJsonTransport()
        self.timeout_seconds = timeout_seconds
        self.model_name = f"opencode-go:{model}"

    def rewrite(self, result: WeeklyReviewResult) -> WeeklyReviewResult:
        response = self.transport.post_json(
            self.endpoint,
            headers={"Authorization": f"Bearer {self.api_key}"},
            payload=build_chat_completions_payload(result, self.model),
            timeout_seconds=self.timeout_seconds,
        )
        generated_text = parse_chat_completions_generated_text(response)
        values = result.model_dump(mode="json")
        values["generated_text"] = generated_text
        return WeeklyReviewResult.model_validate(values)


def review_writer_from_environment() -> ReviewWriter | None:
    provider = os.getenv("THESEUS_REVIEW_WRITER", "").strip().lower()
    if provider in {"", "template", "local"}:
        return None
    if provider == "openai":
        model = os.getenv("THESEUS_OPENAI_MODEL", "").strip() or DEFAULT_OPENAI_MODEL
        return OpenAIReviewWriter(
            api_key=os.getenv("OPENAI_API_KEY", ""),
            model=model,
        )
    if provider in {"opencode_go", "opencode-go"}:
        model = (
            os.getenv("OPENCODE_GO_MODEL", "").strip()
            or DEFAULT_OPENCODE_GO_MODEL
        )
        endpoint = (
            os.getenv("OPENCODE_GO_ENDPOINT", "").strip()
            or OPENCODE_GO_CHAT_COMPLETIONS_URL
        )
        return OpenCodeGoReviewWriter(
            api_key=os.getenv("OPENCODE_GO_API_KEY", ""),
            model=model,
            endpoint=endpoint,
        )
    raise ReviewWriterConfigurationError(
        f"Unsupported THESEUS_REVIEW_WRITER provider: {provider}"
    )


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


def build_openai_responses_payload(
    result: WeeklyReviewResult,
    model: str,
) -> dict[str, object]:
    prompt = build_structured_review_prompt(result)
    return {
        "model": model,
        "input": [
            {"role": "system", "content": prompt["system"]},
            {"role": "user", "content": prompt["user"]},
        ],
        "store": False,
        "text": {
            "format": {
                "type": "json_schema",
                "name": "weekly_review_text",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "generated_text": {
                            "type": "string",
                            "description": (
                                "A concise supportive weekly review using only "
                                "the provided evidence."
                            ),
                        }
                    },
                    "required": ["generated_text"],
                    "additionalProperties": False,
                },
            }
        },
    }


def build_chat_completions_payload(
    result: WeeklyReviewResult,
    model: str,
) -> dict[str, object]:
    prompt = build_structured_review_prompt(result)
    system_prompt = (
        f"{prompt['system']} Return one JSON object with exactly one key named "
        "generated_text."
    )
    return {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt["user"]},
        ],
        "response_format": {"type": "json_object"},
    }


def parse_openai_generated_text(response: Mapping[str, Any]) -> str:
    output_text = response.get("output_text")
    if isinstance(output_text, str):
        return _parse_generated_text_json(output_text)

    output = response.get("output")
    if isinstance(output, list):
        for item in output:
            if not isinstance(item, Mapping):
                continue
            content = item.get("content")
            if not isinstance(content, list):
                continue
            for content_item in content:
                if not isinstance(content_item, Mapping):
                    continue
                if content_item.get("type") not in {None, "output_text", "text"}:
                    continue
                text = content_item.get("text")
                if isinstance(text, str):
                    return _parse_generated_text_json(text)

    raise ReviewWriterError("OpenAI response did not include generated_text")


def parse_chat_completions_generated_text(response: Mapping[str, Any]) -> str:
    choices = response.get("choices")
    if isinstance(choices, list) and choices:
        choice = choices[0]
        if isinstance(choice, Mapping):
            message = choice.get("message")
            if isinstance(message, Mapping):
                content = message.get("content")
                if isinstance(content, str):
                    return _parse_generated_text_json(content)

    raise ReviewWriterError(
        "Chat Completions response did not include generated_text"
    )


def _parse_generated_text_json(text: str) -> str:
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ReviewWriterError("Review writer response was not valid JSON") from exc

    if not isinstance(payload, Mapping):
        raise ReviewWriterError("Review writer response was not a JSON object")
    generated_text = payload.get("generated_text")
    if not isinstance(generated_text, str) or not generated_text.strip():
        raise ReviewWriterError("Review writer response did not include generated_text")
    return generated_text.strip()


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
