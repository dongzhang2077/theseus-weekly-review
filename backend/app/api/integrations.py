from __future__ import annotations

import sqlite3
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from fastapi.security import HTTPAuthorizationCredentials

from ..schemas import (
    AccountRead,
    AssistantContextRead,
    AssistantWeeklyPlanProposalRequest,
    AssistantWeeklyPlanExecutionRead,
    AssistantWeeklyPlanUndoRead,
    ChannelProposalDecisionRequest,
    ChannelProposalExecutionRequest,
    ChannelProposalUndoRequest,
    IntegrationChannelType,
    IntegrationCredentialRead,
    IntegrationPairCreate,
    IntegrationPairRead,
    ProposalDecisionRead,
    ProposalRead,
)
from ..services import (
    AuthService,
    AssistantProposalSourceNotFound,
    AssistantProposalSourceStale,
    AssistantProposalUnavailable,
    AssistantActionInProgress,
    AssistantPlanPersistenceConflict,
    AssistantPlanStateConflict,
    AssistantProposalNotApproved,
    AssistantProposalPayloadInvalid,
    AssistantProposalTypeUnsupported,
    AssistantUndoUnavailable,
    IdempotencyConflict,
    IdempotencyInProgress,
    IntegrationAccessDenied,
    IntegrationBindingConflict,
    IntegrationCredentialNotFound,
    IntegrationReplayConflict,
    IntegrationScopeDenied,
    IntegrationService,
    InvalidAssistantContextWindow,
    ProposalExpired,
    ProposalNotFound,
    ProposalVersionConflict,
    ActionIdempotencyConflict,
    ActionNotFound,
    ActionUndoConflict,
)
from .dependencies import (
    bearer_scheme,
    get_auth_service,
    get_connection,
    get_current_user,
)


router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.post(
    "/pair",
    response_model=IntegrationPairRead,
    status_code=status.HTTP_201_CREATED,
)
async def pair_integration(
    request: IntegrationPairCreate,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
    auth: AuthService = Depends(get_auth_service),
) -> IntegrationPairRead:
    try:
        return IntegrationService(
            connection, auth.settings.secret_key, user_id=user.id
        ).pair(request)
    except IntegrationBindingConflict as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "channel_identity_already_paired",
                "message": "This channel identity already has an active pairing",
            },
        ) from exc


@router.get("", response_model=list[IntegrationCredentialRead])
async def list_integrations(
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
    auth: AuthService = Depends(get_auth_service),
) -> list[IntegrationCredentialRead]:
    return IntegrationService(
        connection, auth.settings.secret_key, user_id=user.id
    ).list()


@router.delete("/{credential_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_integration(
    credential_id: int,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
    auth: AuthService = Depends(get_auth_service),
) -> Response:
    try:
        IntegrationService(
            connection, auth.settings.secret_key, user_id=user.id
        ).revoke(credential_id)
    except IntegrationCredentialNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "integration_not_found",
                "message": "The integration was not found",
            },
        ) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/channel/context", response_model=AssistantContextRead)
async def channel_context(
    week_start: date,
    week_end: date,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
    channel_type: Annotated[IntegrationChannelType, Header(alias="X-Channel-Type")],
    external_identity: Annotated[
        str,
        Header(
            alias="X-External-Identity",
            min_length=1,
            max_length=256,
            pattern=r".*\S.*",
        ),
    ],
    external_message_id: Annotated[
        str,
        Header(
            alias="X-External-Message-ID",
            min_length=1,
            max_length=256,
            pattern=r".*\S.*",
        ),
    ],
    connection: sqlite3.Connection = Depends(get_connection),
    auth: AuthService = Depends(get_auth_service),
) -> AssistantContextRead:
    if credentials is None or credentials.scheme.casefold() != "bearer":
        raise _integration_unauthorized()
    try:
        return IntegrationService(
            connection, auth.settings.secret_key
        ).read_context(
            token=credentials.credentials,
            channel_type=channel_type,
            external_identity=external_identity,
            external_message_id=external_message_id,
            week_start=week_start,
            week_end=week_end,
        )
    except IntegrationAccessDenied as exc:
        raise _integration_unauthorized() from exc
    except IntegrationScopeDenied as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "integration_scope_denied",
                "message": "This integration is not allowed to read context",
            },
        ) from exc
    except IntegrationReplayConflict as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "external_message_replay_conflict",
                "message": "This external message ID was used for another request",
            },
        ) from exc
    except InvalidAssistantContextWindow as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "invalid_context_window",
                "message": "Assistant context must cover between 1 and 31 days",
            },
        ) from exc


