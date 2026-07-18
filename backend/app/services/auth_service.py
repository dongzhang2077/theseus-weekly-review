from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import sqlite3
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import jwt
from jwt.exceptions import InvalidTokenError as JWTInvalidTokenError
from pwdlib import PasswordHash

from ..db.repositories import AuthRepository, StoredAuthIdentity
from ..schemas import (
    AccountRead,
    AccountRegister,
    AccountUpdate,
)


ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"


class AuthenticationError(Exception):
    """Base class for controlled authentication failures."""


class InvalidCredentials(AuthenticationError):
    pass


class AccountLocked(AuthenticationError):
    def __init__(self, retry_after_seconds: int) -> None:
        super().__init__("Account is temporarily locked")
        self.retry_after_seconds = max(1, retry_after_seconds)


class InvalidAuthToken(AuthenticationError):
    pass


class RefreshTokenReuse(AuthenticationError):
    pass


class InvalidCSRFToken(AuthenticationError):
    pass


@dataclass(frozen=True)
class AuthSettings:
    secret_key: str
    issuer: str = "theseus-local"
    audience: str = "theseus-app"
    algorithm: str = "HS256"
    access_token_seconds: int = 15 * 60
    refresh_token_seconds: int = 30 * 24 * 60 * 60
    refresh_cookie_name: str = "theseus_rt"
    csrf_cookie_name: str = "theseus_csrf"
    csrf_header_name: str = "X-CSRF-Token"
    cookie_secure: bool = False
    cookie_samesite: str = "strict"

    @classmethod
    def from_environment(cls, database_path: str | Path) -> AuthSettings:
        configured_secret = os.getenv("THESEUS_JWT_SECRET", "").strip()
        secret_key = configured_secret or _load_or_create_local_secret(database_path)
        if len(secret_key) < 32:
            raise RuntimeError("THESEUS_JWT_SECRET must contain at least 32 characters")
        return cls(
            secret_key=secret_key,
            issuer=os.getenv("THESEUS_JWT_ISSUER", "theseus-local").strip()
            or "theseus-local",
            audience=os.getenv("THESEUS_JWT_AUDIENCE", "theseus-app").strip()
            or "theseus-app",
            access_token_seconds=_bounded_environment_integer(
                "THESEUS_ACCESS_TOKEN_SECONDS",
                default=15 * 60,
                minimum=60,
                maximum=24 * 60 * 60,
            ),
            refresh_token_seconds=_bounded_environment_integer(
                "THESEUS_REFRESH_TOKEN_SECONDS",
                default=30 * 24 * 60 * 60,
                minimum=60 * 60,
                maximum=90 * 24 * 60 * 60,
            ),
            cookie_secure=_environment_boolean("THESEUS_COOKIE_SECURE", False),
        )


@dataclass(frozen=True)
class AuthTokens:
    access_token: str
    refresh_token: str
    csrf_token: str
    expires_in: int
    refresh_expires_at: datetime
    session_id: str


@dataclass(frozen=True)
class RegistrationResult:
    account: AccountRead
    tokens: AuthTokens


@dataclass(frozen=True)
class LoginResult:
    account: AccountRead
    tokens: AuthTokens


@dataclass(frozen=True)
class PasswordChangeResult:
    account: AccountRead
    tokens: AuthTokens


@dataclass(frozen=True)
class AuthContext:
    account: AccountRead
    subject: str
    session_id: str


