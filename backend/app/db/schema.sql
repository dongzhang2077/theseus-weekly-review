CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    description TEXT NOT NULL DEFAULT '',
    priority INTEGER NOT NULL DEFAULT 1 CHECK (priority >= 1),
    active_status INTEGER NOT NULL DEFAULT 1 CHECK (active_status IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    description TEXT NOT NULL DEFAULT '',
    activity_type TEXT NOT NULL CHECK (activity_type IN ('consuming', 'neutral', 'restore', 'destroy')),
    type_source TEXT NOT NULL DEFAULT 'user_selected' CHECK (type_source IN ('user_selected', 'ai_suggested', 'user_corrected')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS weekly_plans (
    id INTEGER PRIMARY KEY,
    week_start TEXT NOT NULL,
    week_end TEXT NOT NULL,
    planned_capacity_minutes INTEGER NOT NULL DEFAULT 0 CHECK (planned_capacity_minutes >= 0),
    slack_target_percent INTEGER NOT NULL DEFAULT 20 CHECK (slack_target_percent BETWEEN 0 AND 100),
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (week_start, week_end),
    CHECK (week_end >= week_start)
);

CREATE TABLE IF NOT EXISTS planned_items (
    id INTEGER PRIMARY KEY,
    weekly_plan_id INTEGER NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    planned_minutes INTEGER NOT NULL CHECK (planned_minutes > 0),
    priority INTEGER NOT NULL DEFAULT 1 CHECK (priority >= 1),
    is_completed INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS time_logs (
    id INTEGER PRIMARY KEY,
    activity_id INTEGER REFERENCES activities(id) ON DELETE SET NULL,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    activity_name TEXT NOT NULL CHECK (length(trim(activity_name)) > 0),
    activity_type TEXT NOT NULL CHECK (activity_type IN ('consuming', 'neutral', 'restore', 'destroy')),
    type_source TEXT NOT NULL DEFAULT 'user_selected' CHECK (type_source IN ('user_selected', 'ai_suggested', 'user_corrected')),
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ((start_time IS NULL AND end_time IS NULL) OR (start_time IS NOT NULL AND end_time IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS daily_reflections (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    small_win TEXT NOT NULL DEFAULT '',
    mood_note TEXT NOT NULL DEFAULT '',
    free_note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS weekly_reviews (
    id INTEGER PRIMARY KEY,
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
    UNIQUE (week_start, week_end),
    CHECK (week_end >= week_start)
);

CREATE INDEX IF NOT EXISTS idx_projects_goal_id ON projects(goal_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_activities_project_id ON activities(project_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_dates ON weekly_plans(week_start, week_end);
CREATE INDEX IF NOT EXISTS idx_planned_items_plan_id ON planned_items(weekly_plan_id);
CREATE INDEX IF NOT EXISTS idx_planned_items_project_id ON planned_items(project_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_date ON time_logs(date);
CREATE INDEX IF NOT EXISTS idx_time_logs_project_id ON time_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_activity_id ON time_logs(activity_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_activity_type ON time_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_weekly_reviews_dates ON weekly_reviews(week_start, week_end);
