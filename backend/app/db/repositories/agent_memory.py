from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from typing import Any

from ...schemas import (
    AgentActionCreate,
    AgentActionRead,
    AgentActionStatus,
    PreferenceCreate,
    PreferenceRevisionRead,
    PreferenceRead,
    ProposalCreate,
    ProposalDecisionCreate,
    ProposalDecisionRead,
    ProposalOutcomeCreate,
    ProposalOutcomeRead,
    ProposalRead,
    ProposalStatus,
)
from ._common import require_row


@dataclass(frozen=True)
class StoredPreferenceRevision:
    id: int
    user_id: int
    preference_id: int
    action: str
    before_json: str
    after_json: str
    actor_type: str
    reason: str
    created_at: str


class PreferenceRepository:
    def __init__(self, connection: sqlite3.Connection, user_id: int) -> None:
        self.connection = connection
        self.user_id = user_id

    def create(self, preference: PreferenceCreate) -> PreferenceRead:
        values = preference.model_dump(mode="json")
        cursor = self.connection.execute(
            """
            INSERT INTO preferences (
                user_id, source, preference_key, value_json, scope_type,
                scope_ref_id, provenance_json, confidence, review_after,
                expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                self.user_id,
                values["source"],
                values["preference_key"],
                _json_dumps(values["value"]),
                values["scope_type"],
                values["scope_ref_id"],
                _json_dumps(values["provenance"]),
                values["confidence"],
                values["review_after"],
                values["expires_at"],
            ),
        )
        return self.get(cursor.lastrowid)

    def get(self, preference_id: int, *, include_deleted: bool = False) -> PreferenceRead:
        deleted_clause = "" if include_deleted else "AND deleted_at IS NULL"
        row = self.connection.execute(
            f"""
            SELECT *
            FROM preferences
            WHERE id = ? AND user_id = ? {deleted_clause}
            """,
            (preference_id, self.user_id),
        ).fetchone()
        return _preference_read(require_row(row, "Preference", preference_id))

    def list(
        self,
        *,
        source: str | None = None,
        include_deleted: bool = False,
    ) -> list[PreferenceRead]:
        clauses = ["user_id = ?"]
        parameters: list[Any] = [self.user_id]
        if source is not None:
            clauses.append("source = ?")
            parameters.append(source)
        if not include_deleted:
            clauses.append("deleted_at IS NULL")
        rows = self.connection.execute(
            f"""
            SELECT *
            FROM preferences
            WHERE {' AND '.join(clauses)}
            ORDER BY source, preference_key, scope_type,
                     COALESCE(scope_ref_id, 0), id
            """,
            parameters,
        ).fetchall()
        return [_preference_read(row) for row in rows]

    def replace(
        self,
        preference_id: int,
        preference: PreferenceCreate,
        *,
        expected_version: int,
    ) -> PreferenceRead:
        values = preference.model_dump(mode="json")
        cursor = self.connection.execute(
            """
            UPDATE preferences
            SET source = ?,
                preference_key = ?,
                value_json = ?,
                scope_type = ?,
                scope_ref_id = ?,
                provenance_json = ?,
                confidence = ?,
                review_after = ?,
                expires_at = ?,
                version = version + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ? AND version = ? AND deleted_at IS NULL
            """,
            (
                values["source"],
                values["preference_key"],
                _json_dumps(values["value"]),
                values["scope_type"],
                values["scope_ref_id"],
                _json_dumps(values["provenance"]),
                values["confidence"],
                values["review_after"],
                values["expires_at"],
                preference_id,
                self.user_id,
                expected_version,
            ),
        )
        if cursor.rowcount != 1:
            self.get(preference_id)
            raise RuntimeError("preference_version_conflict")
        return self.get(preference_id)

    def soft_delete(self, preference_id: int, *, expected_version: int) -> PreferenceRead:
        cursor = self.connection.execute(
            """
            UPDATE preferences
            SET deleted_at = CURRENT_TIMESTAMP,
                version = version + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ? AND version = ? AND deleted_at IS NULL
            """,
            (preference_id, self.user_id, expected_version),
        )
        if cursor.rowcount != 1:
            self.get(preference_id)
            raise RuntimeError("preference_version_conflict")
        return self.get(preference_id, include_deleted=True)

    def restore(self, preference_id: int, *, expected_version: int) -> PreferenceRead:
        cursor = self.connection.execute(
            """
            UPDATE preferences
            SET deleted_at = NULL,
                version = version + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ? AND version = ? AND deleted_at IS NOT NULL
            """,
            (preference_id, self.user_id, expected_version),
        )
        if cursor.rowcount != 1:
            self.get(preference_id, include_deleted=True)
            raise RuntimeError("preference_version_conflict")
        return self.get(preference_id)

    def add_revision(
        self,
        preference_id: int,
        *,
        action: str,
        before: PreferenceRead,
        after: PreferenceRead,
        actor_type: str = "user",
        reason: str = "",
    ) -> StoredPreferenceRevision:
        cursor = self.connection.execute(
            """
            INSERT INTO preference_revisions (
                user_id, preference_id, action, before_json, after_json,
                actor_type, reason
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                self.user_id,
                preference_id,
                action,
                _json_dumps(before.model_dump(mode="json")),
                _json_dumps(after.model_dump(mode="json")),
                actor_type,
                reason,
            ),
        )
        row = self.connection.execute(
            "SELECT * FROM preference_revisions WHERE id = ? AND user_id = ?",
            (cursor.lastrowid, self.user_id),
        ).fetchone()
        return StoredPreferenceRevision(**dict(require_row(row, "PreferenceRevision", cursor.lastrowid)))

    def list_revisions(self, preference_id: int) -> list[PreferenceRevisionRead]:
        self.get(preference_id, include_deleted=True)
        rows = self.connection.execute(
            """
            SELECT *
            FROM preference_revisions
            WHERE user_id = ? AND preference_id = ?
            ORDER BY id
            """,
            (self.user_id, preference_id),
        ).fetchall()
        return [_preference_revision_read(row) for row in rows]


