# Data Model

## 1. Core Entities

The tree below is the accepted Agent-foundation target. Schema version 4 is the
currently implemented baseline. `Task`, `FocusSession`,
`FocusSessionSegment`, and the correction/audit extensions are accepted
contracts for later versioned migrations; their presence here does not mean
the current runtime already exposes them.

```text
Account (users + auth_credentials)
  ├── AuthSession
  ├── Goal
  │     └── Project
  │           ├── Task
  │           ├── Activity
  │           ├── PlannedItem (through WeeklyPlan)
  │           ├── FocusSession
  │           └── TimeLog
  ├── WeeklyPlan
  │     └── PlannedItem
  │           └── Task (optional reference)
  ├── FocusSession
  │     ├── FocusSessionSegment
  │     └── TimeLog (one per affected local date)
  ├── DailyReflection
  └── WeeklyReview
        ├── ReviewFinding
        └── ReviewRecommendation
```

`users` remains the stable ownership root. A browser-visible account is the
one-to-one combination of `users` and `auth_credentials`; credentials are never
returned with domain records. `PlannedItem` inherits ownership from its
`WeeklyPlan`, and `FocusSessionSegment` inherits ownership from its
FocusSession. Every other persisted personal table stores `user_id` directly.
Legacy version-2 profiles remain intact after migration but cannot be
enumerated or impersonated through the HTTP API until they are deliberately
migrated to an account.

The five execution concepts have separate responsibilities:

- `Task` is a finite outcome with a lifecycle and may continue across weeks.
- `Activity` is a reusable way of working or spending time.
- `PlannedItem` allocates time inside one WeeklyPlan and may optionally
  reference a Task.
- `FocusSession` and its segments represent durable live execution.
- `TimeLog` is normalized completed evidence. It preserves snapshots even when
  the linked Task or Activity is edited later.

## 2. Enumerations

### Activity Type

| Value | Meaning |
|---|---|
| `consuming` | Useful but energy-consuming work. |
| `neutral` | Routine or low-impact work. |
| `restore` | Recovery or sustainability-supporting activity. |
| `destroy` | Activity that tends to drain attention or undermine goals when excessive. |

### Activity Type Source

| Value | Meaning |
|---|---|
| `user_selected` | The user manually selected the type. |
| `ai_suggested` | AI suggested the type. |
| `user_corrected` | The user changed an AI suggestion. |

### Project Stage

| Value | Meaning |
|---|---|
| `startup` | Project is being initiated or restarted. |
| `stable` | Project has a sustainable routine. |
| `sprint` | Project is in a short deadline-driven push. |
| `dormant` | Project is intentionally paused. |
| `wake_up` | Project was not intentionally paused but has been inactive too long. |

### Task Status

| Value | Meaning |
|---|---|
| `open` | Ready but not currently being executed. |
| `in_progress` | Work has started and the outcome remains incomplete. |
| `completed` | The finite outcome was completed. |
| `cancelled` | The user deliberately stopped pursuing this Task. |

Archiving is independent from Task status. `archived_at` hides a Task from
normal selection without rewriting whether it was completed or cancelled.

### Task Creation Source

| Value | Meaning |
|---|---|
| `user` | Created directly by the user. |
| `assistant_approved` | Created from a proposal explicitly approved by the user. |
| `imported` | Created through an accepted import adapter. |

There is intentionally no unapproved `ai_created` value.

### Focus Session Status

| Value | Meaning |
|---|---|
| `running` | One open segment is accumulating elapsed time. |
| `paused` | No segment is open; prior accumulated time is retained. |
| `completed` | The session is immutable and its TimeLogs were created exactly once. |
| `cancelled` | The session ended without producing TimeLogs. |

### Risk Flag

| Value | Meaning |
|---|---|
| `alignment_gap` | Important goal received less time than expected. |
| `plan_drift` | Actual execution differed significantly from plan. |
| `dormancy_risk` | Active project received no meaningful attention. |
| `overload_risk` | Planned or actual work exceeded realistic capacity. |
| `slack_risk` | Not enough buffer was left for recovery and unexpected work. |
| `destroy_pattern` | Draining activities became visible enough to mention. |

## 3. Tables

### users

