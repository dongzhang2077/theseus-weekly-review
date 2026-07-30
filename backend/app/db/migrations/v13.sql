ALTER TABLE proposal_outcomes
ADD COLUMN personalization_consent INTEGER NOT NULL DEFAULT 0
CHECK (personalization_consent IN (0, 1));

ALTER TABLE proposal_outcomes
ADD COLUMN consent_version INTEGER NOT NULL DEFAULT 1
CHECK (consent_version >= 1);

ALTER TABLE proposal_outcomes
ADD COLUMN consent_updated_at TEXT;

CREATE INDEX idx_proposal_outcomes_personalization
ON proposal_outcomes(user_id, personalization_consent, proposal_id, id);

PRAGMA user_version = 13;
