from __future__ import annotations

import sqlite3
from collections.abc import Iterator

from fastapi import Request


def get_connection(request: Request) -> Iterator[sqlite3.Connection]:
    with request.app.state.database.session() as connection:
        yield connection