| Field | Type | Notes |
|---|---|---|
| id | integer pk | Stable account and ownership ID |
| display_name | text | Required |
| timezone | text | Required; defaults to `UTC` |
| locale | text | Required; defaults to `en` |
| created_at | datetime | System timestamp |
| updated_at | datetime | System timestamp |

### auth_credentials

| Field | Type | Notes |
|---|---|---|
| user_id | integer pk/fk | One-to-one with `users`; cascades on account deletion |
| subject | text unique | Opaque JWT subject; never derived from email |
| email | text unique | Case-insensitive normalized sign-in identifier |
| password_hash | text | Argon2id hash; plaintext is never persisted |
| failed_attempts | integer | Login throttling state |
| locked_until | datetime | Temporary lock deadline when present |
| password_changed_at | datetime | Credential rotation timestamp |
| created_at | datetime | System timestamp |
| updated_at | datetime | System timestamp |

### auth_sessions

| Field | Type | Notes |
|---|---|---|
| id | text pk | Opaque refresh-session ID and refresh JWT `jti` |
| user_id | integer fk | Account owner; cascades on deletion |
| token_hash | text unique | SHA-256 digest of the refresh JWT |
| csrf_hash | text | SHA-256 digest of the double-submit CSRF value |
| expires_at | datetime | Absolute refresh expiry |
| user_agent | text | Bounded diagnostic context |
| created_at | datetime | System timestamp |
| last_used_at | datetime | Last authenticated use |
| revoked_at | datetime | Revocation marker |
| replaced_by_id | text fk | Rotation chain; reuse revokes all account sessions |

### goals

| Field | Type | Notes |
|---|---|---|
| id | integer pk | Internal ID |
| user_id | integer fk | Required owner; cascades on user deletion |
| title | text | Required |
| description | text | Optional |
| priority | integer | 1 is highest |
| active_status | boolean | Whether goal is active |
| created_at | datetime | System timestamp |
| updated_at | datetime | System timestamp |

### projects

| Field | Type | Notes |
|---|---|---|
| id | integer pk | Internal ID |
| user_id | integer fk | Required owner; must match `goal_id` owner |
| goal_id | integer fk | Nullable for support projects |
| title | text | Required |
| stage | text enum | `startup`, `stable`, `sprint`, `dormant`, `wake_up` |
| deadline | date | Optional |
| weekly_min_minutes | integer | Maintenance or target floor |
| weekly_target_minutes | integer | Normal weekly target |
| status | text | `active`, `paused`, `archived` |
| last_activity_date | date | Optional date used by dormancy checks |
| created_at | datetime | System timestamp |
| updated_at | datetime | System timestamp |

### tasks (accepted for schema v5)

| Field | Type | Notes |
|---|---|---|
| id | integer pk | Stable internal ID |
| user_id | integer fk | Required owner; must match `project_id` owner |
| project_id | integer fk | Required parent Project |
| title | text | Required finite outcome |
| description | text | Optional detail or completion condition |
| status | text enum | `open`, `in_progress`, `completed`, or `cancelled` |
| priority | integer | 1 is highest; defaults to 3 |
| estimated_minutes | integer | Optional positive estimate |
| due_date | date | Optional account-local due date |
| created_source | text enum | `user`, `assistant_approved`, or `imported` |
| completed_at | datetime | Set and cleared by validated lifecycle transitions |
| archived_at | datetime | Optional reversible archive marker |
| version | integer | Optimistic-concurrency version; begins at 1 |
| created_at | datetime | System timestamp |
| updated_at | datetime | System timestamp |

Tasks are never hard-deleted through the normal API. Account deletion still
cascades. A completed or cancelled Task may be reopened; archive/restore does
not change lifecycle status. An open FocusSession prevents Task archive.

### activities

| Field | Type | Notes |
|---|---|---|
| id | integer pk | Internal ID |
| user_id | integer fk | Required owner; must match `project_id` owner |
| project_id | integer fk | Optional |
| name | text | Required |
| description | text | Optional |
| activity_type | text enum | Required after classification |
| type_source | text enum | User or AI source |
| version | integer | Accepted v5 optimistic-concurrency version |
| created_at | datetime | System timestamp |
| updated_at | datetime | System timestamp |

### weekly_plans

