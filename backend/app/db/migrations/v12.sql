DROP TRIGGER IF EXISTS channel_bindings_same_user_insert;
DROP INDEX IF EXISTS idx_channel_bindings_active_identity;

ALTER TABLE channel_bindings RENAME TO channel_bindings_v11;

CREATE TABLE channel_bindings (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id INTEGER NOT NULL UNIQUE
        REFERENCES integration_credentials(id) ON DELETE CASCADE,
    channel_type TEXT NOT NULL
        CHECK (channel_type IN ('local_test', 'openclaw', 'telegram', 'whatsapp')),
    external_identity_hash TEXT NOT NULL,
    revoked_at TEXT,
    created_at TEXT NOT NULL
);

INSERT INTO channel_bindings (
    id, user_id, credential_id, channel_type,
    external_identity_hash, revoked_at, created_at
)
SELECT
    id, user_id, credential_id, channel_type,
    external_identity_hash, revoked_at, created_at
FROM channel_bindings_v11;

DROP TABLE channel_bindings_v11;

CREATE UNIQUE INDEX idx_channel_bindings_active_identity
ON channel_bindings(channel_type, external_identity_hash)
WHERE revoked_at IS NULL;

CREATE TRIGGER channel_bindings_same_user_insert
BEFORE INSERT ON channel_bindings
WHEN NOT EXISTS (
    SELECT 1 FROM integration_credentials
    WHERE id = NEW.credential_id AND user_id = NEW.user_id
)
BEGIN
    SELECT RAISE(ABORT, 'channel binding credential must belong to the same user');
END;

PRAGMA user_version = 12;
