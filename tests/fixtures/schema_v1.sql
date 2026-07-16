PRAGMA foreign_keys = ON;

CREATE TABLE goals (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    priority INTEGER NOT NULL DEFAULT 1,
    active_status INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    stage TEXT NOT NULL DEFAULT 'startup',
    deadline TEXT,
    weekly_min_minutes INTEGER NOT NULL DEFAULT 0,
    weekly_target_minutes INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    last_activity_date TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE activities (
    id INTEGER PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    activity_type TEXT NOT NULL,
    type_source TEXT NOT NULL DEFAULT 'user_selected',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE weekly_plans (
    id INTEGER PRIMARY KEY,
    week_start TEXT NOT NULL,
    week_end TEXT NOT NULL,
    planned_capacity_minutes INTEGER NOT NULL DEFAULT 0,
    slack_target_percent INTEGER NOT NULL DEFAULT 20,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (week_start, week_end)
);

CREATE TABLE planned_items (
    id INTEGER PRIMARY KEY,
    weekly_plan_id INTEGER NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    planned_minutes INTEGER NOT NULL,
    priority INTEGER NOT NULL DEFAULT 1,
    is_completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE time_logs (
    id INTEGER PRIMARY KEY,
    activity_id INTEGER REFERENCES activities(id) ON DELETE SET NULL,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    duration_minutes INTEGER NOT NULL,
    activity_name TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    type_source TEXT NOT NULL DEFAULT 'user_selected',
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE daily_reflections (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    small_win TEXT NOT NULL DEFAULT '',
    mood_note TEXT NOT NULL DEFAULT '',
    free_note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE weekly_reviews (
    id INTEGER PRIMARY KEY,
    week_start TEXT NOT NULL,
    week_end TEXT NOT NULL,
    wins_json TEXT NOT NULL,
    insights_json TEXT NOT NULL,
    next_steps_json TEXT NOT NULL,
    risk_flags_json TEXT NOT NULL,
    evidence_json TEXT NOT NULL,
    generated_text TEXT NOT NULL,
    model_name TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (week_start, week_end)
);

CREATE INDEX idx_projects_goal_id ON projects(goal_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_activities_project_id ON activities(project_id);
CREATE INDEX idx_activities_type ON activities(activity_type);
CREATE INDEX idx_weekly_plans_dates ON weekly_plans(week_start, week_end);
CREATE INDEX idx_planned_items_plan_id ON planned_items(weekly_plan_id);
CREATE INDEX idx_planned_items_project_id ON planned_items(project_id);
CREATE INDEX idx_time_logs_date ON time_logs(date);
CREATE INDEX idx_time_logs_project_id ON time_logs(project_id);
CREATE INDEX idx_time_logs_activity_id ON time_logs(activity_id);
CREATE INDEX idx_time_logs_activity_type ON time_logs(activity_type);
CREATE INDEX idx_weekly_reviews_dates ON weekly_reviews(week_start, week_end);

PRAGMA user_version = 1;
