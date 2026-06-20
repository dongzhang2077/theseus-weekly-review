from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI

from .api.goals import router as goals_router
from .api.projects import router as projects_router
from .api.reviews import router as reviews_router
from .api.time_logs import router as time_logs_router
from .api.weekly_plans import router as weekly_plans_router
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
    application.include_router(goals_router)
    application.include_router(projects_router)
    application.include_router(reviews_router)
    application.include_router(time_logs_router)
    application.include_router(weekly_plans_router)

    @application.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "theseus-backend"}

    return application


app = create_app()
