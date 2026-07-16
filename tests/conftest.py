from __future__ import annotations

import sqlite3
from collections.abc import Iterator

import pytest

from backend.app.db import Database
from backend.app.db.repositories import UserRepository
from backend.app.schemas import LocalUserCreate, LocalUserRead
from tests.support import seed_sample_week


@pytest.fixture
def database(tmp_path) -> Database:
    instance = Database(tmp_path / "theseus-test.db")
    instance.initialize()
    return instance


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
def connection(database: Database) -> Iterator[sqlite3.Connection]:
    with database.session() as active_connection:
        yield active_connection


@pytest.fixture
def local_user(connection: sqlite3.Connection) -> LocalUserRead:
    return UserRepository(connection).create(LocalUserCreate(display_name="Test User"))


@pytest.fixture
def seeded_context(
    connection: sqlite3.Connection,
) -> tuple[sqlite3.Connection, LocalUserRead]:
    return connection, seed_sample_week(connection)


@pytest.fixture
def seeded_connection(
    seeded_context: tuple[sqlite3.Connection, LocalUserRead],
) -> sqlite3.Connection:
    return seeded_context[0]


@pytest.fixture
def seeded_user(
    seeded_context: tuple[sqlite3.Connection, LocalUserRead],
) -> LocalUserRead:
    return seeded_context[1]
