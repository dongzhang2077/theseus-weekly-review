#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import secrets
import sys
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.app.db import Database  # noqa: E402
from backend.app.db.repositories import AuthRepository  # noqa: E402
from backend.app.schemas import AccountRegister, WeeklyReviewGenerateRequest  # noqa: E402
from backend.app.services import (  # noqa: E402
    AuthService,
    AuthSettings,
    InvalidCredentials,
    ReviewService,
)
from backend.app.services.review_writer import (  # noqa: E402
    TemplateSupportiveReviewWriter,
)
from backend.app.services.sample_import import (  # noqa: E402
    DEFAULT_SAMPLE_PATH,
    import_sample_week,
    load_sample_payload,
)


DEFAULT_USER_NAME = "Theseus Demo"
DEFAULT_LOGIN_EMAIL = "theseus-demo@example.com"


@dataclass(frozen=True)
class DemoCredentials:
    email: str
    password: str


@dataclass(frozen=True)
class DemoPreparation:
    database: str
    credentials_file: str
    login_email: str
    user_id: int
    user_name: str
    week_start: str
    week_end: str
    review_id: int
    review_writer: str
    goals: int
    projects: int
    weekly_plans: int
    planned_items: int
    time_logs: int
    daily_reflections: int


def prepare_demo(
    database_path: str | Path,
    *,
    user_name: str = DEFAULT_USER_NAME,
    login_email: str = DEFAULT_LOGIN_EMAIL,
    credentials_path: str | Path | None = None,
    sample_path: str | Path = DEFAULT_SAMPLE_PATH,
) -> DemoPreparation:
    """Load one sanitized authenticated user week and store a supportive review."""

    resolved_database = Path(database_path).expanduser().resolve()
    resolved_credentials = (
        Path(credentials_path).expanduser().resolve()
        if credentials_path is not None
        else Path(f"{resolved_database}.demo-credentials.json")
    )
    payload = load_sample_payload(sample_path)
    plan = payload["weekly_plan"]
    database = Database(resolved_database)
    database.initialize()

    with database.session() as connection:
        repository = AuthRepository(connection)
        existing = repository.get_by_email(login_email)
        if existing is not None and not resolved_credentials.exists():
            raise RuntimeError(
                "The demo account exists but its local credentials file is missing. "
                "Use a fresh demo database or restore the credentials file."
            )
        credentials = _load_or_create_credentials(
            resolved_credentials,
            email=login_email,
        )
        auth = AuthService(AuthSettings.from_environment(resolved_database))
        if existing is None:
            registration = auth.register(
                connection,
                AccountRegister(
                    email=credentials.email,
                    password=credentials.password,
                    display_name=user_name,
                    timezone="America/Los_Angeles",
                    locale="en-CA",
                )
            )
            user = registration.account
            _store_credentials(resolved_credentials, credentials)
        else:
            try:
                user = auth.login(
                    connection,
                    email=credentials.email,
                    password=credentials.password,
                ).account
            except InvalidCredentials as exc:
                raise RuntimeError(
                    "The local demo credentials do not match the persisted account."
                ) from exc
        repository.revoke_all_sessions(user.id)

        imported = import_sample_week(connection, user.id, payload)
        writer = TemplateSupportiveReviewWriter()
        review = ReviewService(connection, user.id, writer=writer).generate(
            WeeklyReviewGenerateRequest(
                week_start=plan["week_start"],
                week_end=plan["week_end"],
                mode="supportive_text",
            )
        )

    return DemoPreparation(
        database=str(resolved_database),
        credentials_file=str(resolved_credentials),
        login_email=credentials.email,
        user_id=user.id,
        user_name=user.display_name,
        week_start=str(plan["week_start"]),
        week_end=str(plan["week_end"]),
        review_id=review.id,
        review_writer=writer.model_name,
        **asdict(imported),
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Prepare a sanitized, persisted Theseus database for the 2026-07-18 demo."
        )
    )
    parser.add_argument(
        "--database",
        help=(
            "SQLite destination. When omitted, a new database is created under /tmp."
        ),
    )
    parser.add_argument("--user-name", default=DEFAULT_USER_NAME)
    parser.add_argument("--login-email", default=DEFAULT_LOGIN_EMAIL)
    parser.add_argument(
        "--credentials-file",
        help=(
            "Local JSON file for the generated demo password. "
            "Defaults beside the database and must not be committed."
        ),
    )
    parser.add_argument("--sample", default=str(DEFAULT_SAMPLE_PATH))
    return parser.parse_args()


def _new_temporary_database() -> Path:
    handle = tempfile.NamedTemporaryFile(
        prefix="theseus-midterm-demo-",
        suffix=".db",
        dir="/tmp",
        delete=False,
    )
    handle.close()
    return Path(handle.name)


def main() -> None:
    args = parse_args()
    database_path = Path(args.database) if args.database else _new_temporary_database()
    prepared = prepare_demo(
        database_path,
        user_name=args.user_name,
        login_email=args.login_email,
        credentials_path=args.credentials_file,
        sample_path=args.sample,
    )
    print(json.dumps(asdict(prepared), ensure_ascii=False, indent=2))


def _load_or_create_credentials(path: Path, *, email: str) -> DemoCredentials:
    if path.exists():
        payload = json.loads(path.read_text(encoding="utf-8"))
        credentials = DemoCredentials(
            email=str(payload.get("email", "")).strip().casefold(),
            password=str(payload.get("password", "")),
        )
        if credentials.email != email.strip().casefold() or len(credentials.password) < 15:
            raise RuntimeError("The local demo credentials file is invalid.")
        _store_credentials(path, credentials)
        return credentials

    credentials = DemoCredentials(
        email=email.strip().casefold(),
        password=secrets.token_urlsafe(24),
    )
    _store_credentials(path, credentials)
    return credentials


def _store_credentials(path: Path, credentials: DemoCredentials) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(asdict(credentials), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    path.chmod(0o600)


if __name__ == "__main__":
    main()
