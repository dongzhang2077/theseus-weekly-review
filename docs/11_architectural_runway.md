# Architectural Runway

This document defines the engineering runway for Theseus. The goal is to build the MVP without creating throwaway code that blocks later development.

## 1. Principle

Theseus should be small in delivered features, not small in architecture.

The MVP should prove the weekly review loop, but the code should already respect the long-term module boundaries:

```text
Capture data -> Store normalized evidence -> Analyze week -> Generate review -> Evaluate review quality
```

This avoids rewriting core logic when the project later adds a mobile app, historical imports, sync, or LLM workflow.

## 2. Stable Core vs Replaceable Interfaces

### Stable Core

These concepts should remain stable:

- User/Account as a local data-ownership and authentication root
- AuthCredential and revocable AuthSession
- Goal
- Project
- Task
- Activity
- WeeklyPlan
- PlannedItem
- FocusSession and FocusSessionSegment
- TimeLog
- ActivityType
- DailyReflection
- WeeklyReview
- ReviewFinding
- RiskFlag
- ReviewRecommendation

The backend schema and review engine should be built around these concepts, not around one demo JSON file.

`Task` is implemented by the accepted schema-v5 STORY-036 runtime baseline.
`FocusSession` remains an accepted STORY-035 contract for schema v6. Their
authoritative contracts are defined in `docs/03_data_model.md` and
`docs/04_api_contract.md`.

### Replaceable Interfaces

These can change over time:

- Web frontend
- Mobile Flutter app
- CSV/JSON import
- Sync backend
- LLM provider
- Dashboard layer
- GitHub/issue workflow

The system should allow multiple input sources to produce the same normalized `TimeLog` and `WeeklyPlan` records.

STORY-035 extends this principle for conversational execution:

```text
Task or PlannedItem -> FocusSession segments -> normalized TimeLogs -> review
```

Live Focus state is durable runtime evidence, but completed TimeLogs remain the
review engine's normalized input.

## 3. Target Module Boundaries

```text
backend/
  app/
    api/              HTTP endpoints
    db/               SQLite connection, schema, repositories
    schemas.py        API/Pydantic models
    services/         authenticated domain commands and orchestration
      tasks.py        Task lifecycle and Project ownership
      activities.py   durable Activity creation and correction
      focus.py        transitions, segments, allocation, idempotency
      time_logs.py    correction, revisions, invalidation, project recalc
      review_service.py

agent/                added only after the domain-service gate
  workflows/          LangGraph state and nodes
  adapters/           replaceable channel/OpenClaw boundary

review_engine/
  rules.py            deterministic review checks
  baseline.py         project stage thresholds and min/max logic
  prompts.py          future LLM prompt assembly
  adapters.py         future LLM provider adapter

mobile/
  Flutter time capture app
  local SQLite
  export/import contract

data/
  sample/             public sample weeks
  imports/            sanitized imports only

evaluation/
  rubrics and feedback records
```

## 4. Data Source Strategy

Theseus should support several data sources through adapters:

| Source | Near-Term Role | Long-Term Role |
|---|---|---|
| `sample_week.json` | Demo and tests | Regression fixture |
| Manual web form | MVP input path | Still useful for editing/correction |
| Mobile capture module | Planned capture path | Primary time capture path |
| Historical RefTime CSV | Evaluation/test material | Optional import source |
| Sync backend | Deferred | Multi-device continuity |

Every source should map into normalized backend records instead of bypassing the model.

Conversation is another source adapter. A message may produce a typed proposal,
but only an approved domain command can create or mutate a Task, Plan,
FocusSession, or TimeLog.

## 5. Database Design Rules

Sprint 1 schema should include long-term extension points now:

- Use stable primary keys.
- Include `created_at` and `updated_at`.
- Preserve raw user-entered activity names.
- Store normalized activity type separately from raw activity name.
- Store `type_source` so user corrections can override AI suggestions.
- Keep project stage and weekly target fields in the database.
- Store review evidence JSON with generated text.
- Add indexes for date, project, goal, and activity type queries.
- Scope personal records, date uniqueness, repository reads, imports, and
  review generation by a stable local `user_id`.
- Reject references that cross local-user ownership boundaries.
- Resolve ownership exclusively from a validated access JWT at the HTTP
  boundary; request bodies and legacy user-ID headers never select an owner.
