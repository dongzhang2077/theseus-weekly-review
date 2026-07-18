from __future__ import annotations

import sqlite3
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ..schemas import AccountRead
from ..services import AuthContext, AuthService, AuthSettings, InvalidAuthToken


bearer_scheme = HTTPBearer(auto_error=False)


async def get_connection(request: Request) -> AsyncIterator[sqlite3.Connection]:
    with request.app.state.database.session() as connection:
        yield connection


async def get_auth_service(request: Request) -> AuthService:
    service = getattr(request.app.state, "auth_service", None)
    if service is None:
        settings = request.app.state.auth_settings or AuthSettings.from_environment(
            request.app.state.database.path
        )
        service = AuthService(settings)
        request.app.state.auth_service = service
    return service


async def get_auth_context(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
    connection: sqlite3.Connection = Depends(get_connection),
    service: AuthService = Depends(get_auth_service),
) -> AuthContext:
    if credentials is None or credentials.scheme.casefold() != "bearer":
        raise _unauthorized()
    try:
        return service.authenticate_access_token(connection, credentials.credentials)
    except InvalidAuthToken as exc:
        raise _unauthorized() from exc


async def get_current_user(
    context: AuthContext = Depends(get_auth_context),
) -> AccountRead:
    return context.account


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"code": "not_authenticated", "message": "Sign in to continue"},
        headers={"WWW-Authenticate": "Bearer"},
    )
