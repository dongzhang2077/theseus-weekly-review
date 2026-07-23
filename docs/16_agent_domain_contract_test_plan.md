# Agent Domain Contract Test Plan

- Story: STORY-035
- Status: accepted test outline; version 5 automatically verified
- Baseline schema: version 5 STORY-036 accepted runtime
- Target migrations: versions 5, 6, and 7
- Owner: Dong Zhang

This plan defines the minimum executable evidence required by the accepted
Task, Activity, FocusSession, TimeLog, and review-invalidation contracts. It
does not count documentation assertions as implementation tests.

## 1. Verification Order

Every implementation story runs:

1. schema and migration tests;
2. repository and domain-service tests;
3. API success and failure tests;
4. the story's end-to-end lifecycle test;
5. full backend tests;
6. sample review and compile verification;
7. focused frontend tests, full frontend tests, typecheck, and build when the
   story changes the browser.

Required repository commands after Python behavior changes:

```bash
python3 -m pytest -q
python3 scripts/run_sample_review.py
python3 -m compileall backend review_engine scripts
```

Required frontend commands after browser behavior changes:

```bash
cd frontend/app
npm test
npm run build
```

Tests use temporary databases and sanitized fixtures. Local personal databases,
credentials, channel identifiers, and raw conversation exports are prohibited.

STORY-036 checkpoint (2026-07-22 PDT): v1-v4 migration/rollback, schema
constraints, TaskService lifecycle/version behavior, authenticated Task/Plan/
TimeLog API behavior, account isolation, restart persistence, focused browser
state tests, full backend/frontend suites, sample review, persisted review,
compileall, and production build pass. The product owner accepted the local
browser flow on 2026-07-22 after verifying Task lifecycle, Plan linkage, and
reload persistence. No screenshot was recorded; the written acceptance in the
development conversation is the product gate evidence.

## 2. Schema And Migration Matrix

### Version 5: Durable Tasks

Required cases:

- initialize version 5 from an empty database;
- migrate representative versions 1, 2, 3, and 4 to version 5;
- preserve every pre-existing account, Goal, Project, Activity, WeeklyPlan,
  PlannedItem, TimeLog, DailyReflection, and WeeklyReview ID and timestamp;
- backfill all legacy `planned_items.task_id` and `time_logs.task_id` values as
  null;
- backfill every existing Activity with `version = 1`;
- reject Task-to-Project links across users;
- reject PlannedItem and TimeLog Task/Project mismatches;
- roll back the complete migration when an integrity check fails;
- reject an unknown schema version newer than the application supports;
- leave `PRAGMA foreign_keys = ON` and return no
  `PRAGMA foreign_key_check` violations.

### Version 6: Durable Focus Sessions

Required cases:

- migrate version 5 without changing legacy TimeLog meaning;
- derive legacy `duration_seconds = duration_minutes * 60`;
- rebuild the TimeLog duration constraint atomically so a positive exact
  sub-minute slice may have zero whole minutes;
- reject FocusSession links to another user's Activity, Task, or Project;
- allow simultaneous sessions for different Activities;
- reject two non-terminal sessions for the same user and Activity;
- allow at most one open segment inside one running session;
- reject invalid session status and negative accumulated duration;
- enforce unique Focus-produced TimeLog per session and local date;
- enforce unique `(user_id, idempotency_key)` receipt;
- roll back session completion, all TimeLogs, and the receipt together when any
  daily record fails.

### Version 7: Correctable TimeLogs

Required cases:

- migrate version 6 with `version = 1`, `deleted_at = null`, and no fabricated
  revisions;
- keep deleted TimeLogs available to owned audit/Undo reads but exclude them
  from normal evidence queries;
- reject revision ownership mismatch;
- preserve revision history when a mutation is undone;
- mark only overlapping same-user WeeklyReviews stale;
- clear `stale_at` only after successful review regeneration;
- roll back correction, project-date recalculation, revision, and invalidation
  together on failure.

## 3. Domain-Service Tests

### TaskService

- create a Task with server-controlled source and timestamps;
- list in deterministic due-date/priority order;
- perform every allowed lifecycle transition;
- reject every unspecified lifecycle transition;
- set and clear `completed_at` correctly;
- reject stale Task versions without mutation;
- archive and restore without changing status;
- reject archive while an owned FocusSession is open;
- reject foreign Project references without disclosing the record.

### ActivityService