- Keep short-lived access tokens in browser memory. Rotate refresh tokens in an
  HttpOnly, SameSite cookie and persist only token/CSRF digests.
- Store FocusSession timestamps as UTC instants and capture the account IANA
  timezone once at session start. Split completed evidence by that snapshot,
  not by the server timezone.
- Preserve exact Focus seconds and derive review-compatible whole minutes
  deterministically.
- Use optimistic versions plus user-scoped idempotency receipts for commands
  that browsers or conversation channels may replay.
- Preserve current Task/Activity records and their historical snapshots in
  PlannedItems, FocusSessions, and TimeLogs.
- Use soft deletion plus append-only revisions for correctable TimeLogs.
- Keep credentials, generated auth keys, demo credential files, databases, and
  personal exports outside Git.

The account is an authenticated local persistence scope required by the course
demo. It is not cloud identity or cloud multi-tenancy. Keep third-party login,
email delivery, remote account recovery, and sync deferred.

## 6. Review Engine Design Rules

The review engine should stay framework-independent.

Good:

```text
analyze_week(WeeklyContext) -> WeeklyReviewResult
```

Avoid:

```text
FastAPI route directly calculates everything inline
```

Reason:

The same engine should later serve:

- backend API
- command-line sample review
- evaluation scripts
- scheduled weekly jobs
- optional mobile preview

## 7. Baseline and Stage Model

The stage-baseline model gives Theseus a useful project lifecycle lane:

- `startup`
- `stable`
- `sprint`
- `dormant`
- `wake_up`

`review_engine/baseline.py` owns the stage-specific min, target, and max thresholds. Project-level `weekly_min_minutes` and `weekly_target_minutes` override the defaults when set, while the engine still preserves a stage maximum for overheat detection.

The weekly evidence package exposes this as `evidence.stage_health.projects`, with one row per project and a deterministic status such as `healthy`, `maintenance`, `drift`, `overheated`, `dormant`, or `wake_up_risk`.

Do not hard-code all thresholds inside route handlers.

## 8. Mobile App Position

The Flutter app should become:

```text
Theseus Capture
```

Its role:

- Fast time capture
- Activity/category management
- Local offline records
- CSV/JSON export
- Later sync

It should not be forced to implement the full weekly review UI. The review UI can stay web-first while mobile remains a capture module.

## 9. Integration Roadmap

### Stage A: Demo Data

```text
sample_week.json -> review_engine -> review output
```

Current status: implemented.

### Stage B: Backend Persistence

```text
sample_week.json -> SQLite -> review_engine -> stored weekly_review
```

Current accepted status: SQLite schema version 7, supported migrations from
every prior version, formal account ownership, user-scoped repositories,
restart-path tests, the STORY-037 Focus runtime, and the STORY-034
correction/audit runtime.

### Stage C: Web Input

```text
web forms -> backend SQLite -> review_engine
```

Current status: the released path began with the React local-profile flow and
typed goal, project, plan, and time-log adapters in PR #64, then formal local
accounts superseded profile selection in STORY-030. Signals consumes
interpreted review evidence, and Plan can load, atomically replace, or Undo a
user-scoped next-week adjustment. The accepted mobile correction baseline is
commit `677de39`; it remains local until its release branch is integrated.

### Stage D: Mobile Export

```text
Flutter app -> JSON export -> backend import endpoint -> review_engine
```

This supports a future timer-based capture path without requiring server sync.

### Stage E: Sync Backend

```text
Flutter app -> sync API -> backend DB -> review_engine
```

This is a later extension after the review loop works.

### Stage F: Agent-Ready Domain

```text
Task + Activity
  -> durable FocusSession segments
  -> exactly-once TimeLogs
  -> correctable Evidence
```

Accepted contract status: STORY-035. The accepted runtime includes schema-v5
durable Tasks and nullable Task references through STORY-036, plus
authenticated durable Activity management through STORY-033. STORY-037 adds
the automatically verified and product-owner accepted schema-v6 runtime for
durable FocusSession state and exactly-once TimeLog production. Later
correction steps are implemented and accepted through STORY-034.

Accepted status (2026-07-25 PDT): STORY-034 implements those correction steps,
append-only revisions, soft deletion, Undo, and stale-review invalidation on
schema v7. Automated verification and the product-owner browser gate pass.

