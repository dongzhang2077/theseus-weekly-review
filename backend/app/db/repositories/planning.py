from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Any

from ...schemas import (
    ActivityType,
    ActivityTypeSource,
    PlannedItemCreate,
    PlannedItemRead,
    TimeLogCreate,
    TimeLogRead,
    WeeklyPlanCreate,
    WeeklyPlanRead,
)
from ._common import require_row, validate_row


@dataclass(frozen=True)
class FocusTimeLogInsert:
    focus_session_id: int
    activity_id: int
    project_id: int | None
    task_id: int | None
    date: str
    start_time: str
    end_time: str
    duration_minutes: int
    duration_seconds: int
    activity_name: str
    activity_type: ActivityType
    type_source: ActivityTypeSource
    task_title: str | None
    note: str = ""


@dataclass(frozen=True)
class StoredTimeLogRevision:
    id: int
    user_id: int
    time_log_id: int
    action: str
    before_json: str
    after_json: str
    actor_type: str
    reason: str
    created_at: str


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
                weekly_plan_id, project_id, task_id, title, planned_minutes,
                priority, is_completed
            ) VALUES (
                :weekly_plan_id, :project_id, :task_id, :title, :planned_minutes,
                :priority, :is_completed
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
        values["task_title"] = None
        values["focus_session_id"] = None
        values["duration_seconds"] = time_log.duration_minutes * 60
        if time_log.task_id is not None:
            task = self.connection.execute(
                """
                SELECT project_id, title
                FROM tasks
                WHERE id = ? AND user_id = ?
                """,
                (time_log.task_id, self.user_id),
            ).fetchone()
            if task is None:
                raise sqlite3.IntegrityError(
                    "time log task must belong to the same user"
                )
            if values["project_id"] is None:
                values["project_id"] = task["project_id"]
            elif values["project_id"] != task["project_id"]:
                raise sqlite3.IntegrityError(
                    "time log task must match the project"
                )
            values["task_title"] = task["title"]
        cursor = self.connection.execute(
            """
            INSERT INTO time_logs (
                user_id, activity_id, project_id, task_id, focus_session_id,
                date, start_time, end_time, duration_minutes, duration_seconds,
                activity_name, activity_type, type_source, task_title, note
            ) VALUES (
                :user_id, :activity_id, :project_id, :task_id,
                :focus_session_id, :date, :start_time, :end_time,
                :duration_minutes, :duration_seconds, :activity_name,
                :activity_type, :type_source, :task_title, :note
            )
            """,
            values,
        )
        self._update_project_last_activity(values["project_id"], values["date"])
        self.invalidate_reviews_for_dates({values["date"]})
        return self.get(cursor.lastrowid)

    def create_from_focus(self, time_log: FocusTimeLogInsert) -> TimeLogRead:
        values = {**time_log.__dict__, "user_id": self.user_id}
        cursor = self.connection.execute(
            """
            INSERT INTO time_logs (
                user_id, activity_id, project_id, task_id, focus_session_id,
                date, start_time, end_time, duration_minutes, duration_seconds,
                activity_name, activity_type, type_source, task_title, note
            ) VALUES (
                :user_id, :activity_id, :project_id, :task_id,
                :focus_session_id, :date, :start_time, :end_time,
                :duration_minutes, :duration_seconds, :activity_name,
                :activity_type, :type_source, :task_title, :note
            )
            """,
            values,
        )
        self._update_project_last_activity(time_log.project_id, time_log.date)
        self.invalidate_reviews_for_dates({time_log.date})
        return self.get(cursor.lastrowid)

    def get(self, time_log_id: int, *, include_deleted: bool = False) -> TimeLogRead:
        deleted_clause = "" if include_deleted else "AND deleted_at IS NULL"
        row = self.connection.execute(
            f"""
            SELECT * FROM time_logs
            WHERE id = ? AND user_id = ? {deleted_clause}
            """,
            (time_log_id, self.user_id),
        ).fetchone()
        return validate_row(TimeLogRead, require_row(row, "TimeLog", time_log_id))

    def list(
        self,
        *,
        date_from: str | None = None,
        date_to: str | None = None,
        project_id: int | None = None,
        task_id: int | None = None,
        activity_id: int | None = None,
        include_deleted: bool = False,
    ) -> list[TimeLogRead]:
        clauses = ["user_id = :user_id"]
        values: dict[str, object] = {"user_id": self.user_id}
        for field, value in (
            ("project_id", project_id),
            ("task_id", task_id),
            ("activity_id", activity_id),
        ):
            if value is not None:
                clauses.append(f"{field} = :{field}")
                values[field] = value
        if date_from is not None:
            clauses.append("date >= :date_from")
            values["date_from"] = date_from
        if date_to is not None:
            clauses.append("date <= :date_to")
            values["date_to"] = date_to
        if not include_deleted:
            clauses.append("deleted_at IS NULL")
        rows = self.connection.execute(
            f"""
            SELECT * FROM time_logs
            WHERE {' AND '.join(clauses)}
            ORDER BY date, start_time, id
            """,
            values,
        ).fetchall()
        return [validate_row(TimeLogRead, row) for row in rows]

    def list_between(self, start_date: str, end_date: str) -> list[TimeLogRead]:
        rows = self.connection.execute(
            """
            SELECT * FROM time_logs
            WHERE user_id = ? AND date BETWEEN ? AND ?
              AND deleted_at IS NULL
            ORDER BY date, start_time, id
            """,
            (self.user_id, start_date, end_date),
        ).fetchall()
        return [validate_row(TimeLogRead, row) for row in rows]

    def update_if_version(
        self,
        time_log_id: int,
        expected_version: int,
        updates: dict[str, Any],
    ) -> TimeLogRead | None:
        allowed = {
            "activity_id",
            "project_id",
            "task_id",
            "date",
            "start_time",
            "end_time",
            "duration_minutes",
            "duration_seconds",
            "activity_name",
            "activity_type",
            "type_source",
            "task_title",
            "note",
            "deleted_at",
        }
        if not updates or not set(updates) <= allowed:
            raise ValueError("TimeLog update contains unsupported fields")
        assignments = [f"{field} = :{field}" for field in updates]
        assignments.extend(
            (
                "version = version + 1",
                "updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
            )
        )
        values = {
            **updates,
            "id": time_log_id,
            "user_id": self.user_id,
            "expected_version": expected_version,
        }
        cursor = self.connection.execute(
            f"""
            UPDATE time_logs
            SET {', '.join(assignments)}
            WHERE id = :id
              AND user_id = :user_id
              AND version = :expected_version
            """,
            values,
        )
        if cursor.rowcount != 1:
            return None
        return self.get(time_log_id, include_deleted=True)

    def append_revision(
        self,
        *,
        time_log_id: int,
        action: str,
        before: TimeLogRead,
        after: TimeLogRead,
        reason: str = "",
        actor_type: str = "user",
    ) -> int:
        cursor = self.connection.execute(
            """
            INSERT INTO time_log_revisions (
                user_id, time_log_id, action, before_json, after_json,
                actor_type, reason
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                self.user_id,
                time_log_id,
                action,
                before.model_dump_json(),
                after.model_dump_json(),
                actor_type,
                reason,
            ),
        )
        return int(cursor.lastrowid)

    def get_revision(self, time_log_id: int, revision_id: int) -> StoredTimeLogRevision:
        row = self.connection.execute(
            """
            SELECT *
            FROM time_log_revisions
            WHERE id = ? AND time_log_id = ? AND user_id = ?
            """,
            (revision_id, time_log_id, self.user_id),
        ).fetchone()
        if row is None:
            raise LookupError(f"TimeLog revision {revision_id} was not found")
        return StoredTimeLogRevision(**dict(row))

    def recalculate_project_last_activity(self, project_id: int | None) -> None:
        if project_id is None:
            return
        self.connection.execute(
            """
            UPDATE projects
            SET last_activity_date = (
                    SELECT MAX(date)
                    FROM time_logs
                    WHERE user_id = :user_id
                      AND project_id = :project_id
                      AND deleted_at IS NULL
                ),
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = :project_id AND user_id = :user_id
            """,
            {"project_id": project_id, "user_id": self.user_id},
        )

    def invalidate_reviews_for_dates(
        self,
        dates: set[str],
    ) -> list[dict[str, str]]:
        affected: dict[tuple[str, str], dict[str, str]] = {}
        for log_date in dates:
            rows = self.connection.execute(
                """
                SELECT week_start, week_end
                FROM weekly_reviews
                WHERE user_id = ?
                  AND ? BETWEEN week_start AND week_end
                ORDER BY week_start, week_end
                """,
                (self.user_id, log_date),
            ).fetchall()
            for row in rows:
                key = (row["week_start"], row["week_end"])
                affected[key] = {
                    "week_start": row["week_start"],
                    "week_end": row["week_end"],
                }
        if affected:
            for week_start, week_end in affected:
                self.connection.execute(
                    """
                    UPDATE weekly_reviews
                    SET stale_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                    WHERE user_id = ? AND week_start = ? AND week_end = ?
                    """,
                    (self.user_id, week_start, week_end),
                )
        return list(affected.values())

    def _update_project_last_activity(
        self,
        project_id: int | None,
        log_date: str,
    ) -> None:
        if project_id is None:
            return
        self.connection.execute(
            """
            UPDATE projects
            SET last_activity_date = CASE
                    WHEN last_activity_date IS NULL OR last_activity_date < :date
                        THEN :date
                    ELSE last_activity_date
                END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :project_id AND user_id = :user_id
            """,
            {
                "project_id": project_id,
                "user_id": self.user_id,
                "date": log_date,
            },
        )
