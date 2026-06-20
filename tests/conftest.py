from __future__ import annotations

import sqlite3
from collections.abc import Iterator

import pytest

from backend.app.db import Database
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
def seeded_connection(connection: sqlite3.Connection) -> sqlite3.Connection:
    seed_sample_week(connection)
    return connection
