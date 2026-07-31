from __future__ import annotations

import sqlite3
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status

from ..schemas import (
    AccountRead,
    AssistantContextRead,
    AssistantGatewayContextEnvelope,
    AssistantGatewayEnvelopeRequest,
    AssistantGatewayProviderStatusRead,
    AssistantProposalExecutionRequest,
    AssistantWeeklyPlanExecutionRead,
    AssistantWeeklyPlanUndoRead,
    AssistantWeeklyPlanUndoRequest,
    AssistantWeeklyPlanProposalRequest,
    ProposalRead,
)
from ..services import (
    ActionIdempotencyConflict,
    ActionNotFound,
    ActionUndoConflict,
    AssistantActionInProgress,
    AssistantContextPolicyViolation,
    AssistantContextService,
    AssistantGatewayService,
    AssistantPlanPersistenceConflict,
    AssistantPlanStateConflict,
    AssistantProposalNotApproved,
    AssistantProposalPayloadInvalid,
    AssistantProposalSourceNotFound,
    AssistantProposalSourceStale,
    AssistantProposalTypeUnsupported,
    AssistantProposalUnavailable,
    AssistantWeeklyPlanExecutionService,
    AssistantWeeklyPlanUndoService,
    AssistantWeeklyPlanProposalService,
    AssistantUndoUnavailable,
    IdempotencyConflict,
    IdempotencyInProgress,
    InvalidAssistantContextWindow,
    ProposalNotFound,
    ProposalVersionConflict,
    assistant_gateway_provider_status,
)
from .dependencies import get_connection, get_current_user


router = APIRouter(prefix="/assistant", tags=["assistant"])
IdempotencyKey = Annotated[
    str,
    Header(
        alias="Idempotency-Key",
        min_length=1,
        max_length=200,
        pattern=r".*\S.*",
    ),
]
ActionIdempotencyKey = Annotated[
    str,
    Header(
        alias="Idempotency-Key",
        min_length=8,
        max_length=200,
        pattern=r".*\S.*",
    ),
]


@router.get("/context", response_model=AssistantContextRead)
async def get_assistant_context(
    week_start: date,
    week_end: date,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> AssistantContextRead:
    try:
        return AssistantContextService(connection, user).read(
            week_start=week_start,
            week_end=week_end,
        )
    except InvalidAssistantContextWindow as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "invalid_context_window",
                "message": "Assistant context must cover between 1 and 31 days",
            },
        ) from exc


@router.get(
    "/gateway/status",
    response_model=AssistantGatewayProviderStatusRead,
)
async def get_assistant_gateway_status(
    _: AccountRead = Depends(get_current_user),
) -> AssistantGatewayProviderStatusRead:
    return assistant_gateway_provider_status()


@router.post(
    "/gateway/envelope",
    response_model=AssistantGatewayContextEnvelope,
)
async def prepare_assistant_gateway_envelope(
    request: AssistantGatewayEnvelopeRequest,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> AssistantGatewayContextEnvelope:
    try:
        return AssistantGatewayService(connection, user).prepare(request)
    except AssistantContextPolicyViolation as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "sensitive_context_rejected",
                "message": (
                    "The request contains data that is not allowed in cloud "
                    "assistant context"
                ),
            },
        ) from exc


@router.post(
    "/proposals/weekly-adjustment",
    response_model=ProposalRead,
    status_code=status.HTTP_201_CREATED,
)
async def draft_weekly_plan_proposal(
    request: AssistantWeeklyPlanProposalRequest,
    idempotency_key: IdempotencyKey,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> ProposalRead:
    try:
        return AssistantWeeklyPlanProposalService(connection, user.id).draft(
            request,
            idempotency_key=idempotency_key,
        )
    except AssistantProposalSourceNotFound as exc:
        source = str(exc)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": f"{source}_not_found",
                "message": f"The requested {source.replace('_', ' ')} was not found",
            },
        ) from exc
    except AssistantProposalSourceStale as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "weekly_review_stale",
                "message": "Regenerate the weekly review before drafting a proposal",
            },
        ) from exc
    except AssistantProposalUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "weekly_adjustment_unavailable",
                "message": "The review contains no supported plan adjustment",
            },
        ) from exc
    except IdempotencyConflict as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "idempotency_conflict",
                "message": "Idempotency-Key was already used for another request",
            },
        ) from exc
    except IdempotencyInProgress as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "idempotency_in_progress",
                "message": "A request with this Idempotency-Key is still in progress",
            },
        ) from exc


