from __future__ import annotations

import sqlite3
from collections.abc import AsyncIterator

from fastapi import Request


async def get_connection(request: Request) -> AsyncIterator[sqlite3.Connection]:
    with request.app.state.database.session() as connection:
        yield connection
