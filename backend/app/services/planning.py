from __future__ import annotations

import sqlite3

from ..db.repositories import TaskRepository, WeeklyPlanRepository
from ..schemas import PlannedItemCreate, WeeklyPlanCreate, WeeklyPlanRead


class InvalidPlanTaskReference(Exception):
    pass


class WeeklyPlanService:
    def __init__(self, connection: sqlite3.Connection, user_id: int) -> None:
        self.plans = WeeklyPlanRepository(connection, user_id)
        self.tasks = TaskRepository(connection, user_id)

    def create(self, plan: WeeklyPlanCreate) -> WeeklyPlanRead:
        return self.plans.create(self._normalize_task_links(plan))

    def replace(self, plan_id: int, plan: WeeklyPlanCreate) -> WeeklyPlanRead:
        self.plans.get(plan_id)
        return self.plans.replace(plan_id, self._normalize_task_links(plan))

    def _normalize_task_links(self, plan: WeeklyPlanCreate) -> WeeklyPlanCreate:
        items: list[PlannedItemCreate] = []
        for item in plan.items:
            if item.task_id is None:
                items.append(item)
                continue
            try:
                task = self.tasks.get(item.task_id, include_archived=True)
            except LookupError as exc:
                raise InvalidPlanTaskReference from exc
            if item.project_id is not None and item.project_id != task.project_id:
                raise InvalidPlanTaskReference
            items.append(item.model_copy(update={"project_id": task.project_id}))
        return plan.model_copy(update={"items": items})