@router.post(
    "/proposals/{proposal_id}/execute-weekly-plan",
    response_model=AssistantWeeklyPlanExecutionRead,
)
async def execute_weekly_plan_proposal(
    proposal_id: int,
    request: AssistantProposalExecutionRequest,
    idempotency_key: ActionIdempotencyKey,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> AssistantWeeklyPlanExecutionRead:
    try:
        return AssistantWeeklyPlanExecutionService(connection, user.id).execute(
            proposal_id,
            request,
            idempotency_key=idempotency_key,
        )
    except ProposalNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "proposal_not_found",
                "message": "The proposal was not found",
            },
        ) from exc
    except AssistantProposalTypeUnsupported as exc:
        raise _execution_conflict(
            "proposal_type_unsupported",
            "Only Weekly Plan adjustment proposals can be executed here",
        ) from exc
    except AssistantProposalNotApproved as exc:
        raise _execution_conflict(
            "proposal_not_approved",
            "Approve the proposal before executing it",
            current=exc.current.model_dump(mode="json"),
        ) from exc
    except ProposalVersionConflict as exc:
        raise _execution_conflict(
            "version_conflict",
            "The proposal changed after it was loaded",
            current=exc.current.model_dump(mode="json"),
        ) from exc
    except AssistantProposalPayloadInvalid as exc:
        raise _execution_conflict(
            "proposal_payload_invalid",
            "The approved proposal does not contain a valid Weekly Plan change",
        ) from exc
    except AssistantPlanStateConflict as exc:
        raise _execution_conflict(
            "weekly_plan_state_conflict",
            "The target Weekly Plan changed after the proposal was drafted",
            current=(
                None
                if exc.current is None
                else exc.current.model_dump(mode="json")
            ),
        ) from exc
    except AssistantPlanPersistenceConflict as exc:
        raise _execution_conflict(
            "weekly_plan_persistence_conflict",
            "The approved Weekly Plan change could not be persisted",
        ) from exc
    except ActionIdempotencyConflict as exc:
        raise _execution_conflict(
            "idempotency_conflict",
            "Idempotency-Key was already used for another action",
        ) from exc
    except AssistantActionInProgress as exc:
        raise _execution_conflict(
            "idempotency_in_progress",
            "An action with this Idempotency-Key is still in progress",
        ) from exc


@router.post(
    "/proposals/{proposal_id}/actions/{action_id}/undo-weekly-plan",
    response_model=AssistantWeeklyPlanUndoRead,
)
async def undo_weekly_plan_action(
    proposal_id: int,
    action_id: int,
    request: AssistantWeeklyPlanUndoRequest,
    idempotency_key: ActionIdempotencyKey,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> AssistantWeeklyPlanUndoRead:
    try:
        return AssistantWeeklyPlanUndoService(connection, user.id).undo(
            proposal_id,
            action_id,
            request,
            idempotency_key=idempotency_key,
        )
    except ProposalNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "proposal_not_found",
                "message": "The proposal was not found",
            },
        ) from exc
    except ActionNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "action_not_found",
                "message": "The action was not found",
            },
        ) from exc
    except AssistantProposalTypeUnsupported as exc:
        raise _execution_conflict(
            "proposal_type_unsupported",
            "Only Weekly Plan adjustment proposals can be undone here",
        ) from exc
    except (AssistantUndoUnavailable, ActionUndoConflict) as exc:
        raise _execution_conflict(
            "weekly_plan_undo_unavailable",
            "Only one succeeded, reversible Weekly Plan action can be undone",
        ) from exc
    except ProposalVersionConflict as exc:
        raise _execution_conflict(
            "version_conflict",
            "The proposal changed after it was loaded",
            current=exc.current.model_dump(mode="json"),
        ) from exc
    except AssistantProposalPayloadInvalid as exc:
        raise _execution_conflict(
            "action_payload_invalid",
            "The action does not contain a valid Weekly Plan change",
        ) from exc
    except AssistantPlanStateConflict as exc:
        raise _execution_conflict(
            "weekly_plan_state_conflict",
            "The target Weekly Plan changed after this action succeeded",
            current=(
                None if exc.current is None else exc.current.model_dump(mode="json")
            ),
        ) from exc
    except AssistantPlanPersistenceConflict as exc:
        raise _execution_conflict(
            "weekly_plan_persistence_conflict",
            "The previous Weekly Plan state could not be restored",
        ) from exc
    except ActionIdempotencyConflict as exc:
        raise _execution_conflict(
            "idempotency_conflict",
            "Idempotency-Key was already used for another action",
        ) from exc
    except AssistantActionInProgress as exc:
        raise _execution_conflict(
            "idempotency_in_progress",
            "An action with this Idempotency-Key is still in progress",
        ) from exc


def _execution_conflict(
    code: str,
    message: str,
    *,
    current: dict | None = None,
) -> HTTPException:
    detail: dict[str, object] = {"code": code, "message": message}
    if current is not None:
        detail["current"] = current
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=detail,
    )
