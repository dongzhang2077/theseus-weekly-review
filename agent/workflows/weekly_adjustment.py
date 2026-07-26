from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import date
from pathlib import Path
from typing import Any, Iterator, Literal, TypedDict

from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt
from pydantic import BaseModel, ConfigDict, Field, model_validator

from backend.app.db.repositories import WeeklyReviewRepository
from backend.app.schemas import (
    AgentActionRead,
    AssistantProposalExecutionRequest,
    AssistantWeeklyPlanProposalRequest,
    ProposalDecisionCreate,
    ProposalRead,
    WeeklyReviewGenerateRequest,
)
from backend.app.services import (
    AssistantWeeklyPlanExecutionService,
    AssistantWeeklyPlanProposalService,
    ProposalLedgerService,
    ReviewService,
)


WorkflowStatus = Literal[
    "drafting",
    "awaiting_approval",
    "approved",
    "rejected",
    "completed",
]


class WeeklyAdjustmentState(TypedDict, total=False):
    workflow_id: str
    user_id: int
    review_week_start: str
    review_week_end: str
    target_week_start: str
    target_week_end: str
    status: WorkflowStatus
    proposal_id: int
    proposal_version: int
    review_id: int
    decision: Literal["approve", "edit", "reject"]
    decided_after: dict[str, Any] | None
    reason: str
    decision_id: int
    action_id: int
    outcome_requested: bool


class WeeklyAdjustmentDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: Literal["approve", "edit", "reject"]
    decided_after: dict[str, Any] | None = None
    reason: str = Field(default="", max_length=1000)

    @model_validator(mode="after")
    def validate_edit(self) -> WeeklyAdjustmentDecision:
        if self.decision == "edit" and self.decided_after is None:
            raise ValueError("edit decisions require decided_after")
        if self.decision != "edit" and self.decided_after is not None:
            raise ValueError("decided_after is only valid for edit decisions")
        return self


class WeeklyAdjustmentWorkflowRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workflow_id: str
    user_id: int
    status: WorkflowStatus
    proposal: ProposalRead
    action: AgentActionRead | None = None
    outcome_requested: bool = False


class WeeklyAdjustmentWorkflowNotFound(Exception):
    pass


class WeeklyAdjustmentWorkflowConflict(Exception):
    pass


