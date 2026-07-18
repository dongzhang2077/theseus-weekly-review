from __future__ import annotations

import sqlite3
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse

from ..schemas import (
    AccountLogin,
    AccountRead,
    AccountRegister,
    AccountUpdate,
    AuthTokenResponse,
    ChangeEmailRequest,
    ChangePasswordRequest,
    DeleteAccountRequest,
)
from ..services import (
    AccountLocked,
    AuthContext,
    AuthService,
    InvalidAuthToken,
    InvalidCredentials,
    InvalidCSRFToken,
    RefreshTokenReuse,
)
from ..services.auth_service import AuthTokens
from .dependencies import get_auth_context, get_auth_service, get_connection


router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post(
    "/register",
    response_model=AuthTokenResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    registration: AccountRegister,
    response: Response,
    request: Request,
    connection: sqlite3.Connection = Depends(get_connection),
    service: AuthService = Depends(get_auth_service),
) -> AuthTokenResponse:
    try:
        result = service.register(
            connection,
            registration,
            user_agent=request.headers.get("user-agent", ""),
        )
    except sqlite3.IntegrityError as exc:
        raise _auth_error(
            status.HTTP_409_CONFLICT,
            "email_in_use",
            "An account with this email already exists",
        ) from exc
    _set_auth_cookies(response, result.tokens, service)
    return _token_response(
        result.account,
        result.tokens,
    )


@router.post("/login", response_model=AuthTokenResponse)
async def login(
    credentials: AccountLogin,
    response: Response,
    request: Request,
    connection: sqlite3.Connection = Depends(get_connection),
    service: AuthService = Depends(get_auth_service),
) -> AuthTokenResponse:
    try:
        result = service.login(
            connection,
            email=str(credentials.email),
            password=credentials.password,
            user_agent=request.headers.get("user-agent", ""),
        )
    except AccountLocked as exc:
        raise _auth_error(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "account_locked",
            "Too many attempts. Try again shortly",
            headers={"Retry-After": str(exc.retry_after_seconds)},
        ) from exc
    except InvalidCredentials as exc:
        connection.commit()
        raise _auth_error(
            status.HTTP_401_UNAUTHORIZED,
            "invalid_credentials",
            "Email or password is incorrect",
        ) from exc
    _set_auth_cookies(response, result.tokens, service)
    return _token_response(result.account, result.tokens)


@router.post("/refresh", response_model=AuthTokenResponse)
async def refresh(
    response: Response,
    request: Request,
    csrf_header: Annotated[str | None, Header(alias="X-CSRF-Token")] = None,
    connection: sqlite3.Connection = Depends(get_connection),
    service: AuthService = Depends(get_auth_service),
) -> AuthTokenResponse | Response:
    refresh_token = request.cookies.get(service.settings.refresh_cookie_name, "")
    csrf_cookie = request.cookies.get(service.settings.csrf_cookie_name, "")
    try:
        result = service.refresh(
            connection,
            refresh_token=refresh_token,
            csrf_cookie=csrf_cookie,
            csrf_header=csrf_header or "",
            user_agent=request.headers.get("user-agent", ""),
        )
    except RefreshTokenReuse:
        connection.commit()
        return _auth_error_response(
            status.HTTP_401_UNAUTHORIZED,
            "session_reuse_detected",
            "This session is no longer valid. Sign in again",
            service,
        )
    except InvalidCSRFToken as exc:
        raise _auth_error(
            status.HTTP_403_FORBIDDEN,
            "invalid_csrf",
            "The session check failed",
        ) from exc
    except InvalidAuthToken:
        connection.commit()
        return _auth_error_response(
            status.HTTP_401_UNAUTHORIZED,
            "session_expired",
            "Your session has expired",
            service,
        )
    _set_auth_cookies(response, result.tokens, service)
    return _token_response(result.account, result.tokens)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    context: AuthContext = Depends(get_auth_context),
    connection: sqlite3.Connection = Depends(get_connection),
    service: AuthService = Depends(get_auth_service),
) -> None:
    service.logout(connection, context.session_id)
    _clear_auth_cookies(response, service)


@router.get("/me", response_model=AccountRead)
async def get_me(context: AuthContext = Depends(get_auth_context)) -> AccountRead:
    return context.account


@router.patch("/me", response_model=AccountRead)
async def update_me(
    update: AccountUpdate,
    context: AuthContext = Depends(get_auth_context),
    connection: sqlite3.Connection = Depends(get_connection),
    service: AuthService = Depends(get_auth_service),
) -> AccountRead:
    return service.update_profile(connection, context, update)


