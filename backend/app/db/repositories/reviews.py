from __future__ import annotations

import json
import sqlite3

from ...schemas import WeeklyReviewRead, WeeklyReviewResult


class WeeklyReviewRepository:
    def __init__(self, connection: sqlite3.Connection, user_id: int) -> None:
        self.connection = connection
        self.user_id = user_id

    def save(self, result: WeeklyReviewResult, model_name: str | None = None) -> WeeklyReviewRead:
        values = result.model_dump(mode="json")
        values.update(
            {
                "user_id": self.user_id,
                "wins_json": self._encode(values.pop("wins")),
                "insights_json": self._encode(values.pop("insights")),
                "next_steps_json": self._encode(values.pop("next_steps")),
                "risk_flags_json": self._encode(values.pop("risk_flags")),
                "evidence_json": self._encode(values.pop("evidence")),
                "model_name": model_name,
            }
        )
        self.connection.execute(
            """
            INSERT INTO weekly_reviews (
                user_id, week_start, week_end, wins_json, insights_json,
                next_steps_json, risk_flags_json, evidence_json,
                generated_text, model_name
            ) VALUES (
                :user_id, :week_start, :week_end, :wins_json, :insights_json,
                :next_steps_json, :risk_flags_json, :evidence_json,
                :generated_text, :model_name
            )
            ON CONFLICT (user_id, week_start, week_end) DO UPDATE SET
                wins_json = excluded.wins_json,
                insights_json = excluded.insights_json,
                next_steps_json = excluded.next_steps_json,
                risk_flags_json = excluded.risk_flags_json,
                evidence_json = excluded.evidence_json,
                generated_text = excluded.generated_text,
                model_name = excluded.model_name,
                updated_at = CURRENT_TIMESTAMP
            """,
            values,
        )
        review = self.get_by_week(values["week_start"], values["week_end"])
        if review is None:
            raise RuntimeError("Weekly review was not persisted")
        return review

    def get_by_week(self, week_start: str, week_end: str) -> WeeklyReviewRead | None:
        row = self.connection.execute(
            """
            SELECT * FROM weekly_reviews
            WHERE user_id = ? AND week_start = ? AND week_end = ?
            """,
            (self.user_id, week_start, week_end),
        ).fetchone()
        return None if row is None else self._decode_row(row)

    @staticmethod
    def _encode(value: object) -> str:
        return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))

    @staticmethod
    def _decode_row(row: sqlite3.Row) -> WeeklyReviewRead:
        values = dict(row)
        values["wins"] = json.loads(values.pop("wins_json"))
        values["insights"] = json.loads(values.pop("insights_json"))
        values["next_steps"] = json.loads(values.pop("next_steps_json"))
        values["risk_flags"] = json.loads(values.pop("risk_flags_json"))
        values["evidence"] = json.loads(values.pop("evidence_json"))
        return WeeklyReviewRead.model_validate(values)
