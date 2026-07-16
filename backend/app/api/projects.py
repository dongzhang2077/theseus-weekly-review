from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, HTTPException, status

from ..db.repositories import ProjectRepository
from ..schemas import LocalUserRead, ProjectCreate, ProjectRead
from .dependencies import get_connection, get_local_user


router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    project: ProjectCreate,
    user: LocalUserRead = Depends(get_local_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> ProjectRead:
    try:
        return ProjectRepository(connection, user.id).create(project)
    except sqlite3.IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The project could not be persisted",
        ) from exc


@router.get("", response_model=list[ProjectRead])
async def list_projects(
    user: LocalUserRead = Depends(get_local_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> list[ProjectRead]:
    return ProjectRepository(connection, user.id).list()
