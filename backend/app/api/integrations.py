from __future__ import annotations

import sqlite3
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from fastapi.security import HTTPAuthorizationCredentials

from ..schemas import (
    AccountRead,
    AssistantContextRead,
    IntegrationChannelType,
    IntegrationCredentialRead,
    IntegrationPairCreate,
    IntegrationPairRead,
)
from ..services import (
    AuthService,
    IntegrationAccessDenied,
    IntegrationBindingConflict,
    IntegrationCredentialNotFound,
    IntegrationReplayConflict,
    IntegrationScopeDenied,
    IntegrationService,
    InvalidAssistantContextWindow,
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
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "invalid_context_window",
                "message": "Assistant context must cover between 1 and 31 days",
            },
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