class ProposalRepository:
    def __init__(self, connection: sqlite3.Connection, user_id: int) -> None:
        self.connection = connection
        self.user_id = user_id

    def create(self, proposal: ProposalCreate) -> ProposalRead:
        values = proposal.model_dump(mode="json")
        cursor = self.connection.execute(
            """
            INSERT INTO proposals (
                user_id, proposal_type, source, title, rationale,
                evidence_json, before_json, after_json, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                self.user_id,
                values["proposal_type"],
                values["source"],
                values["title"],
                values["rationale"],
                _json_dumps(values["evidence"]),
                _json_dumps(values["before"]),
                _json_dumps(values["after"]),
                values["expires_at"],
            ),
        )
        return self.get(cursor.lastrowid)

    def get(self, proposal_id: int) -> ProposalRead:
        row = self.connection.execute(
            "SELECT * FROM proposals WHERE id = ? AND user_id = ?",
            (proposal_id, self.user_id),
        ).fetchone()
        return _proposal_read(require_row(row, "Proposal", proposal_id))

    def list(self, *, status: ProposalStatus | None = None) -> list[ProposalRead]:
        if status is None:
            rows = self.connection.execute(
                """
                SELECT * FROM proposals
                WHERE user_id = ?
                ORDER BY created_at DESC, id DESC
                """,
                (self.user_id,),
            ).fetchall()
        else:
            rows = self.connection.execute(
                """
                SELECT * FROM proposals
                WHERE user_id = ? AND status = ?
                ORDER BY created_at DESC, id DESC
                """,
                (self.user_id, status),
            ).fetchall()
        return [_proposal_read(row) for row in rows]

    def add_decision(
        self,
        proposal_id: int,
        decision: ProposalDecisionCreate,
        *,
        expected_version: int,
    ) -> ProposalDecisionRead:
        proposal = self.get(proposal_id)
        if proposal.version != expected_version:
            raise RuntimeError("proposal_version_conflict")
        status = {
            "approve": "approved",
            "edit": "approved",
            "reject": "rejected",
            "expire": "expired",
        }[decision.decision]
        cursor = self.connection.execute(
            """
            INSERT INTO proposal_decisions (
                user_id, proposal_id, decision, decided_after_json, reason
            ) VALUES (?, ?, ?, ?, ?)
            """,
            (
                self.user_id,
                proposal_id,
                decision.decision,
                (
                    None
                    if decision.decided_after is None
                    else _json_dumps(decision.decided_after)
                ),
                decision.reason,
            ),
        )
        update = self.connection.execute(
            """
            UPDATE proposals
            SET status = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ? AND version = ? AND status = 'pending'
            """,
            (status, proposal_id, self.user_id, expected_version),
        )
        if update.rowcount != 1:
            raise RuntimeError("proposal_state_conflict")
        row = self.connection.execute(
            "SELECT * FROM proposal_decisions WHERE id = ? AND user_id = ?",
            (cursor.lastrowid, self.user_id),
        ).fetchone()
        return _decision_read(require_row(row, "ProposalDecision", cursor.lastrowid))

    def create_action(self, action: AgentActionCreate) -> AgentActionRead:
        values = action.model_dump(mode="json")
        cursor = self.connection.execute(
            """
            INSERT INTO agent_actions (
                user_id, proposal_id, decision_id, operation, request_json,
                idempotency_key, reversible, undo_of_action_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                self.user_id,
                values["proposal_id"],
                values["decision_id"],
                values["operation"],
                _json_dumps(values["request"]),
                values["idempotency_key"],
                values["reversible"],
                values["undo_of_action_id"],
            ),
        )
        return self.get_action(cursor.lastrowid)

    def get_action(self, action_id: int) -> AgentActionRead:
        row = self.connection.execute(
            "SELECT * FROM agent_actions WHERE id = ? AND user_id = ?",
            (action_id, self.user_id),
        ).fetchone()
        return _action_read(require_row(row, "AgentAction", action_id))

    def get_action_by_key(self, idempotency_key: str) -> AgentActionRead | None:
        row = self.connection.execute(
            "SELECT * FROM agent_actions WHERE user_id = ? AND idempotency_key = ?",
            (self.user_id, idempotency_key),
        ).fetchone()
        return None if row is None else _action_read(row)

    def finish_action(
        self,
        action_id: int,
        *,
        status: AgentActionStatus,
        result: dict[str, Any] | None = None,
        verification: dict[str, Any] | None = None,
        error_message: str = "",
    ) -> AgentActionRead:
        if status not in ("succeeded", "failed", "undone"):
            raise ValueError("terminal action status is required")
        cursor = self.connection.execute(
            """
            UPDATE agent_actions
            SET status = ?,
                result_json = ?,
                verification_json = ?,
                error_message = ?,
                executed_at = CASE
                    WHEN ? IN ('succeeded', 'failed') THEN CURRENT_TIMESTAMP
                    ELSE executed_at
                END,
                undone_at = CASE
                    WHEN ? = 'undone' THEN CURRENT_TIMESTAMP
                    ELSE undone_at
                END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ? AND status = 'pending'
            """,
            (
                status,
                None if result is None else _json_dumps(result),
                None if verification is None else _json_dumps(verification),
                error_message,
                status,
                status,
                action_id,
                self.user_id,
            ),
        )
        if cursor.rowcount != 1:
            self.get_action(action_id)
            raise RuntimeError("action_state_conflict")
        return self.get_action(action_id)

    def add_outcome(self, outcome: ProposalOutcomeCreate) -> ProposalOutcomeRead:
        values = outcome.model_dump(mode="json")
        cursor = self.connection.execute(
            """
            INSERT INTO proposal_outcomes (
                user_id, proposal_id, action_id, result, usefulness,
                actual_duration_minutes, energy_feedback, note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                self.user_id,
                values["proposal_id"],
                values["action_id"],
                values["result"],
                values["usefulness"],
                values["actual_duration_minutes"],
                values["energy_feedback"],
                values["note"],
            ),
        )
        row = self.connection.execute(
            "SELECT * FROM proposal_outcomes WHERE id = ? AND user_id = ?",
            (cursor.lastrowid, self.user_id),
        ).fetchone()
        return _outcome_read(require_row(row, "ProposalOutcome", cursor.lastrowid))

    def list_decisions(self, proposal_id: int) -> list[ProposalDecisionRead]:
        self.get(proposal_id)
        rows = self.connection.execute(
            """
            SELECT * FROM proposal_decisions
            WHERE user_id = ? AND proposal_id = ?
            ORDER BY id
            """,
            (self.user_id, proposal_id),
        ).fetchall()
        return [_decision_read(row) for row in rows]

    def list_actions(self, proposal_id: int) -> list[AgentActionRead]:
        self.get(proposal_id)
        rows = self.connection.execute(
            """
            SELECT * FROM agent_actions
            WHERE user_id = ? AND proposal_id = ?
            ORDER BY id
            """,
            (self.user_id, proposal_id),
        ).fetchall()
        return [_action_read(row) for row in rows]

    def list_outcomes(self, proposal_id: int) -> list[ProposalOutcomeRead]:
        self.get(proposal_id)
        rows = self.connection.execute(
            """
            SELECT * FROM proposal_outcomes
            WHERE user_id = ? AND proposal_id = ?
            ORDER BY id
            """,
            (self.user_id, proposal_id),
        ).fetchall()
        return [_outcome_read(row) for row in rows]


def _preference_read(row: sqlite3.Row) -> PreferenceRead:
    values = dict(row)
    values["value"] = json.loads(values.pop("value_json"))
    values["provenance"] = json.loads(values.pop("provenance_json"))
    return PreferenceRead.model_validate(values)


def _preference_revision_read(row: sqlite3.Row) -> PreferenceRevisionRead:
    values = dict(row)
    values["before"] = json.loads(values.pop("before_json"))
    values["after"] = json.loads(values.pop("after_json"))
    return PreferenceRevisionRead.model_validate(values)


def _proposal_read(row: sqlite3.Row) -> ProposalRead:
    values = dict(row)
    values["evidence"] = json.loads(values.pop("evidence_json"))
    values["before"] = json.loads(values.pop("before_json"))
    values["after"] = json.loads(values.pop("after_json"))
    return ProposalRead.model_validate(values)


def _decision_read(row: sqlite3.Row) -> ProposalDecisionRead:
    values = dict(row)
    decided_after = values.pop("decided_after_json")
    values["decided_after"] = None if decided_after is None else json.loads(decided_after)
    return ProposalDecisionRead.model_validate(values)


def _action_read(row: sqlite3.Row) -> AgentActionRead:
    values = dict(row)
    values["request"] = json.loads(values.pop("request_json"))
    result = values.pop("result_json")
    verification = values.pop("verification_json")
    values["result"] = None if result is None else json.loads(result)
    values["verification"] = None if verification is None else json.loads(verification)
    values["reversible"] = bool(values["reversible"])
    return AgentActionRead.model_validate(values)


def _outcome_read(row: sqlite3.Row) -> ProposalOutcomeRead:
    return ProposalOutcomeRead.model_validate(dict(row))


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
