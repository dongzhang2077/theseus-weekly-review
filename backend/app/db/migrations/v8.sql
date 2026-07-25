CREATE TABLE preferences (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('user_stated', 'inferred')),
    preference_key TEXT NOT NULL CHECK (
        length(trim(preference_key)) BETWEEN 1 AND 120
    ),
    value_json TEXT NOT NULL CHECK (json_valid(value_json)),
    scope_type TEXT NOT NULL DEFAULT 'global'
        CHECK (scope_type IN ('global', 'goal', 'project', 'task', 'activity')),
    scope_ref_id INTEGER,
    provenance_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(provenance_json)),
    confidence REAL,
    review_after TEXT,
    expires_at TEXT,
    deleted_at TEXT,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (scope_type = 'global' AND scope_ref_id IS NULL)
        OR (scope_type != 'global' AND scope_ref_id IS NOT NULL)
    ),
    CHECK (
        (source = 'user_stated' AND confidence IS NULL)
        OR (source = 'inferred' AND confidence BETWEEN 0.0 AND 1.0)
    ),
    CHECK (
        source != 'inferred'
        OR review_after IS NOT NULL
        OR expires_at IS NOT NULL
    )
);

CREATE UNIQUE INDEX idx_preferences_active_identity
ON preferences(
    user_id,
    preference_key,
    scope_type,
    COALESCE(scope_ref_id, 0)
)
WHERE deleted_at IS NULL;

CREATE INDEX idx_preferences_user_source
ON preferences(user_id, source, deleted_at, preference_key, id);

CREATE TABLE preference_revisions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preference_id INTEGER NOT NULL REFERENCES preferences(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('update', 'delete', 'restore', 'undo')),
    before_json TEXT NOT NULL CHECK (json_valid(before_json)),
    after_json TEXT NOT NULL CHECK (json_valid(after_json)),
    actor_type TEXT NOT NULL DEFAULT 'user'
        CHECK (actor_type IN ('user', 'assistant_approved')),
    reason TEXT NOT NULL DEFAULT '' CHECK (length(reason) <= 1000),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_preference_revisions_preference
ON preference_revisions(user_id, preference_id, id);

CREATE TABLE proposals (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    proposal_type TEXT NOT NULL CHECK (
        proposal_type IN (
            'weekly_plan_adjustment',
            'task_create',
            'reflection',
            'generic'
        )
    ),
    source TEXT NOT NULL DEFAULT 'deterministic'
        CHECK (source IN ('deterministic', 'assistant')),
    title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 240),
    rationale TEXT NOT NULL DEFAULT '' CHECK (length(rationale) <= 4000),
    evidence_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(evidence_json)),
    before_json TEXT NOT NULL CHECK (json_valid(before_json)),
    after_json TEXT NOT NULL CHECK (json_valid(after_json)),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',
            'approved',
            'rejected',
            'expired',
            'executed',
            'undone'
        )),
    expires_at TEXT,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_proposals_user_status
ON proposals(user_id, status, created_at DESC, id DESC);

CREATE TABLE proposal_decisions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
    decision TEXT NOT NULL CHECK (
        decision IN ('approve', 'edit', 'reject', 'expire')
    ),
    decided_after_json TEXT CHECK (
        decided_after_json IS NULL OR json_valid(decided_after_json)
    ),
    reason TEXT NOT NULL DEFAULT '' CHECK (length(reason) <= 1000),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_proposal_decisions_proposal
ON proposal_decisions(user_id, proposal_id, id);

CREATE TABLE agent_actions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
    decision_id INTEGER REFERENCES proposal_decisions(id) ON DELETE SET NULL,
    operation TEXT NOT NULL CHECK (length(trim(operation)) BETWEEN 1 AND 120),
    request_json TEXT NOT NULL CHECK (json_valid(request_json)),
    result_json TEXT CHECK (result_json IS NULL OR json_valid(result_json)),
    verification_json TEXT CHECK (
        verification_json IS NULL OR json_valid(verification_json)
    ),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'succeeded', 'failed', 'undone')),
    idempotency_key TEXT NOT NULL CHECK (
        length(trim(idempotency_key)) BETWEEN 8 AND 200
    ),
    reversible INTEGER NOT NULL DEFAULT 0 CHECK (reversible IN (0, 1)),
    undo_of_action_id INTEGER REFERENCES agent_actions(id) ON DELETE SET NULL,
    error_message TEXT NOT NULL DEFAULT '' CHECK (length(error_message) <= 2000),
    executed_at TEXT,
    undone_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, idempotency_key)
);

CREATE INDEX idx_agent_actions_proposal
ON agent_actions(user_id, proposal_id, id);