@router.post("/change-email", response_model=AccountRead)
async def change_email(
    change: ChangeEmailRequest,
    context: AuthContext = Depends(get_auth_context),
    connection: sqlite3.Connection = Depends(get_connection),
    service: AuthService = Depends(get_auth_service),
) -> AccountRead:
    try:
        return service.change_email(
            connection,
            context,
            email=str(change.email),
            current_password=change.current_password,
        )
    except InvalidCredentials as exc:
        connection.commit()
        raise _auth_error(
            status.HTTP_401_UNAUTHORIZED,
            "invalid_credentials",
            "Current password is incorrect",
        ) from exc
    except sqlite3.IntegrityError as exc:
        raise _auth_error(
            status.HTTP_409_CONFLICT,
            "email_in_use",
            "An account with this email already exists",
        ) from exc


@router.post("/change-password", response_model=AuthTokenResponse)
async def change_password(
    change: ChangePasswordRequest,
    response: Response,
    request: Request,
    context: AuthContext = Depends(get_auth_context),
    connection: sqlite3.Connection = Depends(get_connection),
    service: AuthService = Depends(get_auth_service),
) -> AuthTokenResponse:
    try:
        result = service.change_password(
            connection,
            context,
            current_password=change.current_password,
            new_password=change.new_password,
            user_agent=request.headers.get("user-agent", ""),
        )
    except InvalidCredentials as exc:
        raise _auth_error(
            status.HTTP_401_UNAUTHORIZED,
            "invalid_credentials",
            "Current password is incorrect",
        ) from exc
    _set_auth_cookies(response, result.tokens, service)
    return _token_response(
        result.account,
        result.tokens,
    )


@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    deletion: DeleteAccountRequest,
    response: Response,
    context: AuthContext = Depends(get_auth_context),
    connection: sqlite3.Connection = Depends(get_connection),
    service: AuthService = Depends(get_auth_service),
) -> None:
    try:
        service.delete_account(
            connection,
            context,
            current_password=deletion.current_password,
        )
    except InvalidCredentials as exc:
        raise _auth_error(
            status.HTTP_401_UNAUTHORIZED,
            "invalid_credentials",
            "Current password is incorrect",
        ) from exc
    _clear_auth_cookies(response, service)


def _token_response(
    account: AccountRead,
    tokens: AuthTokens,
) -> AuthTokenResponse:
    return AuthTokenResponse(
        access_token=tokens.access_token,
        expires_in=tokens.expires_in,
        user=account,
    )


def _set_auth_cookies(
    response: Response,
    tokens: AuthTokens,
    service: AuthService,
) -> None:
    settings = service.settings
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=tokens.refresh_token,
        max_age=settings.refresh_token_seconds,
        expires=tokens.refresh_expires_at,
        path="/auth",
        secure=settings.cookie_secure,
        httponly=True,
        samesite=settings.cookie_samesite,
    )
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=tokens.csrf_token,
        max_age=settings.refresh_token_seconds,
        expires=tokens.refresh_expires_at,
        path="/",
        secure=settings.cookie_secure,
        httponly=False,
        samesite=settings.cookie_samesite,
    )


def _clear_auth_cookies(response: Response, service: AuthService) -> None:
    settings = service.settings
    response.delete_cookie(
        settings.refresh_cookie_name,
        path="/auth",
        secure=settings.cookie_secure,
        httponly=True,
        samesite=settings.cookie_samesite,
    )
    response.delete_cookie(
        settings.csrf_cookie_name,
        path="/",
        secure=settings.cookie_secure,
        httponly=False,
        samesite=settings.cookie_samesite,
    )


def _auth_error(
    status_code: int,
    code: str,
    message: str,
    *,
    headers: dict[str, str] | None = None,
) -> HTTPException:
    effective_headers = dict(headers or {})
    if status_code == status.HTTP_401_UNAUTHORIZED:
        effective_headers["WWW-Authenticate"] = "Bearer"
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message},
        headers=effective_headers or None,
    )


def _auth_error_response(
    status_code: int,
    code: str,
    message: str,
    service: AuthService,
) -> Response:
    """Return an auth failure whose cookie deletions survive exception handling."""
    headers: dict[str, str] = {}
    if status_code == status.HTTP_401_UNAUTHORIZED:
        headers["WWW-Authenticate"] = "Bearer"
    response = JSONResponse(
        status_code=status_code,
        content={"detail": {"code": code, "message": message}},
        headers=headers,
    )
    _clear_auth_cookies(response, service)
    return response
