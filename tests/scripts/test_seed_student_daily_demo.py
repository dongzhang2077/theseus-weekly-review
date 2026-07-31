from datetime import date

from scripts.seed_student_daily_demo import (
    STUDENT_WEEK,
    remove_student_week,
    seed_student_week,
)


def test_student_demo_seed_is_idempotent_and_removable(connection, local_user) -> None:
    first = seed_student_week(connection, local_user.id, date(2026, 7, 27))
    second = seed_student_week(connection, local_user.id, date(2026, 7, 27))

    assert first.time_logs_created == len(STUDENT_WEEK)
    assert first.projects_created == 3
    assert first.activities_created == 9
    assert first.already_present is False
    assert second.time_logs_created == 0
    assert second.already_present is True

    rows = connection.execute(
        """
        SELECT date, SUM(duration_minutes) AS minutes
        FROM time_logs
        WHERE user_id = ? AND deleted_at IS NULL
        GROUP BY date
        ORDER BY date
        """,
        (local_user.id,),
    ).fetchall()
    assert [(row["date"], row["minutes"]) for row in rows] == [
        ("2026-07-27", 960),
        ("2026-07-28", 1085),
        ("2026-07-29", 945),
        ("2026-07-30", 1050),
    ]

    assert remove_student_week(
        connection, local_user.id, date(2026, 7, 27)
    ) == len(STUDENT_WEEK)
    remaining = connection.execute(
        "SELECT COUNT(*) FROM time_logs WHERE user_id = ?",
        (local_user.id,),
    ).fetchone()[0]
    assert remaining == 0


def test_student_demo_seed_requires_monday(connection, local_user) -> None:
    try:
        seed_student_week(connection, local_user.id, date(2026, 7, 28))
    except ValueError as exc:
        assert str(exc) == "week_start must be a Monday"
    else:
        raise AssertionError("non-Monday week_start should fail")
