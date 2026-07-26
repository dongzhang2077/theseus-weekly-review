CREATE TABLE integration_credentials (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label TEXT NOT NULL CHECK (length(trim(label)) > 0),
    token_prefix TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    last_used_at TEXT,
    created_at TEXT NOT NULL,
    CHECK (expires_at > created_at)
);

CREATE TABLE integration_credential_scopes (
    credential_id INTEGER NOT NULL
        REFERENCES integration_credentials(id) ON DELETE CASCADE,
    scope TEXT NOT NULL
        CHECK (scope IN ('context:read', 'proposal:create', 'action:execute')),
    PRIMARY KEY (credential_id, scope)
);

CREATE TABLE channel_bindings (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id INTEGER NOT NULL UNIQUE
        REFERENCES integration_credentials(id) ON DELETE CASCADE,
    channel_type TEXT NOT NULL
        CHECK (channel_type IN ('local_test', 'openclaw', 'whatsapp')),
    external_identity_hash TEXT NOT NULL,
    revoked_at TEXT,
    created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_channel_bindings_active_identity
ON channel_bindings(channel_type, external_identity_hash)
WHERE revoked_at IS NULL;

CREATE TABLE integration_message_receipts (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id INTEGER NOT NULL
        REFERENCES integration_credentials(id) ON DELETE CASCADE,
    external_message_id_hash TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (length(trim(operation)) > 0),
    request_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (credential_id, external_message_id_hash)
);

CREATE INDEX idx_integration_credentials_user
ON integration_credentials(user_id, created_at);

CREATE INDEX idx_integration_receipts_user
ON integration_message_receipts(user_id, created_at);

CREATE TRIGGER channel_bindings_same_user_insert
BEFORE INSERT ON channel_bindings
WHEN NOT EXISTS (
    SELECT 1 FROM integration_credentials
    WHERE id = NEW.credential_id AND user_id = NEW.user_id
)
BEGIN
    SELECT RAISE(ABORT, 'channel binding credential must belong to the same user');
END;

CREATE TRIGGER integration_receipts_same_user_insert
BEFORE INSERT ON integration_message_receipts
WHEN NOT EXISTS (
    SELECT 1 FROM integration_credentials
    WHERE id = NEW.credential_id AND user_id = NEW.user_id
)
BEGIN
    SELECT RAISE(ABORT, 'integration receipt credential must belong to the same user');
END;

PRAGMA user_version = 9;