| Field | Type | Notes |
|---|---|---|
| id | integer pk | Internal ID |
| user_id | integer fk | Required owner |
| week_start | date | Required |
| week_end | date | Required |
| planned_capacity_minutes | integer | Optional |
| slack_target_percent | integer | Default 20 |
| note | text | Optional |
| created_at | datetime | System timestamp |
| updated_at | datetime | System timestamp |

### planned_items

| Field | Type | Notes |
|---|---|---|
| id | integer pk | Internal ID |
| weekly_plan_id | integer fk | Required |
| project_id | integer fk | Optional |
| task_id | integer fk | Optional accepted v5 reference |
| title | text | Required |
| planned_minutes | integer | Required |
| priority | integer | Optional |
| is_completed | boolean | Optional manual flag |
| created_at | datetime | System timestamp |
| updated_at | datetime | System timestamp |

Ownership is inherited through `weekly_plan_id`. When `project_id` is present,
the project must belong to the same user as the plan. When `task_id` is
present, the Task must have the same owner and Project as the PlannedItem.
`title` remains a weekly snapshot. Existing ad-hoc PlannedItems keep
`task_id = NULL`.

Task status is canonical for the durable outcome. `is_completed` remains the
state of this week's plan block and does not silently complete a linked Task.

### focus_sessions (accepted for schema v6)

| Field | Type | Notes |
|---|---|---|
| id | integer pk | Stable session ID |
| user_id | integer fk | Required owner |
| activity_id | integer fk | Required durable Activity |
| task_id | integer fk | Optional durable Task |
| project_id | integer fk | Server-derived Project snapshot |
| activity_name | text | Activity-name snapshot captured at start |
| activity_type | text enum | Activity-type snapshot captured at start |
| type_source | text enum | Classification-source snapshot captured at start |
| task_title | text | Optional Task-title snapshot captured at start |
| timezone | text | Valid IANA timezone captured from the account at start |
| status | text enum | `running`, `paused`, `completed`, or `cancelled` |
| accumulated_seconds | integer | Closed-segment total; non-negative |
| version | integer | Optimistic-concurrency version; begins at 1 |
| started_at | datetime | UTC start timestamp |
| completed_at | datetime | UTC completion timestamp |
| cancelled_at | datetime | UTC cancellation timestamp |
| created_at | datetime | System timestamp |
| updated_at | datetime | System timestamp |

The server derives `project_id` from the Task when present, otherwise from the
Activity. A project-scoped Activity must match the Task Project. A global
Activity with `project_id = NULL` may be used with any same-user Task.

Starting Focus for an `open` Task changes it to `in_progress` in the same
transaction. Completed, cancelled, or archived Tasks must be explicitly
reopened or restored first. Finishing or cancelling Focus does not infer Task
completion or cancellation.

At most one non-terminal FocusSession may exist for the same
`(user_id, activity_id)`. Different Activities may run concurrently, preserving
the accepted multi-Activity Focus behavior.

### focus_session_segments (accepted for schema v6)

| Field | Type | Notes |
|---|---|---|
| id | integer pk | Stable segment ID |
| focus_session_id | integer fk | Required parent; cascades on account deletion |
| started_at | datetime | UTC instant when running began |
| ended_at | datetime | UTC instant when paused, completed, or cancelled |
| created_at | datetime | System timestamp |

A running FocusSession has exactly one open segment. Pausing or completing
closes it; resuming creates another. Segments, rather than wall-clock
subtraction, make pause/resume and cross-midnight allocation auditable.

### idempotency_receipts (accepted for schema v6)

| Field | Type | Notes |
|---|---|---|
| id | integer pk | Internal receipt ID |
| user_id | integer fk | Required owner |
| idempotency_key | text | Client-generated opaque key |
| operation | text | Bounded domain command name |
| request_hash | text | Hash of normalized request and target |
| status | text | `in_progress`, `completed`, or `failed` |
| response_status | integer | Stored HTTP result when completed |
| response_json | json text | Stored bounded response when completed |
| created_at | datetime | System timestamp |
| expires_at | datetime | Optional cleanup boundary |

`(user_id, idempotency_key)` is unique. Reusing a key with a different target
or payload is a conflict. A completed receipt returns the original result
without executing the command again. Receipts for terminal Focus commands and
TimeLog mutations do not expire while their target record is retained.

### time_logs

