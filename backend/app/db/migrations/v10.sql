ALTER TABLE integration_credential_scopes
RENAME TO integration_credential_scopes_v9;

CREATE TABLE integration_credential_scopes (
    credential_id INTEGER NOT NULL
        REFERENCES integration_credentials(id) ON DELETE CASCADE,
    scope TEXT NOT NULL
        CHECK (
            scope IN (
                'context:read',
                'proposal:create',
                'proposal:decide',
                'action:execute'
            )
        ),
    PRIMARY KEY (credential_id, scope)
);

INSERT INTO integration_credential_scopes (credential_id, scope)
SELECT credential_id, scope
FROM integration_credential_scopes_v9;

DROP TABLE integration_credential_scopes_v9;

PRAGMA user_version = 10;
