ALTER TABLE time_logs
ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1);

ALTER TABLE time_logs
ADD COLUMN deleted_at TEXT;

ALTER TABLE weekly_reviews
ADD COLUMN stale_at TEXT;

CREATE TABLE time_log_revisions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    time_log_id INTEGER NOT NULL REFERENCES time_logs(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('update', 'delete', 'restore', 'undo')),
    before_json TEXT NOT NULL CHECK (json_valid(before_json)),
    after_json TEXT NOT NULL CHECK (json_valid(after_json)),
    actor_type TEXT NOT NULL DEFAULT 'user'
        CHECK (actor_type IN ('user', 'assistant_approved')),
    reason TEXT NOT NULL DEFAULT '' CHECK (length(reason) <= 1000),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_time_log_revisions_log
ON time_log_revisions(user_id, time_log_id, id);

CREATE INDEX idx_time_logs_active_date
ON time_logs(user_id, deleted_at, date, start_time, id);

PRAGMA user_version = 7;