- create and reload a durable Activity;
- reject a public client that claims `ai_suggested` provenance;
- list global and Project-filtered Activities deterministically;
- correct name, description, Project, and type;
- reject stale Activity versions without mutation;
- set `type_source = user_corrected` when the user changes type;
- preserve prior FocusSession and TimeLog snapshots;
- reject Project reassignment while an Activity session is open;
- reject foreign Project references.

### FocusService

- start creates one running session and one open segment;
- starting an open Task atomically changes it to `in_progress`;
- completed, cancelled, and archived Tasks cannot start Focus;
- elapsed time is derived from closed segments plus the open segment;
- pause closes one segment and increments version;
- resume opens one new segment and increments version;
- multiple Activities accumulate independently;
- stale `expected_version` returns a conflict without mutation;
- identical idempotency replay returns the original response;
- key reuse with a different request returns a conflict;
- cancel closes an open segment but creates no TimeLogs;
- finish from running and paused states succeeds exactly once;
- completed and cancelled sessions reject further transitions;
- timezone change after start does not change the captured session timezone;
- cross-midnight completion groups seconds into the correct local dates;
- daylight-saving transitions use UTC segment instants and the captured IANA
  timezone without adding or losing elapsed seconds;
- largest-remainder minute allocation preserves the rounded whole-session
  total and uses a deterministic date tie-break;
- sub-minute and multi-day slices retain positive exact seconds without
  fabricating extra whole minutes;
- backend restart between commands preserves state and completion behavior;
- an invalid account timezone produces a controlled conflict and no session;
- finishing does not silently complete the linked Task.
- cancelling does not silently change the linked Task lifecycle.

### TimeLogService

- normal reads exclude deleted rows and support all documented filters;
- correction updates only supplied fields and increments version;
- type correction records `user_corrected`;
- inconsistent seconds/minutes input returns validation error;
- correcting Project links recalculates old and new
  `projects.last_activity_date`;
- correcting a date invalidates both affected review weeks;
- soft deletion removes the record from Today and review evidence;
- Undo restores the complete prior representation and appends a revision;
- stale version and foreign revision attempts do not mutate data;
- regenerated review uses corrected evidence, preserves review ID, and clears
  staleness;
- manual, batch, imported, and Focus-produced TimeLogs invalidate only
  overlapping same-user stored reviews.

## 4. API Contract Matrix

Each new endpoint needs:

- authenticated success;
- missing Bearer token;
- expired, forged, and revoked session;
- valid record owned by another account;
- missing referenced record;
- invalid enum, empty title/name, invalid duration, and invalid date/time;
- stable documented response model in generated OpenAPI;
- deterministic list ordering and filtering;
- controlled `404`, `409`, or `422` rather than raw SQLite errors;
- a subsequent read proving the persisted representation.

Focus command endpoints additionally cover missing idempotency key, exact
replay, key/payload conflict, stale version, illegal state transition, and
transaction failure.

TimeLog mutation endpoints additionally cover revision result shape, soft
delete visibility, Undo replay, affected-week reporting, and regenerated review
evidence.

Manual, batch, and mobile-import tests additionally cover optional Task links,
seconds/minutes normalization, server-controlled Focus provenance, and
Task/Activity/Project agreement.

## 5. Lifecycle Integration Proof

One automated integration test must execute the complete accepted lifecycle:

```text
register account
  -> create Goal and Project
  -> create durable Task and Activity
  -> create WeeklyPlan item linked to Task
  -> start Focus
  -> pause
  -> restart backend/database connection
  -> resume across local midnight
  -> finish twice with the same idempotency key
  -> prove one completed session and expected daily TimeLogs
  -> generate WeeklyReview
  -> correct one TimeLog
  -> prove Today/project/review staleness changed
  -> regenerate WeeklyReview
  -> prove corrected Evidence and stable review ID
  -> Undo the correction
```

The test must run for two accounts and prove that the second account cannot
read, reference, command, correct, delete, or Undo the first account's records.

## 6. Browser Acceptance Evidence

When each frontend module is implemented, the handoff includes:

- 430x932 screenshots for loading, ready, failure, and completed states;
- keyboard and accessible-name checks for every new control;
- no horizontal overflow at 320, 390, and 430 CSS pixels;
- Task creation and Plan linkage persist across a full browser/backend restart;
- Activity creation persists across a full browser/backend restart;
- live Focus state survives refresh without double counting;
- Today correction updates totals immediately and exposes Undo;
- existing Review, Signals, Focus, and Plan navigation remains usable.

Product-owner browser acceptance remains required even when all automated tests
pass.