class WeeklyAdjustmentWorkflow:
    """One durable, human-approved Weekly Plan adjustment workflow."""

    def __init__(
        self,
        connection: sqlite3.Connection,
        user_id: int,
        checkpointer: SqliteSaver,
    ) -> None:
        self.user_id = user_id
        self.ledger = ProposalLedgerService(connection, user_id)
        self.graph = _build_graph(connection, user_id, checkpointer)

    def start(
        self,
        workflow_id: str,
        request: AssistantWeeklyPlanProposalRequest,
    ) -> WeeklyAdjustmentWorkflowRead:
        workflow_key = _workflow_key(workflow_id)
        config = self._config(workflow_key)
        snapshot = self.graph.get_state(config)
        requested = {
            "review_week_start": request.review_week_start.isoformat(),
            "review_week_end": request.review_week_end.isoformat(),
            "target_week_start": request.target_week_start.isoformat(),
            "target_week_end": request.target_week_end.isoformat(),
        }
        if snapshot.values:
            state = dict(snapshot.values)
            if any(state.get(key) != value for key, value in requested.items()):
                raise WeeklyAdjustmentWorkflowConflict
            return self._read(state)

        initial: WeeklyAdjustmentState = {
            "workflow_id": workflow_key,
            "user_id": self.user_id,
            "status": "drafting",
            **requested,
        }
        self.graph.invoke(initial, config=config)
        return self.read(workflow_key)

    def read(self, workflow_id: str) -> WeeklyAdjustmentWorkflowRead:
        workflow_key = _workflow_key(workflow_id)
        snapshot = self.graph.get_state(self._config(workflow_key))
        if not snapshot.values:
            raise WeeklyAdjustmentWorkflowNotFound
        return self._read(dict(snapshot.values))

    def resume(
        self,
        workflow_id: str,
        decision: WeeklyAdjustmentDecision,
    ) -> WeeklyAdjustmentWorkflowRead:
        workflow_key = _workflow_key(workflow_id)
        config = self._config(workflow_key)
        snapshot = self.graph.get_state(config)
        if not snapshot.values:
            raise WeeklyAdjustmentWorkflowNotFound
        state = dict(snapshot.values)
        if state.get("status") != "awaiting_approval":
            if _same_decision(state, decision):
                return self._read(state)
            raise WeeklyAdjustmentWorkflowConflict
        self.graph.invoke(
            Command(resume=decision.model_dump(mode="json")),
            config=config,
        )
        return self.read(workflow_key)

    def retry(self, workflow_id: str) -> WeeklyAdjustmentWorkflowRead:
        workflow_key = _workflow_key(workflow_id)
        config = self._config(workflow_key)
        snapshot = self.graph.get_state(config)
        if not snapshot.values:
            raise WeeklyAdjustmentWorkflowNotFound
        if snapshot.interrupts or not snapshot.next:
            raise WeeklyAdjustmentWorkflowConflict
        self.graph.invoke(None, config=config)
        return self.read(workflow_key)

    def _read(self, state: dict[str, Any]) -> WeeklyAdjustmentWorkflowRead:
        if state.get("user_id") != self.user_id:
            raise WeeklyAdjustmentWorkflowNotFound
        proposal_id = state.get("proposal_id")
        if not isinstance(proposal_id, int):
            raise WeeklyAdjustmentWorkflowConflict
        proposal = self.ledger.get(proposal_id)
        action_id = state.get("action_id")
        action = (
            None if action_id is None else self.ledger.get_action(int(action_id))
        )
        return WeeklyAdjustmentWorkflowRead(
            workflow_id=str(state["workflow_id"]),
            user_id=self.user_id,
            status=state["status"],
            proposal=proposal,
            action=action,
            outcome_requested=bool(state.get("outcome_requested", False)),
        )

    def _config(self, workflow_id: str) -> dict[str, dict[str, str]]:
        return {
            "configurable": {
                "thread_id": f"user:{self.user_id}:weekly-adjustment:{workflow_id}",
            }
        }


