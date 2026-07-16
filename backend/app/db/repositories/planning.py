from __future__ import annotations

import sqlite3

from ...schemas import (
    PlannedItemCreate,
    PlannedItemRead,
    TimeLogCreate,
    TimeLogRead,
    WeeklyPlanCreate,
    WeeklyPlanRead,
)
from ._common import require_row, validate_row


class WeeklyPlanRepository:
    def __init__(self, connection: sqlite3.Connection, user_id: int) -> None:
        self.connection = connection
        self.user_id = user_id

    def create(self, plan: WeeklyPlanCreate) -> WeeklyPlanRead:
        self.connection.execute("SAVEPOINT create_weekly_plan")
        try:
            values = plan.model_dump(mode="json", exclude={"items"})
            values["user_id"] = self.user_id
            cursor = self.connection.execute(
                """
                INSERT INTO weekly_plans (
                    user_id, week_start, week_end, planned_capacity_minutes,
                    slack_target_percent, note
                ) VALUES (
                    :user_id, :week_start, :week_end, :planned_capacity_minutes,
                    :slack_target_percent, :note
                )
                """,
                values,
            )
            plan_id = cursor.lastrowid
            for item in plan.items:
                self._create_item(plan_id, item)
            created = self.get(plan_id)
        except Exception:
            self.connection.execute("ROLLBACK TO SAVEPOINT create_weekly_plan")
            self.connection.execute("RELEASE SAVEPOINT create_weekly_plan")
            raise
        self.connection.execute("RELEASE SAVEPOINT create_weekly_plan")
        return created

    def replace(self, plan_id: int, plan: WeeklyPlanCreate) -> WeeklyPlanRead:
        self.get(plan_id)
        self.connection.execute("SAVEPOINT replace_weekly_plan")
        try:
            values = plan.model_dump(mode="json", exclude={"items"})
            values.update({"id": plan_id, "user_id": self.user_id})
            cursor = self.connection.execute(
                """
                UPDATE weekly_plans
                SET week_start = :week_start,
                    week_end = :week_end,
                    planned_capacity_minutes = :planned_capacity_minutes,
                    slack_target_percent = :slack_target_percent,
                    note = :note,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :id AND user_id = :user_id
                """,
                values,
            )
            if cursor.rowcount != 1:
                raise LookupError(f"WeeklyPlan {plan_id} was not found")
            self.connection.execute(
                "DELETE FROM planned_items WHERE weekly_plan_id = ?",
                (plan_id,),
            )
            for item in plan.items:
                self._create_item(plan_id, item)
            replaced = self.get(plan_id)
        except Exception:
            self.connection.execute("ROLLBACK TO SAVEPOINT replace_weekly_plan")
            self.connection.execute("RELEASE SAVEPOINT replace_weekly_plan")
            raise
        self.connection.execute("RELEASE SAVEPOINT replace_weekly_plan")
        return replaced

    def delete(self, plan_id: int) -> None:
        cursor = self.connection.execute(
            "DELETE FROM weekly_plans WHERE id = ? AND user_id = ?",
            (plan_id, self.user_id),
        )
        if cursor.rowcount != 1:
            raise LookupError(f"WeeklyPlan {plan_id} was not found")

    def _create_item(self, plan_id: int, item: PlannedItemCreate) -> None:
        values = item.model_dump(mode="json")
        values["weekly_plan_id"] = plan_id
        self.connection.execute(
            """
            INSERT INTO planned_items (
                weekly_plan_id, project_id, title, planned_minutes, priority, is_completed
            ) VALUES (
                :weekly_plan_id, :project_id, :title, :planned_minutes, :priority, :is_completed
            )
            """,
            values,
        )

    def get(self, plan_id: int) -> WeeklyPlanRead:
        row = self.connection.execute(
            "SELECT * FROM weekly_plans WHERE id = ? AND user_id = ?",
            (plan_id, self.user_id),
        ).fetchone()
        values = dict(require_row(row, "WeeklyPlan", plan_id))
        values["items"] = self._list_items(plan_id)
        return WeeklyPlanRead.model_validate(values)

    def get_by_week(self, week_start: str, week_end: str) -> WeeklyPlanRead | None:
        row = self.connection.execute(
            """
            SELECT id FROM weekly_plans
            WHERE user_id = ? AND week_start = ? AND week_end = ?
            """,
            (self.user_id, week_start, week_end),
        ).fetchone()
        return None if row is None else self.get(row["id"])

    def list(self) -> list[WeeklyPlanRead]:
        rows = self.connection.execute(
            "SELECT id FROM weekly_plans WHERE user_id = ? ORDER BY week_start, id",
            (self.user_id,),
        ).fetchall()
        return [self.get(row["id"]) for row in rows]

    def _list_items(self, plan_id: int) -> list[PlannedItemRead]:
        rows = self.connection.execute(
            """
            SELECT * FROM planned_items
            WHERE weekly_plan_id = ?
            ORDER BY priority, id
            """,
            (plan_id,),
        ).fetchall()
        return [validate_row(PlannedItemRead, row) for row in rows]


class TimeLogRepository:
    def __init__(self, connection: sqlite3.Connection, user_id: int) -> None:
        self.connection = connection
        self.user_id = user_id

    def create(self, time_log: TimeLogCreate) -> TimeLogRead:
        values = time_log.model_dump(mode="json")
        values["user_id"] = self.user_id
        cursor = self.connection.execute(
            """
            INSERT INTO time_logs (
                user_id, activity_id, project_id, date, start_time, end_time,
                duration_minutes, activity_name, activity_type, type_source, note
            ) VALUES (
                :user_id, :activity_id, :project_id, :date, :start_time, :end_time,
                :duration_minutes, :activity_name, :activity_type, :type_source, :note
            )
            """,
            values,
        )
        if time_log.project_id is not None:
            self.connection.execute(
                """
                UPDATE projects
                SET last_activity_date = CASE
                        WHEN last_activity_date IS NULL OR last_activity_date < :date THEN :date
                        ELSE last_activity_date
                    END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :project_id AND user_id = :user_id
                """,
                values,
            )
        return self.get(cursor.lastrowid)

    def get(self, time_log_id: int) -> TimeLogRead:
        row = self.connection.execute(
            "SELECT * FROM time_logs WHERE id = ? AND user_id = ?",
            (time_log_id, self.user_id),
        ).fetchone()
        return validate_row(TimeLogRead, require_row(row, "TimeLog", time_log_id))

    def list(self) -> list[TimeLogRead]:
        rows = self.connection.execute(
            "SELECT * FROM time_logs WHERE user_id = ? ORDER BY date, start_time, id",
            (self.user_id,),
        ).fetchall()
        return [validate_row(TimeLogRead, row) for row in rows]

    def list_between(self, start_date: str, end_date: str) -> list[TimeLogRead]:
        rows = self.connection.execute(
            """
            SELECT * FROM time_logs
            WHERE user_id = ? AND date BETWEEN ? AND ?
            ORDER BY date, start_time, id
            """,
            (self.user_id, start_date, end_date),
        ).fetchall()
        return [validate_row(TimeLogRead, row) for row in rows]
