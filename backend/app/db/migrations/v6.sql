CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
    priority INTEGER NOT NULL DEFAULT 3 CHECK (priority >= 1),
    estimated_minutes INTEGER CHECK (estimated_minutes IS NULL OR estimated_minutes > 0),
    due_date TEXT,
    created_source TEXT NOT NULL DEFAULT 'user'
        CHECK (created_source IN ('user', 'assistant_approved', 'imported')),
    completed_at TEXT,
    archived_at TEXT,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CHECK (
        (status = 'completed' AND completed_at IS NOT NULL)
        OR (status != 'completed' AND completed_at IS NULL)
    )
);

CREATE TABLE IF NOT EXISTS focus_sessions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_id INTEGER NOT NULL REFERENCES activities(id),
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    activity_name TEXT NOT NULL CHECK (length(trim(activity_name)) > 0),
    activity_type TEXT NOT NULL
        CHECK (activity_type IN ('consuming', 'neutral', 'restore', 'destroy')),
    type_source TEXT NOT NULL
        CHECK (type_source IN ('user_selected', 'ai_suggested', 'user_corrected')),
    task_title TEXT,
    timezone TEXT NOT NULL CHECK (length(trim(timezone)) > 0),
    status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'completed', 'cancelled')),
    accumulated_seconds INTEGER NOT NULL DEFAULT 0
        CHECK (accumulated_seconds >= 0),
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    started_at TEXT NOT NULL,
    completed_at TEXT,
    cancelled_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (
        (
            status = 'running'
            AND accumulated_seconds = 0
            AND completed_at IS NULL
            AND cancelled_at IS NULL
        )
        OR (
            status = 'completed'
            AND accumulated_seconds > 0
            AND completed_at IS NOT NULL
            AND cancelled_at IS NULL
        )
        OR (
            status = 'cancelled'
            AND accumulated_seconds = 0
            AND completed_at IS NULL
            AND cancelled_at IS NOT NULL
        )
    )
);

CREATE TABLE IF NOT EXISTS focus_session_segments (
    id INTEGER PRIMARY KEY,
    focus_session_id INTEGER NOT NULL
        REFERENCES focus_sessions(id) ON DELETE CASCADE,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    created_at TEXT NOT NULL,
    CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE TABLE IF NOT EXISTS idempotency_receipts (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    idempotency_key TEXT NOT NULL CHECK (length(trim(idempotency_key)) > 0),
    operation TEXT NOT NULL CHECK (length(trim(operation)) > 0),
    request_hash TEXT NOT NULL CHECK (length(request_hash) = 64),
    status TEXT NOT NULL
        CHECK (status IN ('in_progress', 'completed', 'failed')),
    response_status INTEGER,
    response_json TEXT CHECK (
        response_json IS NULL OR json_valid(response_json)
    ),
    created_at TEXT NOT NULL,
    expires_at TEXT,
    UNIQUE (user_id, idempotency_key),
    CHECK (
        status != 'completed'
        OR (response_status IS NOT NULL AND response_json IS NOT NULL)
    )
);

DROP TRIGGER IF EXISTS time_logs_project_same_user_insert;
DROP TRIGGER IF EXISTS time_logs_project_same_user_update;
DROP TRIGGER IF EXISTS time_logs_task_same_user_insert;
DROP TRIGGER IF EXISTS time_logs_task_same_user_update;
DROP TRIGGER IF EXISTS time_logs_activity_same_user_insert;
DROP TRIGGER IF EXISTS time_logs_activity_same_user_update;

DROP INDEX IF EXISTS idx_time_logs_date;
DROP INDEX IF EXISTS idx_time_logs_project_id;
DROP INDEX IF EXISTS idx_time_logs_activity_id;
DROP INDEX IF EXISTS idx_time_logs_task_id;
DROP INDEX IF EXISTS idx_time_logs_activity_type;

ALTER TABLE time_logs RENAME TO time_logs_v5;

CREATE TABLE time_logs (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_id INTEGER REFERENCES activities(id) ON DELETE SET NULL,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    focus_session_id INTEGER REFERENCES focus_sessions(id) ON DELETE SET NULL,
    date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes >= 0),
    duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
    activity_name TEXT NOT NULL CHECK (length(trim(activity_name)) > 0),
    activity_type TEXT NOT NULL
        CHECK (activity_type IN ('consuming', 'neutral', 'restore', 'destroy')),
    type_source TEXT NOT NULL DEFAULT 'user_selected'
        CHECK (type_source IN ('user_selected', 'ai_suggested', 'user_corrected')),
    task_title TEXT,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (start_time IS NULL AND end_time IS NULL)
        OR (start_time IS NOT NULL AND end_time IS NOT NULL)
    )
);

INSERT INTO time_logs (
    id, user_id, activity_id, project_id, task_id, focus_session_id,
    date, start_time, end_time, duration_minutes, duration_seconds,
    activity_name, activity_type, type_source, task_title, note,
    created_at, updated_at
)
SELECT
    id, user_id, activity_id, project_id, task_id, NULL,
    date, start_time, end_time, duration_minutes, duration_minutes * 60,
    activity_name, activity_type, type_source, task_title, note,
    created_at, updated_at
FROM time_logs_v5;

DROP TABLE time_logs_v5;