Implementation sequence:

1. schema v5 adds durable Tasks and nullable Task references;
2. STORY-033 exposes the existing Activity repository through authenticated
   service/API behavior;
3. schema v6 adds FocusSession, segments, idempotency receipts, exact seconds,
   Focus provenance, and atomically rebuilds the TimeLog duration constraint
   so positive exact sub-minute slices can coexist with zero whole minutes;
4. schema v7 adds TimeLog revisions, soft deletion, versions, and WeeklyReview
   invalidation;
5. only then may the bounded Assistant API call these domain services.

Each migration is atomic, additive for existing users, and verified from every
supported prior schema. Existing ad-hoc PlannedItems and TimeLogs keep null
extension references.

### Stage G: Assistant And Channels

```text
typed Assistant request
  -> evidence-backed proposal
  -> approval
  -> idempotent domain service
  -> verification and action outcome
```

LangGraph may orchestrate this sequence after the explicit service workflow is
tested. OpenClaw remains a replaceable transport adapter and uses scoped
integration identity rather than browser cookies or direct database access.

STORY-026 accepted status (2026-07-26 PDT): the first LangGraph workflow now
orchestrates the accepted Weekly Adjustment services behind a separate SQLite
checkpointer. The runtime thread is account-scoped, stores only domain IDs and
workflow metadata, and uses deterministic draft/execute idempotency keys.
Missing or stale Review Evidence is computed through the existing
`ReviewService`; current Evidence is reused. Restart, approval, edit, rejection,
retry, and exact-once integration tests pass. The accepted slice deliberately
exposes no new channel or generic Agent API.

STORY-039 accepted status (2026-07-26 PDT): scoped integration access is a
separate authentication boundary from browser JWT sessions. Schema v9 hashes
high-entropy credentials, HMAC-protects channel/message identifiers, stores
explicit read/propose/execute scopes, and supports immediate revocation. The
first channel operation is read-only Assistant context through the same typed
domain service. Channel code has no direct repository or SQLite access.

STORY-027 gate-three implementation checkpoint (2026-07-27 PDT): the native
OpenClaw adapter now registers optional context, pending-proposal, and narrow
proposal-decision tools. Proposal-changing invocation is blocked unless the
host supplies a matching inbound `messageId`, `runId`, configured channel, and
configured sender. The runtime passes only an opaque, short-lived reference
into the tool; model input never becomes the external message ID. A decision is
limited to `approve` or `reject`, requires a distinct integration scope, and
only appends to the Proposal ledger; it cannot edit or execute a plan change.
Gate four adds a fourth optional execution tool. It requires `action:execute`,
accepts no plan content, and delegates to the existing approved-proposal Action
service, preserving verification and Undo data.

## 10. Anti-Patterns to Avoid

Avoid:

- Treating `sample_week.json` as the real data model.
- Mixing review rule logic into FastAPI route files.
- Treating a WeeklyPlan `PlannedItem` as the only durable Task record.
- Keeping live Focus state only in one browser once a second channel can
  observe or control it.
- Calculating elapsed Focus time from browser ticks instead of the persisted
  server-owned Start/End interval.
- Letting FastAPI routes, LangGraph nodes, or OpenClaw tools implement different
  Task or timer transitions.
- Letting OpenClaw reuse browser refresh credentials or access SQLite directly.
- Using LangGraph checkpoints or chat transcripts as canonical preferences,
  Plans, Tasks, or TimeLogs.
- Rewriting mobile app code before defining the import contract.
- Committing private historical CSV or local SQLite databases.
- Adding Postgres/JWT/sync before the weekly review loop is usable.
- Building only a one-off demo that cannot accept mobile or web inputs later.

## 11. Sprint 1 Engineering Direction

Sprint 1 should implement:

1. SQLite schema for stable core entities.
2. Repository functions for goals, projects, plans, logs, and reviews.
3. Sample data loader that writes to SQLite.
4. Review orchestration service that reads from SQLite and calls `review_engine`.
5. Tests or scripts proving the same review output can be generated from persisted data.

This gives the team a real product foundation while still keeping the course MVP feasible.

Current status: the persistence foundation is implemented. The active runway
continues in `docs/13_product_agent_development_strategy.md` with truthful
Signals/Plan states before any LangGraph or OpenClaw integration.
