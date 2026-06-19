from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI

from .api.reviews import router as reviews_router
from .db import Database


DEFAULT_DATABASE_PATH = Path(
    os.getenv("THESEUS_DB_PATH", "data/local/theseus.db")
)


def create_app(database_path: str | Path | None = None) -> FastAPI:
    database = Database(database_path or DEFAULT_DATABASE_PATH)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        database.initialize()
        yield

    application = FastAPI(title="Theseus API", version="0.1.0", lifespan=lifespan)
    application.state.database = database
    application.include_router(reviews_router)

    @application.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "theseus-backend"}

    return application


app = create_app()