CREATE TABLE proposal_outcomes (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
    action_id INTEGER REFERENCES agent_actions(id) ON DELETE SET NULL,
    result TEXT NOT NULL CHECK (
        result IN ('completed', 'partial', 'not_completed', 'dismissed')
    ),
    usefulness INTEGER CHECK (usefulness BETWEEN 1 AND 5),
    actual_duration_minutes INTEGER CHECK (actual_duration_minutes >= 0),
    energy_feedback TEXT CHECK (
        energy_feedback IS NULL
        OR energy_feedback IN ('consuming', 'neutral', 'restore', 'destroy')
    ),
    note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 4000),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_proposal_outcomes_proposal
ON proposal_outcomes(user_id, proposal_id, id);

CREATE TRIGGER preferences_scope_same_user_insert
BEFORE INSERT ON preferences
WHEN (
    (NEW.scope_type = 'goal' AND NOT EXISTS (
        SELECT 1 FROM goals
        WHERE id = NEW.scope_ref_id AND user_id = NEW.user_id
    ))
    OR (NEW.scope_type = 'project' AND NOT EXISTS (
        SELECT 1 FROM projects
        WHERE id = NEW.scope_ref_id AND user_id = NEW.user_id
    ))
    OR (NEW.scope_type = 'task' AND NOT EXISTS (
        SELECT 1 FROM tasks
        WHERE id = NEW.scope_ref_id AND user_id = NEW.user_id
    ))
    OR (NEW.scope_type = 'activity' AND NOT EXISTS (
        SELECT 1 FROM activities
        WHERE id = NEW.scope_ref_id AND user_id = NEW.user_id
    ))
)
BEGIN
    SELECT RAISE(ABORT, 'preference scope must belong to the same user');
END;

CREATE TRIGGER preferences_scope_same_user_update
BEFORE UPDATE OF user_id, scope_type, scope_ref_id ON preferences
WHEN (
    (NEW.scope_type = 'goal' AND NOT EXISTS (
        SELECT 1 FROM goals
        WHERE id = NEW.scope_ref_id AND user_id = NEW.user_id
    ))
    OR (NEW.scope_type = 'project' AND NOT EXISTS (
        SELECT 1 FROM projects
        WHERE id = NEW.scope_ref_id AND user_id = NEW.user_id
    ))
    OR (NEW.scope_type = 'task' AND NOT EXISTS (
        SELECT 1 FROM tasks
        WHERE id = NEW.scope_ref_id AND user_id = NEW.user_id
    ))
    OR (NEW.scope_type = 'activity' AND NOT EXISTS (
        SELECT 1 FROM activities
        WHERE id = NEW.scope_ref_id AND user_id = NEW.user_id
    ))
)
BEGIN
    SELECT RAISE(ABORT, 'preference scope must belong to the same user');
END;

CREATE TRIGGER preference_revisions_same_user_insert
BEFORE INSERT ON preference_revisions
WHEN NOT EXISTS (
    SELECT 1 FROM preferences
    WHERE id = NEW.preference_id AND user_id = NEW.user_id
)
BEGIN
    SELECT RAISE(ABORT, 'preference revision must belong to the same user');
END;

CREATE TRIGGER proposal_decisions_same_user_insert
BEFORE INSERT ON proposal_decisions
WHEN NOT EXISTS (
    SELECT 1 FROM proposals
    WHERE id = NEW.proposal_id AND user_id = NEW.user_id
)
BEGIN
    SELECT RAISE(ABORT, 'proposal decision must belong to the same user');
END;

CREATE TRIGGER agent_actions_same_user_insert
BEFORE INSERT ON agent_actions
WHEN NOT EXISTS (
    SELECT 1 FROM proposals
    WHERE id = NEW.proposal_id AND user_id = NEW.user_id
)
OR (
    NEW.decision_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM proposal_decisions
        WHERE id = NEW.decision_id
          AND proposal_id = NEW.proposal_id
          AND user_id = NEW.user_id
    )
)
OR (
    NEW.undo_of_action_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM agent_actions
        WHERE id = NEW.undo_of_action_id
          AND proposal_id = NEW.proposal_id
          AND user_id = NEW.user_id
    )
)
BEGIN
    SELECT RAISE(ABORT, 'agent action references must belong to the same user');
END;

CREATE TRIGGER proposal_outcomes_same_user_insert
BEFORE INSERT ON proposal_outcomes
WHEN NOT EXISTS (
    SELECT 1 FROM proposals
    WHERE id = NEW.proposal_id AND user_id = NEW.user_id
)
OR (
    NEW.action_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM agent_actions
        WHERE id = NEW.action_id
          AND proposal_id = NEW.proposal_id
          AND user_id = NEW.user_id
    )
)
BEGIN
    SELECT RAISE(ABORT, 'proposal outcome references must belong to the same user');
END;

PRAGMA user_version = 8;