| Field | Type | Notes |
|---|---|---|
| id | integer pk | Internal ID |
| user_id | integer fk | Required owner; linked activity/project must have the same owner |
| activity_id | integer fk | Optional if activity is ad hoc |
| task_id | integer fk | Optional accepted v5 link |
| focus_session_id | integer fk | Optional accepted v6 provenance link |
| project_id | integer fk | Optional |
| date | date | Required |
| start_time | time | Optional |
| end_time | time | Optional |
| duration_minutes | integer | Required; non-negative after accepted v6 |
| duration_seconds | integer | Required positive exact duration after accepted v6 |
| activity_name | text | Raw user-visible name |
| activity_type | text enum | Copied for easier review queries |
| type_source | text enum | User or AI source |
| task_title | text | Optional accepted v5 Task-title snapshot |
| note | text | Optional |
| version | integer | Accepted v7 optimistic-concurrency version |
| deleted_at | datetime | Accepted v7 soft-delete marker |
| created_at | datetime | System timestamp |
| updated_at | datetime | System timestamp |

Legacy and minute-only manual TimeLogs use
`duration_seconds = duration_minutes * 60` when the v6 migration runs. A
completed FocusSession aggregates its closed segments by the session's captured
timezone and creates at most one TimeLog per local date. The exact seconds
remain canonical for timer display. Whole minutes are allocated with a
deterministic largest-remainder rule so that daily `duration_minutes` values
sum to `floor((total_seconds + 30) / 60)`. Remaining whole minutes are assigned
by descending second remainder with earlier local date as the stable tie-break.
A sub-minute daily slice may therefore have `duration_minutes = 0` while
retaining positive exact seconds.

TimeLog snapshots do not change when a linked Activity or Task is renamed.
Soft-deleted rows are excluded from Today, project totals, Evidence, and review
generation.

### time_log_revisions (accepted for schema v7)

| Field | Type | Notes |
|---|---|---|
| id | integer pk | Stable revision and Undo reference |
| user_id | integer fk | Required owner |
| time_log_id | integer fk | Required target TimeLog |
| action | text enum | `update`, `delete`, `restore`, or `undo` |
| before_json | json text | Complete pre-mutation API representation |
| after_json | json text | Complete post-mutation API representation |
| actor_type | text enum | `user` or later `assistant_approved` |
| reason | text | Optional bounded user note |
| created_at | datetime | System timestamp |

Undo creates another revision rather than deleting audit history. Revision
payloads are user-owned personal data and cascade on account deletion.

### daily_reflections

| Field | Type | Notes |
|---|---|---|
| id | integer pk | Internal ID |
| user_id | integer fk | Required owner |
| date | date | Required |
| small_win | text | Optional |
| mood_note | text | Optional |
| free_note | text | Optional |
| created_at | datetime | System timestamp |
| updated_at | datetime | System timestamp |

### weekly_reviews

| Field | Type | Notes |
|---|---|---|
| id | integer pk | Internal ID |
| user_id | integer fk | Required owner |
| week_start | date | Required |
| week_end | date | Required |
| wins_json | json text | Structured wins |
| insights_json | json text | Structured insights |
| next_steps_json | json text | Structured next steps |
| risk_flags_json | json text | Structured risks |
| evidence_json | json text | Facts used for generation |
| generated_text | text | Human-readable review |
| model_name | text | Optional |
| stale_at | datetime | Accepted v7 invalidation marker; null after generation |
| created_at | datetime | System timestamp |
| updated_at | datetime | System timestamp |

## 4. API Representation Rules

- Create requests do not accept database IDs or system timestamps.
- User-owned create requests receive the owner from the explicit API user
  context; clients cannot set `user_id` in the JSON body.
- Read responses include persisted IDs, `user_id`, and timestamps.
- Dates, times, and datetimes use ISO 8601 JSON strings.
- A weekly plan and its planned items are created or replaced in one
  transaction. A failed replacement preserves the previous plan and items.
- A Task reference never replaces the PlannedItem title or TimeLog snapshots.
- A Focus command requires a user-scoped idempotency receipt and optimistic
  version. Replaying the same command returns its original result.
- Focus timestamps are stored in UTC. Local dates are derived using the valid
  IANA timezone captured at session start, so an account timezone change cannot
  rewrite an in-flight session.
- Finishing a FocusSession and creating all affected TimeLogs is one
  transaction. The session becomes `completed` only when all logs and the
  idempotency receipt are durable.