def _build_graph(
    connection: sqlite3.Connection,
    user_id: int,
    checkpointer: SqliteSaver,
):
    proposal_service = AssistantWeeklyPlanProposalService(connection, user_id)
    execution_service = AssistantWeeklyPlanExecutionService(connection, user_id)
    ledger = ProposalLedgerService(connection, user_id)
    reviews = WeeklyReviewRepository(connection, user_id)
    review_service = ReviewService(connection, user_id)

    def load_evidence(state: WeeklyAdjustmentState) -> dict[str, Any]:
        _require_user(state, user_id)
        review = reviews.get_by_week(
            state["review_week_start"],
            state["review_week_end"],
        )
        if review is None or review.stale_at is not None:
            review = review_service.generate(
                WeeklyReviewGenerateRequest(
                    week_start=date.fromisoformat(state["review_week_start"]),
                    week_end=date.fromisoformat(state["review_week_end"]),
                )
            )
        return {"review_id": review.id}

    def draft(state: WeeklyAdjustmentState) -> dict[str, Any]:
        _require_user(state, user_id)
        request = AssistantWeeklyPlanProposalRequest(
            review_week_start=date.fromisoformat(state["review_week_start"]),
            review_week_end=date.fromisoformat(state["review_week_end"]),
            target_week_start=date.fromisoformat(state["target_week_start"]),
            target_week_end=date.fromisoformat(state["target_week_end"]),
        )
        proposal = proposal_service.draft(
            request,
            idempotency_key=f"workflow:{state['workflow_id']}:draft",
        )
        return {
            "proposal_id": proposal.id,
            "proposal_version": proposal.version,
            "status": "awaiting_approval",
        }

    def await_decision(state: WeeklyAdjustmentState) -> dict[str, Any]:
        _require_user(state, user_id)
        raw = interrupt(
            {
                "kind": "weekly_plan_approval",
                "proposal_id": state["proposal_id"],
            }
        )
        decision = WeeklyAdjustmentDecision.model_validate(raw)
        return decision.model_dump(mode="json")

    def record_decision(state: WeeklyAdjustmentState) -> dict[str, Any]:
        _require_user(state, user_id)
        requested = ProposalDecisionCreate(
            decision=state["decision"],
            decided_after=state.get("decided_after"),
            reason=state.get("reason", ""),
        )
        detail = ledger.detail(state["proposal_id"])
        if detail.proposal.status == "pending":
            persisted = ledger.decide(
                detail.proposal.id,
                requested,
                expected_version=state["proposal_version"],
            )
        else:
            persisted = _matching_decision(detail.decisions, requested)
            if persisted is None:
                raise WeeklyAdjustmentWorkflowConflict
        proposal = ledger.get(detail.proposal.id)
        return {
            "decision_id": persisted.id,
            "proposal_version": proposal.version,
            "status": (
                "rejected" if requested.decision == "reject" else "approved"
            ),
        }

    def execute(state: WeeklyAdjustmentState) -> dict[str, Any]:
        _require_user(state, user_id)
        result = execution_service.execute(
            state["proposal_id"],
            AssistantProposalExecutionRequest(
                expected_version=state["proposal_version"]
            ),
            idempotency_key=f"workflow:{state['workflow_id']}:execute",
        )
        return {
            "action_id": result.action.id,
            "proposal_version": result.proposal.version,
            "status": "completed",
            "outcome_requested": True,
        }

    builder = StateGraph(WeeklyAdjustmentState)
    builder.add_node("load_evidence", load_evidence)
    builder.add_node("draft", draft)
    builder.add_node("await_decision", await_decision)
    builder.add_node("record_decision", record_decision)
    builder.add_node("execute", execute)
    builder.add_edge(START, "load_evidence")
    builder.add_edge("load_evidence", "draft")
    builder.add_edge("draft", "await_decision")
    builder.add_edge("await_decision", "record_decision")
    builder.add_conditional_edges(
        "record_decision",
        lambda state: state["status"],
        {"approved": "execute", "rejected": END},
    )
    builder.add_edge("execute", END)
    return builder.compile(checkpointer=checkpointer)


def _require_user(state: WeeklyAdjustmentState, user_id: int) -> None:
    if state.get("user_id") != user_id:
        raise WeeklyAdjustmentWorkflowNotFound


def _matching_decision(decisions, requested: ProposalDecisionCreate):
    if not decisions:
        return None
    current = decisions[-1]
    return (
        current
        if current.decision == requested.decision
        and current.decided_after == requested.decided_after
        and current.reason == requested.reason
        else None
    )


def _same_decision(
    state: dict[str, Any],
    requested: WeeklyAdjustmentDecision,
) -> bool:
    return (
        state.get("decision") == requested.decision
        and state.get("decided_after") == requested.decided_after
        and state.get("reason", "") == requested.reason
    )


def _workflow_key(value: str) -> str:
    key = value.strip()
    if len(key) < 8 or len(key) > 120:
        raise ValueError("workflow_id must contain between 8 and 120 characters")
    if not all(character.isalnum() or character in "-_." for character in key):
        raise ValueError("workflow_id contains unsupported characters")
    return key


@contextmanager
def open_weekly_adjustment_workflow(
    connection: sqlite3.Connection,
    user_id: int,
    checkpoint_path: str | Path,
) -> Iterator[WeeklyAdjustmentWorkflow]:
    path = Path(checkpoint_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    checkpoint_connection = sqlite3.connect(path, check_same_thread=False)
    serializer = JsonPlusSerializer(allowed_msgpack_modules=[])
    checkpointer = SqliteSaver(checkpoint_connection, serde=serializer)
    try:
        yield WeeklyAdjustmentWorkflow(connection, user_id, checkpointer)
    finally:
        checkpoint_connection.close()
