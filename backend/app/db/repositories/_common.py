from __future__ import annotations

import sqlite3
from typing import TypeVar

from pydantic import BaseModel


ModelT = TypeVar("ModelT", bound=BaseModel)


def require_row(row: sqlite3.Row | None, entity: str, entity_id: int) -> sqlite3.Row:
    if row is None:
        raise LookupError(f"{entity} {entity_id} was not found")
    return row


def validate_row(model: type[ModelT], row: sqlite3.Row) -> ModelT:
    return model.model_validate(dict(row))
