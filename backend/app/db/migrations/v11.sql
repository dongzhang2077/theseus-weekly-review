ALTER TABLE integration_credential_scopes
RENAME TO integration_credential_scopes_v10;

CREATE TABLE integration_credential_scopes (
    credential_id INTEGER NOT NULL REFERENCES integration_credentials(id) ON DELETE CASCADE,
    scope TEXT NOT NULL CHECK (scope IN ('context:read', 'proposal:create', 'proposal:decide', 'action:execute', 'action:undo')),
    PRIMARY KEY (credential_id, scope)
);

INSERT INTO integration_credential_scopes (credential_id, scope)
SELECT credential_id, scope FROM integration_credential_scopes_v10;

DROP TABLE integration_credential_scopes_v10;
PRAGMA user_version = 11;