- Every TimeLog create, correction, soft deletion, or Undo updates affected
  project dates and invalidates overlapping stored reviews in the same
  transaction. Corrective mutations also append their revision.
- Weekly plans are unique per `(user_id, week_start, week_end)`.
- Daily reflections are unique per `(user_id, date)`.
- Weekly reviews are unique per `(user_id, week_start, week_end)`; regeneration
  replaces that user's stored structured result while preserving its ID and
  clears `stale_at`.
- Foreign keys and database triggers reject cross-user goal, project, activity,
  task, planned-item, FocusSession, and TimeLog references.
- Schema version 2 adds local ownership; version 3 adds formal credentials and
  sessions; version 4 removes the unused recovery-code column without changing
  accounts or personal records. Initializing a version 1 database
  migrates existing records to a generated `Local User` profile with ID `1`.

## 5. Accepted Migration Sequence

The following versions are contracts, not current implementation claims:

| Version | Story | Additive behavior |
|---|---|---|
| 5 | STORY-036 | `tasks`; Activity versions; nullable Task references/snapshots on PlannedItems and TimeLogs; ownership/project triggers |
| 6 | STORY-037 | `focus_sessions`, segments, idempotency receipts, Focus provenance/exact seconds, and a TimeLog constraint rebuild allowing exact sub-minute slices |
| 7 | STORY-034 | TimeLog versions/soft deletion, revisions, and WeeklyReview invalidation |

STORY-033 uses the existing `activities` table plus the `version` column
introduced by the accepted v5 foundation. It does not require another
schema-version increase unless implementation discovers a new contract-level
change that returns to product-owner review.

Every migration must:

- run inside `BEGIN IMMEDIATE` and roll back as a unit;
- preserve IDs, timestamps, accounts, Plans, TimeLogs, and stored reviews;
- give every legacy extension column a safe null or derived value;
- recreate or add cross-user constraints before commit;
- run `PRAGMA foreign_key_check` before commit;
- leave `PRAGMA foreign_keys = ON` on every normal connection;
- reject an unknown newer `PRAGMA user_version`;
- prove v1, v2, v3, and v4 databases reach the new version without skipping
  existing migration guarantees.

## 6. Reference Mapping Notes

If importing records from a timer or historical tracking source, fields can map into the Theseus schema as follows:

| Source Field | Theseus Field |
|---|---|
| `time_entries.activity` | `time_logs.activity_name` |
| `time_entries.duration_minutes` | `time_logs.duration_minutes` |
| `time_entries.bandwidth_type` | `time_logs.activity_type` |
| `projects.current_stage` | `projects.stage` |
| `reviews.summary` | `weekly_reviews.generated_text` |

## 7. Accepted Execution Lifecycle

The lifecycle below is the STORY-035 contract proof:

1. The authenticated user creates Task `Draft final report` under their own
   Project. The service records `created_source = user`.
2. The user creates or selects Activity `Focused writing`. Activity creation
   completes before it can be used as durable Focus state.
3. A WeeklyPlan PlannedItem references the Task while preserving the weekly
   title and planned-minute snapshot.
4. Starting Focus validates Task, Activity, and Project ownership, captures
   their names/types and the account timezone, creates a `running`
   FocusSession, opens its first segment, changes an open Task to
   `in_progress`, and completes an idempotency receipt.
5. Pause closes the open segment. Resume opens another. Replaying either
   command with its original key returns the original response.
6. Finish closes the last segment, groups exact elapsed seconds by captured
   local date, creates the TimeLogs atomically, updates affected Project
   activity dates, invalidates overlapping stored reviews, marks the session
   `completed`, and stores the command receipt. A duplicate finish produces no
   extra TimeLog. Finishing Focus does not silently complete the linked Task.
7. Review generation reads non-deleted normalized TimeLogs through the existing
   ReviewService and deterministic `review_engine`.
8. A user correction creates a TimeLog revision, updates or soft-deletes the
   record, recalculates affected Project activity dates, and marks overlapping
   stored WeeklyReviews stale in the same transaction.
9. Regenerating the WeeklyReview uses the corrected Evidence, preserves the
   review ID, and clears `stale_at`.
10. Undo applies the recorded pre-mutation representation subject to ownership
    and optimistic-version checks and appends another audit revision.