@router.post(
    "/channel/proposals/weekly-adjustment",
    response_model=ProposalRead,
    status_code=status.HTTP_201_CREATED,
)
async def channel_draft_weekly_plan_proposal(
    request: AssistantWeeklyPlanProposalRequest,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
    channel_type: Annotated[IntegrationChannelType, Header(alias="X-Channel-Type")],
    external_identity: Annotated[
        str,
        Header(
            alias="X-External-Identity",
            min_length=1,
            max_length=256,
            pattern=r".*\S.*",
        ),
    ],
    external_message_id: Annotated[
        str,
        Header(
            alias="X-External-Message-ID",
            min_length=1,
            max_length=256,
            pattern=r".*\S.*",
        ),
    ],
    connection: sqlite3.Connection = Depends(get_connection),
    auth: AuthService = Depends(get_auth_service),
) -> ProposalRead:
    if credentials is None or credentials.scheme.casefold() != "bearer":
        raise _integration_unauthorized()
    try:
        return IntegrationService(
            connection, auth.settings.secret_key
        ).draft_weekly_plan_proposal(
            token=credentials.credentials,
            channel_type=channel_type,
            external_identity=external_identity,
            external_message_id=external_message_id,
            request=request,
        )
    except IntegrationAccessDenied as exc:
        raise _integration_unauthorized() from exc
    except IntegrationScopeDenied as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "integration_scope_denied",
                "message": "This integration is not allowed to create proposals",
            },
        ) from exc
    except IntegrationReplayConflict as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "external_message_replay_conflict",
                "message": "This external message ID was used for another request",
            },
        ) from exc
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
    "/channel/proposals/{proposal_id}/decision",
    response_model=ProposalDecisionRead,
)
async def channel_decide_weekly_plan_proposal(
    proposal_id: int,
    request: ChannelProposalDecisionRequest,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
    channel_type: Annotated[IntegrationChannelType, Header(alias="X-Channel-Type")],
    external_identity: Annotated[
        str,
        Header(
            alias="X-External-Identity",
            min_length=1,
            max_length=256,
            pattern=r".*\S.*",
        ),
    ],
    external_message_id: Annotated[
        str,
        Header(
            alias="X-External-Message-ID",
            min_length=1,
            max_length=256,
            pattern=r".*\S.*",
        ),
    ],
    connection: sqlite3.Connection = Depends(get_connection),
    auth: AuthService = Depends(get_auth_service),
) -> ProposalDecisionRead:
    if credentials is None or credentials.scheme.casefold() != "bearer":
        raise _integration_unauthorized()
    try:
        return IntegrationService(
            connection, auth.settings.secret_key
        ).decide_weekly_plan_proposal(
            token=credentials.credentials,
            channel_type=channel_type,
            external_identity=external_identity,
            external_message_id=external_message_id,
            proposal_id=proposal_id,
            request=request,
        )
    except IntegrationAccessDenied as exc:
        raise _integration_unauthorized() from exc
    except IntegrationScopeDenied as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "integration_scope_denied",
                "message": "This integration is not allowed to decide proposals",
            },
        ) from exc
    except IntegrationReplayConflict as exc:
        raise HTTPException(status_code=409, detail={"code": "external_message_replay_conflict", "message": "This external message ID was used for another request"}) from exc
    except ProposalNotFound as exc:
        raise HTTPException(status_code=404, detail={"code": "proposal_not_found", "message": "The proposal was not found"}) from exc
    except ProposalExpired as exc:
        raise HTTPException(status_code=409, detail={"code": "proposal_expired", "message": "The proposal expired before the decision was recorded"}) from exc
    except ProposalVersionConflict as exc:
        raise HTTPException(status_code=409, detail={"code": "proposal_version_conflict", "message": "The proposal changed after it was loaded"}) from exc


@router.post("/channel/proposals/{proposal_id}/execute-weekly-plan", response_model=AssistantWeeklyPlanExecutionRead)
async def channel_execute_weekly_plan_proposal(
    proposal_id: int, request: ChannelProposalExecutionRequest,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    channel_type: Annotated[IntegrationChannelType, Header(alias="X-Channel-Type")],
    external_identity: Annotated[str, Header(alias="X-External-Identity", min_length=1, max_length=256, pattern=r".*\S.*")],
    external_message_id: Annotated[str, Header(alias="X-External-Message-ID", min_length=1, max_length=256, pattern=r".*\S.*")],
    connection: sqlite3.Connection = Depends(get_connection), auth: AuthService = Depends(get_auth_service),
) -> AssistantWeeklyPlanExecutionRead:
    if credentials is None or credentials.scheme.casefold() != "bearer": raise _integration_unauthorized()
    try:
        return IntegrationService(connection, auth.settings.secret_key).execute_weekly_plan_proposal(token=credentials.credentials, channel_type=channel_type, external_identity=external_identity, external_message_id=external_message_id, proposal_id=proposal_id, request=request)
    except IntegrationAccessDenied as exc: raise _integration_unauthorized() from exc
    except IntegrationScopeDenied as exc: raise HTTPException(status_code=403, detail={"code":"integration_scope_denied","message":"This integration is not allowed to execute proposals"}) from exc
    except IntegrationReplayConflict as exc: raise HTTPException(status_code=409, detail={"code":"external_message_replay_conflict","message":"This external message ID was used for another request"}) from exc
    except ProposalNotFound as exc: raise HTTPException(status_code=404, detail={"code":"proposal_not_found","message":"The proposal was not found"}) from exc
    except AssistantProposalTypeUnsupported as exc: raise _channel_execution_conflict("proposal_type_unsupported", "Only Weekly Plan adjustment proposals can be executed here") from exc
    except AssistantProposalNotApproved as exc: raise _channel_execution_conflict("proposal_not_approved", "Approve the proposal before executing it") from exc
    except ProposalVersionConflict as exc: raise _channel_execution_conflict("proposal_version_conflict", "The proposal changed after it was loaded") from exc
    except AssistantProposalPayloadInvalid as exc: raise _channel_execution_conflict("proposal_payload_invalid", "The approved proposal does not contain a valid Weekly Plan change") from exc
    except AssistantPlanStateConflict as exc: raise _channel_execution_conflict("weekly_plan_state_conflict", "The target Weekly Plan changed after the proposal was drafted") from exc
    except AssistantPlanPersistenceConflict as exc: raise _channel_execution_conflict("weekly_plan_persistence_conflict", "The approved Weekly Plan change could not be persisted") from exc
    except ActionIdempotencyConflict as exc: raise _channel_execution_conflict("idempotency_conflict", "This external message ID was already used for another action") from exc
    except AssistantActionInProgress as exc: raise _channel_execution_conflict("idempotency_in_progress", "This request is still in progress") from exc