class AuthService:
    def __init__(
        self,
        settings: AuthSettings,
        *,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self.settings = settings
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self._password_hash = PasswordHash.recommended()
        self._dummy_password_hash = self._password_hash.hash(
            secrets.token_urlsafe(32)
        )

    def register(
        self,
        connection: sqlite3.Connection,
        registration: AccountRegister,
        *,
        user_agent: str = "",
    ) -> RegistrationResult:
        repository = AuthRepository(connection)
        identity = repository.create_account(
            registration,
            subject=str(uuid.uuid4()),
            password_hash=self._password_hash.hash(registration.password),
        )
        tokens = self._issue_session(repository, identity, user_agent=user_agent)
        return RegistrationResult(
            account=identity.account,
            tokens=tokens,
        )

    def login(
        self,
        connection: sqlite3.Connection,
        *,
        email: str,
        password: str,
        user_agent: str = "",
    ) -> LoginResult:
        now = self._now()
        repository = AuthRepository(connection)
        repository.purge_expired_sessions(now)
        identity = repository.get_by_email(email)
        if identity is None:
            self._verify_password(password, self._dummy_password_hash)
            raise InvalidCredentials

        valid, updated_hash = self._verify_password(password, identity.password_hash)
        if identity.locked_until and identity.locked_until > now:
            raise AccountLocked(
                int((identity.locked_until - now).total_seconds()) + 1
            )
        if not valid:
            self._record_failed_attempt(repository, identity, now)
            raise InvalidCredentials

        if updated_hash:
            repository.update_password_hash(identity.account.id, updated_hash)
        repository.clear_failed_attempts(identity.account.id)
        refreshed_identity = repository.get_by_user_id(identity.account.id) or identity
        return LoginResult(
            account=refreshed_identity.account,
            tokens=self._issue_session(
                repository,
                refreshed_identity,
                user_agent=user_agent,
            ),
        )

    def authenticate_access_token(
        self,
        connection: sqlite3.Connection,
        token: str,
    ) -> AuthContext:
        claims = self._decode_token(token, ACCESS_TOKEN_TYPE)
        subject = _required_string_claim(claims, "sub")
        session_id = _required_string_claim(claims, "sid")
        repository = AuthRepository(connection)
        session = repository.get_session(session_id)
        now = self._now()
        if session is None or not session.is_active(now):
            raise InvalidAuthToken
        identity = repository.get_by_subject(subject)
        if identity is None or identity.account.id != session.user_id:
            raise InvalidAuthToken
        repository.touch_session(session_id)
        return AuthContext(
            account=identity.account,
            subject=identity.subject,
            session_id=session_id,
        )

    def refresh(
        self,
        connection: sqlite3.Connection,
        *,
        refresh_token: str,
        csrf_cookie: str,
        csrf_header: str,
        user_agent: str = "",
    ) -> LoginResult:
        claims = self._decode_token(refresh_token, REFRESH_TOKEN_TYPE)
        subject = _required_string_claim(claims, "sub")
        session_id = _required_string_claim(claims, "jti")
        repository = AuthRepository(connection)
        session = repository.get_session(session_id)
        if session is None:
            raise InvalidAuthToken
        if session.revoked_at is not None:
            if session.replaced_by_id is not None:
                repository.revoke_all_sessions(session.user_id)
                raise RefreshTokenReuse
            raise InvalidAuthToken

        now = self._now()
        if not session.is_active(now):
            repository.revoke_session(session.id)
            raise InvalidAuthToken
        if not hmac.compare_digest(session.token_hash, _sha256(refresh_token)):
            raise InvalidAuthToken
        if (
            not csrf_cookie
            or not csrf_header
            or not hmac.compare_digest(csrf_cookie, csrf_header)
            or not hmac.compare_digest(session.csrf_hash, _sha256(csrf_header))
        ):
            raise InvalidCSRFToken

        identity = repository.get_by_subject(subject)
        if identity is None or identity.account.id != session.user_id:
            raise InvalidAuthToken
        replacement = self._issue_session(
            repository,
            identity,
            user_agent=user_agent,
        )
        repository.revoke_session(
            session.id,
            replaced_by_id=replacement.session_id,
        )
        return LoginResult(account=identity.account, tokens=replacement)

    def logout(self, connection: sqlite3.Connection, session_id: str) -> None:
        AuthRepository(connection).revoke_session(session_id)

    def update_profile(
        self,
        connection: sqlite3.Connection,
        context: AuthContext,
        update: AccountUpdate,
    ) -> AccountRead:
        return AuthRepository(connection).update_profile(context.account.id, update)

    def change_email(
        self,
        connection: sqlite3.Connection,
        context: AuthContext,
        *,
        email: str,
        current_password: str,
    ) -> AccountRead:
        repository = AuthRepository(connection)
        identity = self._require_identity(repository, context.account.id)
        self._require_current_password(current_password, identity.password_hash)
        return repository.update_email(context.account.id, email)

    def change_password(
        self,
        connection: sqlite3.Connection,
        context: AuthContext,
        *,
        current_password: str,
        new_password: str,
        user_agent: str = "",
    ) -> PasswordChangeResult:
        repository = AuthRepository(connection)
        identity = self._require_identity(repository, context.account.id)
        self._require_current_password(current_password, identity.password_hash)
        repository.update_password(
            identity.account.id,
            password_hash=self._password_hash.hash(new_password),
        )
        repository.revoke_all_sessions(identity.account.id)
        refreshed_identity = self._require_identity(repository, identity.account.id)
        tokens = self._issue_session(
            repository,
            refreshed_identity,
            user_agent=user_agent,
        )
        return PasswordChangeResult(
            account=refreshed_identity.account,
            tokens=tokens,
        )

    def delete_account(
        self,
        connection: sqlite3.Connection,
        context: AuthContext,
        *,
        current_password: str,
    ) -> None:
        repository = AuthRepository(connection)
        identity = self._require_identity(repository, context.account.id)
        self._require_current_password(current_password, identity.password_hash)
        repository.delete_account(identity.account.id)

    def _issue_session(
        self,
        repository: AuthRepository,
        identity: StoredAuthIdentity,
        *,
        user_agent: str,
    ) -> AuthTokens:
        now = self._now()
        session_id = str(uuid.uuid4())
        csrf_token = secrets.token_urlsafe(32)
        refresh_expires_at = now + timedelta(
            seconds=self.settings.refresh_token_seconds
        )
        refresh_token = self._encode_token(
            {
                "sub": identity.subject,
                "jti": session_id,
                "type": REFRESH_TOKEN_TYPE,
                "iat": now,
                "nbf": now,
                "exp": refresh_expires_at,
                "iss": self.settings.issuer,
                "aud": self.settings.audience,
            }
        )
        repository.create_session(
            session_id=session_id,
            user_id=identity.account.id,
            token_hash=_sha256(refresh_token),
            csrf_hash=_sha256(csrf_token),
            expires_at=refresh_expires_at,
            user_agent=user_agent,
        )
        access_expires_at = now + timedelta(
            seconds=self.settings.access_token_seconds
        )
        access_token = self._encode_token(
            {
                "sub": identity.subject,
                "sid": session_id,
                "jti": str(uuid.uuid4()),
                "type": ACCESS_TOKEN_TYPE,
                "iat": now,
                "nbf": now,
                "exp": access_expires_at,
                "iss": self.settings.issuer,
                "aud": self.settings.audience,
            }
        )
        return AuthTokens(
            access_token=access_token,
            refresh_token=refresh_token,
            csrf_token=csrf_token,
            expires_in=self.settings.access_token_seconds,
            refresh_expires_at=refresh_expires_at,
            session_id=session_id,
        )

    def _decode_token(self, token: str, expected_type: str) -> dict[str, Any]:
        if not token:
            raise InvalidAuthToken
        try:
            claims = jwt.decode(
                token,
                self.settings.secret_key,
                algorithms=[self.settings.algorithm],
                audience=self.settings.audience,
                issuer=self.settings.issuer,
                options={
                    "require": [
                        "sub",
                        "jti",
                        "type",
                        "iat",
                        "nbf",
                        "exp",
                        "iss",
                        "aud",
                    ]
                },
            )
        except JWTInvalidTokenError as exc:
            raise InvalidAuthToken from exc
        if claims.get("type") != expected_type:
            raise InvalidAuthToken
        if expected_type == ACCESS_TOKEN_TYPE:
            _required_string_claim(claims, "sid")
        return claims

    def _encode_token(self, claims: dict[str, Any]) -> str:
        return jwt.encode(
            claims,
            self.settings.secret_key,
            algorithm=self.settings.algorithm,
        )

    def _record_failed_attempt(
        self,
        repository: AuthRepository,
        identity: StoredAuthIdentity,
        now: datetime,
    ) -> None:
        attempts = identity.failed_attempts + 1
        locked_until = now + timedelta(seconds=60) if attempts >= 5 else None
        repository.record_failed_attempt(
            identity.account.id,
            failed_attempts=attempts,
            locked_until=locked_until,
        )

    def _require_current_password(self, password: str, password_hash: str) -> None:
        valid, _ = self._verify_password(password, password_hash)
        if not valid:
            raise InvalidCredentials

    def _verify_password(self, password: str, password_hash: str) -> tuple[bool, str | None]:
        try:
            return self._password_hash.verify_and_update(password, password_hash)
        except Exception:
            return False, None

    @staticmethod
    def _require_identity(
        repository: AuthRepository,
        user_id: int,
    ) -> StoredAuthIdentity:
        identity = repository.get_by_user_id(user_id)
        if identity is None:
            raise InvalidAuthToken
        return identity

    def _now(self) -> datetime:
        value = self._clock()
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _required_string_claim(claims: dict[str, Any], name: str) -> str:
    value = claims.get(name)
    if not isinstance(value, str) or not value:
        raise InvalidAuthToken
    return value


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _load_or_create_local_secret(database_path: str | Path) -> str:
    if str(database_path) == ":memory:":
        return secrets.token_urlsafe(48)
    key_path = Path(f"{Path(database_path).expanduser().resolve()}.auth-key")
    key_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        descriptor = os.open(
            key_path,
            os.O_WRONLY | os.O_CREAT | os.O_EXCL,
            0o600,
        )
    except FileExistsError:
        secret = key_path.read_text(encoding="utf-8").strip()
        if len(secret) < 32:
            raise RuntimeError(f"Local auth key is invalid: {key_path}")
        return secret

    secret = secrets.token_urlsafe(48)
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        handle.write(secret)
        handle.write("\n")
    return secret


def _bounded_environment_integer(
    name: str,
    *,
    default: int,
    minimum: int,
    maximum: int,
) -> int:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    value = int(raw)
    if value < minimum or value > maximum:
        raise RuntimeError(f"{name} must be between {minimum} and {maximum}")
    return value


def _environment_boolean(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    normalized = raw.strip().casefold()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise RuntimeError(f"{name} must be a boolean value")
