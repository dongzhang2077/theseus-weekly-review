CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
    timezone TEXT NOT NULL DEFAULT 'UTC' CHECK (length(trim(timezone)) > 0),
    locale TEXT NOT NULL DEFAULT 'en' CHECK (length(trim(locale)) > 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_credentials (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL UNIQUE CHECK (length(subject) >= 32),
    email TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(email)) > 3),
    password_hash TEXT NOT NULL CHECK (length(password_hash) > 20),
    failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
    locked_until TEXT,
    password_changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY CHECK (length(id) >= 32),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
    csrf_hash TEXT NOT NULL CHECK (length(csrf_hash) = 64),
    expires_at TEXT NOT NULL,
    user_agent TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TEXT,
    replaced_by_id TEXT REFERENCES auth_sessions(id) ON DELETE SET NULL,
    CHECK (datetime(expires_at) > datetime(created_at))
);

CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    description TEXT NOT NULL DEFAULT '',
    priority INTEGER NOT NULL DEFAULT 1 CHECK (priority >= 1),
    active_status INTEGER NOT NULL DEFAULT 1 CHECK (active_status IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    stage TEXT NOT NULL DEFAULT 'startup' CHECK (stage IN ('startup', 'stable', 'sprint', 'dormant', 'wake_up')),
    deadline TEXT,
    weekly_min_minutes INTEGER NOT NULL DEFAULT 0 CHECK (weekly_min_minutes >= 0),
    weekly_target_minutes INTEGER NOT NULL DEFAULT 0 CHECK (weekly_target_minutes >= 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    last_activity_date TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    description TEXT NOT NULL DEFAULT '',
    activity_type TEXT NOT NULL CHECK (activity_type IN ('consuming', 'neutral', 'restore', 'destroy')),
    type_source TEXT NOT NULL DEFAULT 'user_selected' CHECK (type_source IN ('user_selected', 'ai_suggested', 'user_corrected')),
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS weekly_plans (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start TEXT NOT NULL,
    week_end TEXT NOT NULL,
    planned_capacity_minutes INTEGER NOT NULL DEFAULT 0 CHECK (planned_capacity_minutes >= 0),
    slack_target_percent INTEGER NOT NULL DEFAULT 20 CHECK (slack_target_percent BETWEEN 0 AND 100),
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, week_start, week_end),
    CHECK (week_end >= week_start)
);

CREATE TABLE IF NOT EXISTS planned_items (
    id INTEGER PRIMARY KEY,
    weekly_plan_id INTEGER NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    planned_minutes INTEGER NOT NULL CHECK (planned_minutes > 0),
    priority INTEGER NOT NULL DEFAULT 1 CHECK (priority >= 1),
    is_completed INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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

CREATE TABLE IF NOT EXISTS time_logs (
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
    activity_type TEXT NOT NULL CHECK (activity_type IN ('consuming', 'neutral', 'restore', 'destroy')),
    type_source TEXT NOT NULL DEFAULT 'user_selected' CHECK (type_source IN ('user_selected', 'ai_suggested', 'user_corrected')),
    task_title TEXT,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ((start_time IS NULL AND end_time IS NULL) OR (start_time IS NOT NULL AND end_time IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS daily_reflections (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    small_win TEXT NOT NULL DEFAULT '',
    mood_note TEXT NOT NULL DEFAULT '',
    free_note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS weekly_reviews (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start TEXT NOT NULL,
    week_end TEXT NOT NULL,
    wins_json TEXT NOT NULL CHECK (json_valid(wins_json)),
    insights_json TEXT NOT NULL CHECK (json_valid(insights_json)),
    next_steps_json TEXT NOT NULL CHECK (json_valid(next_steps_json)),
    risk_flags_json TEXT NOT NULL CHECK (json_valid(risk_flags_json)),
    evidence_json TEXT NOT NULL CHECK (json_valid(evidence_json)),
    generated_text TEXT NOT NULL,
    model_name TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, week_start, week_end),
    CHECK (week_end >= week_start)
);

CREATE INDEX IF NOT EXISTS idx_goals_user_priority ON goals(user_id, priority, id);
CREATE INDEX IF NOT EXISTS idx_auth_credentials_email ON auth_credentials(email COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id, id);
CREATE INDEX IF NOT EXISTS idx_projects_goal_id ON projects(goal_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status, archived_at);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id, id);
CREATE INDEX IF NOT EXISTS idx_activities_project_id ON activities(project_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(user_id, activity_type);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_dates ON weekly_plans(user_id, week_start, week_end);
CREATE INDEX IF NOT EXISTS idx_planned_items_plan_id ON planned_items(weekly_plan_id);
CREATE INDEX IF NOT EXISTS idx_planned_items_project_id ON planned_items(project_id);
CREATE INDEX IF NOT EXISTS idx_planned_items_task_id ON planned_items(task_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_focus_sessions_running_activity
ON focus_sessions(user_id, activity_id)
WHERE status = 'running';
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_status
ON focus_sessions(user_id, status, started_at, id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_focus_segments_open
ON focus_session_segments(focus_session_id)
WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_focus_segments_session
ON focus_session_segments(focus_session_id, started_at, id);
CREATE INDEX IF NOT EXISTS idx_idempotency_receipts_user
ON idempotency_receipts(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_time_logs_date ON time_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_time_logs_project_id ON time_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_activity_id ON time_logs(activity_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_task_id ON time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_focus_session_id
ON time_logs(focus_session_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_time_logs_focus_session_date
ON time_logs(focus_session_id, date)
WHERE focus_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_time_logs_activity_type ON time_logs(user_id, activity_type);
CREATE INDEX IF NOT EXISTS idx_daily_reflections_date ON daily_reflections(user_id, date);
CREATE INDEX IF NOT EXISTS idx_weekly_reviews_dates ON weekly_reviews(user_id, week_start, week_end);

CREATE TRIGGER IF NOT EXISTS projects_goal_same_user_insert
BEFORE INSERT ON projects
WHEN NEW.goal_id IS NOT NULL
     AND NOT EXISTS (
         SELECT 1 FROM goals
         WHERE id = NEW.goal_id AND user_id = NEW.user_id
     )
BEGIN
    SELECT RAISE(ABORT, 'project goal must belong to the same user');
END;

CREATE TRIGGER IF NOT EXISTS projects_goal_same_user_update
BEFORE UPDATE OF goal_id, user_id ON projects
WHEN NEW.goal_id IS NOT NULL
     AND NOT EXISTS (
         SELECT 1 FROM goals
         WHERE id = NEW.goal_id AND user_id = NEW.user_id
     )
BEGIN
    SELECT RAISE(ABORT, 'project goal must belong to the same user');
END;

CREATE TRIGGER IF NOT EXISTS activities_project_same_user_insert
BEFORE INSERT ON activities
WHEN NEW.project_id IS NOT NULL
     AND NOT EXISTS (
         SELECT 1 FROM projects
         WHERE id = NEW.project_id AND user_id = NEW.user_id
     )
BEGIN
    SELECT RAISE(ABORT, 'activity project must belong to the same user');
END;

CREATE TRIGGER IF NOT EXISTS activities_project_same_user_update
BEFORE UPDATE OF project_id, user_id ON activities
WHEN NEW.project_id IS NOT NULL
     AND NOT EXISTS (
         SELECT 1 FROM projects
         WHERE id = NEW.project_id AND user_id = NEW.user_id
     )
BEGIN
    SELECT RAISE(ABORT, 'activity project must belong to the same user');
END;

CREATE TRIGGER IF NOT EXISTS tasks_project_same_user_insert
BEFORE INSERT ON tasks
WHEN NOT EXISTS (
    SELECT 1 FROM projects
    WHERE id = NEW.project_id AND user_id = NEW.user_id
)
BEGIN
    SELECT RAISE(ABORT, 'task project must belong to the same user');
END;

CREATE TRIGGER IF NOT EXISTS tasks_project_same_user_update
BEFORE UPDATE OF project_id, user_id ON tasks
WHEN NOT EXISTS (
    SELECT 1 FROM projects
    WHERE id = NEW.project_id AND user_id = NEW.user_id
)
BEGIN
    SELECT RAISE(ABORT, 'task project must belong to the same user');
END;

CREATE TRIGGER IF NOT EXISTS planned_items_project_same_user_insert
BEFORE INSERT ON planned_items
WHEN NEW.project_id IS NOT NULL
     AND NOT EXISTS (
         SELECT 1
         FROM weekly_plans AS plan
         JOIN projects AS project ON project.id = NEW.project_id
         WHERE plan.id = NEW.weekly_plan_id
           AND plan.user_id = project.user_id
     )
BEGIN
    SELECT RAISE(ABORT, 'planned item project must belong to the plan user');
END;

CREATE TRIGGER IF NOT EXISTS planned_items_project_same_user_update
BEFORE UPDATE OF weekly_plan_id, project_id ON planned_items
WHEN NEW.project_id IS NOT NULL
     AND NOT EXISTS (
         SELECT 1
         FROM weekly_plans AS plan
         JOIN projects AS project ON project.id = NEW.project_id
         WHERE plan.id = NEW.weekly_plan_id
           AND plan.user_id = project.user_id
     )
BEGIN
    SELECT RAISE(ABORT, 'planned item project must belong to the plan user');
END;

CREATE TRIGGER IF NOT EXISTS planned_items_task_same_user_insert
BEFORE INSERT ON planned_items
WHEN NEW.task_id IS NOT NULL
     AND NOT EXISTS (
         SELECT 1
         FROM weekly_plans AS plan
         JOIN tasks AS task ON task.id = NEW.task_id
         WHERE plan.id = NEW.weekly_plan_id
           AND plan.user_id = task.user_id
           AND NEW.project_id = task.project_id
     )
BEGIN
    SELECT RAISE(ABORT, 'planned item task must match the plan user and project');
END;

CREATE TRIGGER IF NOT EXISTS planned_items_task_same_user_update
BEFORE UPDATE OF weekly_plan_id, project_id, task_id ON planned_items
WHEN NEW.task_id IS NOT NULL
     AND NOT EXISTS (
         SELECT 1
         FROM weekly_plans AS plan
         JOIN tasks AS task ON task.id = NEW.task_id
         WHERE plan.id = NEW.weekly_plan_id
           AND plan.user_id = task.user_id
           AND NEW.project_id = task.project_id
     )
BEGIN
    SELECT RAISE(ABORT, 'planned item task must match the plan user and project');
END;

CREATE TRIGGER IF NOT EXISTS focus_sessions_activity_same_user_insert
BEFORE INSERT ON focus_sessions
WHEN NOT EXISTS (
    SELECT 1 FROM activities
    WHERE id = NEW.activity_id AND user_id = NEW.user_id
)
BEGIN
    SELECT RAISE(ABORT, 'focus activity must belong to the same user');
END;

CREATE TRIGGER IF NOT EXISTS focus_sessions_activity_same_user_update
BEFORE UPDATE OF activity_id, user_id ON focus_sessions
WHEN NOT EXISTS (
    SELECT 1 FROM activities
    WHERE id = NEW.activity_id AND user_id = NEW.user_id
)
BEGIN
    SELECT RAISE(ABORT, 'focus activity must belong to the same user');
END;

CREATE TRIGGER IF NOT EXISTS focus_sessions_project_same_user_insert
BEFORE INSERT ON focus_sessions
WHEN NEW.project_id IS NOT NULL
     AND NOT EXISTS (
         SELECT 1 FROM projects
         WHERE id = NEW.project_id AND user_id = NEW.user_id
     )
BEGIN
    SELECT RAISE(ABORT, 'focus project must belong to the same user');
END;

CREATE TRIGGER IF NOT EXISTS focus_sessions_project_same_user_update
BEFORE UPDATE OF project_id, user_id ON focus_sessions
WHEN NEW.project_id IS NOT NULL
     AND NOT EXISTS (
         SELECT 1 FROM projects
         WHERE id = NEW.project_id AND user_id = NEW.user_id
     )
BEGIN
    SELECT RAISE(ABORT, 'focus project must belong to the same user');
END;

CREATE TRIGGER IF NOT EXISTS focus_sessions_task_same_user_insert
BEFORE INSERT ON focus_sessions
WHEN NEW.task_id IS NOT NULL
     AND NOT EXISTS (
         SELECT 1
         FROM tasks AS task
         JOIN activities AS activity ON activity.id = NEW.activity_id
         WHERE task.id = NEW.task_id
           AND task.user_id = NEW.user_id
           AND task.project_id = NEW.project_id
           AND activity.user_id = NEW.user_id
           AND (activity.project_id IS NULL OR activity.project_id = task.project_id)
     )
BEGIN
    SELECT RAISE(ABORT, 'focus task must match the same user and project');
END;

CREATE TRIGGER IF NOT EXISTS focus_sessions_task_same_user_update
BEFORE UPDATE OF task_id, project_id, activity_id, user_id ON focus_sessions
WHEN NEW.task_id IS NOT NULL
     AND NOT EXISTS (
         SELECT 1
         FROM tasks AS task
         JOIN activities AS activity ON activity.id = NEW.activity_id
         WHERE task.id = NEW.task_id
           AND task.user_id = NEW.user_id
           AND task.project_id = NEW.project_id
           AND activity.user_id = NEW.user_id
           AND (activity.project_id IS NULL OR activity.project_id = task.project_id)
     )
BEGIN
    SELECT RAISE(ABORT, 'focus task must match the same user and project');
END;

CREATE TRIGGER IF NOT EXISTS focus_sessions_activity_project_insert
BEFORE INSERT ON focus_sessions
WHEN NEW.task_id IS NULL
     AND NOT EXISTS (
         SELECT 1
         FROM activities
         WHERE id = NEW.activity_id
           AND user_id = NEW.user_id
           AND project_id IS NEW.project_id
     )
BEGIN
    SELECT RAISE(ABORT, 'focus project must match the activity project');
END;

CREATE TRIGGER IF NOT EXISTS focus_sessions_activity_project_update
BEFORE UPDATE OF task_id, project_id, activity_id, user_id ON focus_sessions
WHEN NEW.task_id IS NULL
     AND NOT EXISTS (
         SELECT 1
         FROM activities
         WHERE id = NEW.activity_id
           AND user_id = NEW.user_id
           AND project_id IS NEW.project_id
     )
BEGIN
    SELECT RAISE(ABORT, 'focus project must match the activity project');
END;

CREATE TRIGGER IF NOT EXISTS time_logs_project_same_user_insert
BEFORE INSERT ON time_logs
WHEN NEW.project_id IS NOT NULL
     AND NOT EXISTS (
         SELECT 1 FROM projects
         WHERE id = NEW.project_id AND user_id = NEW.user_id
     )
BEGIN
    SELECT RAISE(ABORT, 'time log project must belong to the same user');
END;

CREATE TRIGGER IF NOT EXISTS time_logs_task_same_user_insert
BEFORE INSERT ON time_logs
WHEN NEW.task_id IS NOT NULL
     AND NOT EXISTS (
         SELECT 1 FROM tasks
         WHERE id = NEW.task_id
           AND user_id = NEW.user_id
           AND project_id = NEW.project_id
     )
BEGIN
    SELECT RAISE(ABORT, 'time log task must match the same user and project');
END;

CREATE TRIGGER IF NOT EXISTS time_logs_task_same_user_update
BEFORE UPDATE OF task_id, project_id, user_id ON time_logs
WHEN NEW.task_id IS NOT NULL
     AND NOT EXISTS (
         SELECT 1 FROM tasks
         WHERE id = NEW.task_id
           AND user_id = NEW.user_id
           AND project_id = NEW.project_id
     )
BEGIN
    SELECT RAISE(ABORT, 'time log task must match the same user and project');
END;

CREATE TRIGGER IF NOT EXISTS time_logs_project_same_user_update
BEFORE UPDATE OF project_id, user_id ON time_logs
WHEN NEW.project_id IS NOT NULL
     AND NOT EXISTS (
         SELECT 1 FROM projects
         WHERE id = NEW.project_id AND user_id = NEW.user_id
     )
BEGIN
    SELECT RAISE(ABORT, 'time log project must belong to the same user');
END;

CREATE TRIGGER IF NOT EXISTS time_logs_activity_same_user_insert
BEFORE INSERT ON time_logs
WHEN NEW.activity_id IS NOT NULL
     AND NOT EXISTS (
         SELECT 1 FROM activities
         WHERE id = NEW.activity_id AND user_id = NEW.user_id
     )
BEGIN
    SELECT RAISE(ABORT, 'time log activity must belong to the same user');
END;

CREATE TRIGGER IF NOT EXISTS time_logs_activity_same_user_update
BEFORE UPDATE OF activity_id, user_id ON time_logs
WHEN NEW.activity_id IS NOT NULL
     AND NOT EXISTS (
         SELECT 1 FROM activities
         WHERE id = NEW.activity_id AND user_id = NEW.user_id
     )
BEGIN
    SELECT RAISE(ABORT, 'time log activity must belong to the same user');
END;

CREATE TRIGGER IF NOT EXISTS time_logs_focus_same_user_insert
BEFORE INSERT ON time_logs
WHEN NEW.focus_session_id IS NOT NULL
     AND NOT EXISTS (
         SELECT 1
         FROM focus_sessions
         WHERE id = NEW.focus_session_id
           AND user_id = NEW.user_id
           AND activity_id IS NEW.activity_id
           AND task_id IS NEW.task_id
           AND project_id IS NEW.project_id
     )
BEGIN
    SELECT RAISE(ABORT, 'time log focus provenance must match the same user');
END;

CREATE TRIGGER IF NOT EXISTS time_logs_focus_same_user_update
BEFORE UPDATE OF focus_session_id, user_id, activity_id, task_id, project_id
ON time_logs
WHEN NEW.focus_session_id IS NOT NULL
     AND NOT EXISTS (
         SELECT 1
         FROM focus_sessions
         WHERE id = NEW.focus_session_id
           AND user_id = NEW.user_id
           AND activity_id IS NEW.activity_id
           AND task_id IS NEW.task_id
           AND project_id IS NEW.project_id
     )
BEGIN
    SELECT RAISE(ABORT, 'time log focus provenance must match the same user');
END;

PRAGMA user_version = 6;