def _channel_execution_conflict(code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"code": code, "message": message})


@router.post(
    "/channel/proposals/{proposal_id}/actions/{action_id}/undo-weekly-plan",
    response_model=AssistantWeeklyPlanUndoRead,
)
async def channel_undo_weekly_plan_action(
    proposal_id: int,
    action_id: int,
    request: ChannelProposalUndoRequest,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
    channel_type: Annotated[
        IntegrationChannelType, Header(alias="X-Channel-Type")
    ],
    external_identity: Annotated[
        str,
        Header(
            alias="X-External-Identity",
            min_length=1,
            max_length=256,
            pattern=r".*\S.*",
        ),
    ],
    external_message_id: Annotated[
        str,
        Header(
            alias="X-External-Message-ID",
            min_length=1,
            max_length=256,
            pattern=r".*\S.*",
        ),
    ],
    connection: sqlite3.Connection = Depends(get_connection),
    auth: AuthService = Depends(get_auth_service),
) -> AssistantWeeklyPlanUndoRead:
    if credentials is None or credentials.scheme.casefold() != "bearer":
        raise _integration_unauthorized()
    try:
        return IntegrationService(
            connection, auth.settings.secret_key
        ).undo_weekly_plan_action(
            token=credentials.credentials,
            channel_type=channel_type,
            external_identity=external_identity,
            external_message_id=external_message_id,
            proposal_id=proposal_id,
            action_id=action_id,
            request=request,
        )
    except IntegrationAccessDenied as exc:
        raise _integration_unauthorized() from exc
    except IntegrationScopeDenied as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "integration_scope_denied",
                "message": "This integration is not allowed to undo proposals",
            },
        ) from exc
    except IntegrationReplayConflict as exc:
        raise _channel_execution_conflict(
            "external_message_replay_conflict",
            "This external message ID was used for another request",
        ) from exc
    except ProposalNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "proposal_not_found", "message": "The proposal was not found"},
        ) from exc
    except ActionNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "action_not_found", "message": "The action was not found"},
        ) from exc
    except AssistantProposalTypeUnsupported as exc:
        raise _channel_execution_conflict(
            "proposal_type_unsupported",
            "Only Weekly Plan adjustment proposals can be undone here",
        ) from exc
    except (AssistantUndoUnavailable, ActionUndoConflict) as exc:
        raise _channel_execution_conflict(
            "weekly_plan_undo_unavailable",
            "Only one succeeded, reversible Weekly Plan action can be undone",
        ) from exc
    except ProposalVersionConflict as exc:
        raise _channel_execution_conflict(
            "proposal_version_conflict",
            "The proposal changed after it was loaded",
        ) from exc
    except AssistantProposalPayloadInvalid as exc:
        raise _channel_execution_conflict(
            "action_payload_invalid",
            "The action does not contain a valid Weekly Plan change",
        ) from exc
    except AssistantPlanStateConflict as exc:
        raise _channel_execution_conflict(
            "weekly_plan_state_conflict",
            "The target Weekly Plan changed after this action succeeded",
        ) from exc
    except AssistantPlanPersistenceConflict as exc:
        raise _channel_execution_conflict(
            "weekly_plan_persistence_conflict",
            "The previous Weekly Plan state could not be restored",
        ) from exc
    except ActionIdempotencyConflict as exc:
        raise _channel_execution_conflict(
            "idempotency_conflict",
            "This external message ID was already used for another action",
        ) from exc
    except AssistantActionInProgress as exc:
        raise _channel_execution_conflict(
            "idempotency_in_progress",
            "This request is still in progress",
        ) from exc


def _integration_unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={
            "code": "integration_access_denied",
            "message": "Integration access denied",
        },
        headers={"WWW-Authenticate": "Bearer"},
    )
