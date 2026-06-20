from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, HTTPException, status

from ..db.repositories import ProjectRepository
from ..schemas import ProjectCreate, ProjectRead
from .dependencies import get_connection


router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    project: ProjectCreate,
    connection: sqlite3.Connection = Depends(get_connection),
) -> ProjectRead:
    try:
        return ProjectRepository(connection).create(project)
    except sqlite3.IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The project could not be persisted",
        ) from exc


@router.get("", response_model=list[ProjectRead])
async def list_projects(
    connection: sqlite3.Connection = Depends(get_connection),
) -> list[ProjectRead]:
    return ProjectRepository(connection).list()
