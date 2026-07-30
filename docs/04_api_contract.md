# API Contract

Contract status:

- Sections 1-9 describe the product-owner accepted schema-v5 HTTP surface.
- Section 10 remains a planned evaluation endpoint.
- Section 11 is the accepted STORY-035 Agent-foundation contract. STORY-036
  implements Tasks, optional PlannedItem Task links, and TimeLog Task
  snapshots on its product-owner accepted branch. STORY-033 implements
  authenticated Activity create, list, detail, and optimistic correction on
  its product-owner accepted branch. STORY-037 implements the Section 11.5
  FocusSession routes, Focus idempotency receipts, and the schema-v6 exact-time
  read fields. That implementation passed automated verification and the
  product-owner browser gate on 2026-07-25. STORY-034 implements TimeLog
  correction, deletion, Undo, mutation idempotency, audit revisions, and
  overlapping-review invalidation on schema v7. Automated verification and
  product-owner browser acceptance passed on 2026-07-25.
- Section 13.1 is the automatically verified and product-owner accepted
  STORY-038A read-only Assistant context operation.
- Section 13.2 is the automatically verified and product-owner accepted
  STORY-038B deterministic Weekly Plan proposal operation.
- Section 13.3 is the automatically verified and product-owner accepted
  STORY-038C approved Weekly Plan execution operation.
- Section 13.4 is the focused-test verified and product-owner accepted
  STORY-038D typed Weekly Plan Undo operation.
- Section 12.3 is the automatically verified STORY-028 consented-outcome
  observation baseline. It remains a candidate until product-owner browser
  acceptance.

The API uses JSON over HTTP. Every persisted personal-data operation requires a
short-lived access JWT:

```http
Authorization: Bearer <access-token>
```

The token is required for goals, projects, weekly plans, time logs, mobile
imports, persisted weekly-review generation, and account-management routes.
It is not required for health, register, login, refresh, or the pure
in-memory `POST /reviews/weekly/analyze` endpoint. The backend validates the
token and its active server-side session, then derives the ownership scope from
the opaque subject. `X-Theseus-User-Id` is ignored and cannot select a user.

Persisted personal records include `user_id` in read responses. Clients cannot
override it in request bodies or headers.

The access token expires after 15 minutes by default and should remain only in
browser memory. Registration/login/refresh also set a rotating refresh JWT in
the HttpOnly `theseus_rt` cookie and a readable `theseus_csrf` cookie. The
refresh request must echo the CSRF value in `X-CSRF-Token`. Cookie lifetime,
access lifetime, issuer, audience, allowed origins, and local HTTPS behavior are
configurable through `THESEUS_*` environment variables.

For the local browser demo, the backend allows `http://127.0.0.1:5173` and
`http://localhost:5173` as CORS origins by default. Override this with the
comma-separated `THESEUS_CORS_ORIGINS` environment variable.

## 1. Health

### GET /health

Response:

```json
{
  "status": "ok",
  "service": "theseus-backend"
}
```

## 2. Authentication and Account

### POST /auth/register

Request:

```json
{
  "email": "douglas@example.com",
  "password": "a passphrase with 15+ characters",
  "display_name": "Douglas",
  "timezone": "America/Los_Angeles",
  "locale": "en-US"
}
```

Response:

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "expires_in": 900,
  "user": {
    "id": 1,
    "email": "douglas@example.com",
    "display_name": "Douglas",
    "timezone": "America/Los_Angeles",
    "locale": "en-US",
    "created_at": "2026-07-17T12:00:00",
    "updated_at": "2026-07-17T12:00:00"
  }
}
```

Status: `201 Created`. Email is normalized case-insensitively. Passwords must be
15-256 characters. Duplicate email returns `409`.

### POST /auth/login

Request: `email` and `password`. Response uses the same token/account shape as
registration. Invalid credentials return the same
generic `401` response. Five consecutive failures temporarily lock the account
and return `429` with `Retry-After`.

### POST /auth/refresh

Requires the `theseus_rt` and `theseus_csrf` cookies plus:

```http
X-CSRF-Token: <value from theseus_csrf>
```

Returns a new access token and rotates both cookie values. Reuse of a replaced
refresh token revokes all sessions for the account and returns `401`.

### POST /auth/logout

Requires Bearer authentication. Revokes the active session, clears both auth
cookies, and returns `204`.

### GET /auth/me

Returns the authenticated account. No credentials or session token hashes are
ever returned.

### PATCH /auth/me

Accepts one or more of `display_name`, `timezone`, and `locale`; returns the
updated account.

### POST /auth/change-email

Accepts `email` and `current_password`; returns the updated account. A duplicate
email returns `409`.

### POST /auth/change-password

Accepts `current_password` and `new_password`. Revokes every old session and
creates one replacement session.

### DELETE /auth/account

Requires Bearer authentication plus `current_password` and literal confirmation
`DELETE`. Returns `204` and cascades deletion through credentials, sessions,
and all locally owned domain records.

There are no public `/users` list, create, or lookup routes.

## 3. Goals

### POST /goals

Request:

```json
{
  "title": "Research Proposal",
  "description": "Finish and refine applied research proposal work.",
  "priority": 1,
  "active_status": true
}
```

Response:

```json
{
  "id": 1,
  "user_id": 1,
  "title": "Research Proposal",
  "description": "Finish and refine applied research proposal work.",
  "priority": 1,
  "active_status": true,
  "created_at": "2026-07-15T12:00:00",
  "updated_at": "2026-07-15T12:00:00"
}
```

Status: `201 Created`.

### GET /goals

Returns all goals ordered by priority and ID. Persisted responses also include `created_at` and `updated_at`.

## 4. Projects

### POST /projects

Request:

```json
{
  "goal_id": 1,
  "title": "Theseus MVP",
  "stage": "startup",
  "deadline": "2026-07-18",
  "weekly_min_minutes": 180,
  "weekly_target_minutes": 480,
  "status": "active"
}
```

Status: `201 Created`. A missing `goal_id` returns a controlled `4xx` response.

### GET /projects

Returns projects ordered by ID.

## 5. Weekly Plans

### POST /weekly-plans

Request:

```json
{
  "week_start": "2026-06-08",
  "week_end": "2026-06-14",
  "planned_capacity_minutes": 1800,
  "slack_target_percent": 20,
  "items": [
    {
      "project_id": 1,
      "title": "Design backend schema",
      "planned_minutes": 240,
      "priority": 1
    }
  ],
  "note": "Progress report week."
}
```

Status: `201 Created`. The plan and all items are committed atomically.

### GET /weekly-plans

Returns persisted plans with item IDs and deterministic item ordering.

### PUT /weekly-plans/{plan_id}

Replaces one user-owned weekly plan and its complete planned-item collection.
The request body is the same as `POST /weekly-plans`. The plan ID and
`created_at` are preserved; replacement items receive persisted IDs and the
response uses the normal weekly-plan read shape.

Status: `200 OK`. The plan header and all replacement items are committed
atomically. If any item or date conflicts with database constraints, the API
returns `409 Conflict` and preserves the prior plan. A plan outside the selected
local-user scope is reported as `404 Not Found`.

### DELETE /weekly-plans/{plan_id}

Deletes one user-owned weekly plan and its planned items. This is used by the
course MVP to Undo a newly created next-week adjustment.

Status: `204 No Content`. A missing plan or a plan outside the selected
local-user scope returns `404 Not Found`.

## 6. Time Logs

### POST /time-logs

Request:

```json
{
  "project_id": 1,
  "date": "2026-06-10",
  "start_time": "09:00",
  "end_time": "10:30",
  "duration_minutes": 90,
  "activity_name": "Backend schema design",
  "activity_type": "consuming",
  "type_source": "user_selected",
  "note": "Defined core entities."
}
```

Status: `201 Created`.

### GET /time-logs

Returns time logs ordered by date, start time, and ID.

### POST /time-logs/batch

Creates between 1 and 32 time logs in one transaction:

```json
{
  "time_logs": [
    {
      "project_id": 1,
      "date": "2026-07-18",
      "duration_minutes": 30,
      "activity_name": "Backend schema design",
      "activity_type": "consuming",
      "type_source": "user_selected",
      "note": "Cross-day focus session."
    },
    {
      "project_id": 1,
      "date": "2026-07-19",
      "duration_minutes": 20,
      "activity_name": "Backend schema design",
      "activity_type": "consuming",
      "type_source": "user_selected",
      "note": "Cross-day focus session."
    }
  ]
}
```

Status: `201 Created`. The response is the persisted list in request order.
The Focus client uses this endpoint when one accumulated session crosses a
local calendar-day boundary. If any record is invalid or references data
outside the authenticated account, the entire batch is rolled back and the API
returns a controlled `4xx` response.

## 7. Mobile Imports

### POST /imports/mobile-time-logs

Imports normalized mobile capture records into backend `time_logs`.

Request:

```json
{
  "time_logs": [
    {
      "source_record_id": "local-20260610-001",
      "project_id": 1,
      "date": "2026-06-10",
      "start_time": "09:00",
      "end_time": "10:30",
      "duration_minutes": 90,
      "activity_name": "Backend schema design",
      "activity_type": "consume",
      "type_source": "user_selected",
      "note": "Captured offline."
    }
  ]
}
```

Required record fields are `date`, `duration_minutes`, `activity_name`, and
`activity_type`. Optional fields are `source_record_id`, `activity_id`,
`project_id`, `start_time`, `end_time`, `type_source`, and `note`. `start_time`
and `end_time` must be supplied together.

Accepted activity types are `restore`, `consuming`, `neutral`, and `destroy`.
The import endpoint also normalizes legacy `consume` to `consuming`.

Response:

```json
{
  "imported": 12,
  "skipped": 0,
  "needs_mapping": 3
}
```

Status: `201 Created`.

Records with unknown activity types are skipped and counted as
`needs_mapping`. Valid records without `project_id` are imported as ad hoc time
logs and counted as `needs_mapping` so the UI can later ask the user to map
them. Duplicate `source_record_id` values inside one batch are skipped. Invalid
payload shape returns `422`.

## 8. Weekly Review

### POST /reviews/weekly/generate

Request:

```json
{
  "week_start": "2026-06-08",
  "week_end": "2026-06-14",
  "mode": "deterministic_first"
}
```

`mode` defaults to `deterministic_first`. Use `supportive_text` to keep the
same deterministic evidence and structured findings while rewriting
`generated_text` through the review writing adapter. By default this uses the
local evidence-bound template writer so the demo works without secrets. Set
`THESEUS_REVIEW_WRITER=openai` and `OPENAI_API_KEY` to use the OpenAI Responses
API adapter; `THESEUS_OPENAI_MODEL` can override the default model. Provider
configuration or request failures return `502 Bad Gateway` from the generate
endpoint. OpenCode Go is available with `THESEUS_REVIEW_WRITER=opencode_go` and
`OPENCODE_GO_API_KEY`; it uses `deepseek-v4-pro` by default through the provider's
OpenAI-compatible Chat Completions endpoint. `OPENCODE_GO_MODEL` and
`OPENCODE_GO_ENDPOINT` can override those defaults.

Response:

The `evidence.goals` and `evidence.projects` arrays are abbreviated in this example
for readability. Real responses include the populated goal and project evidence rows
defined by the Sprint 2 evidence contract.

```json
{
  "week_start": "2026-06-08",
  "week_end": "2026-06-14",
  "wins": [
    {
      "title": "Prototype work started",
      "evidence": "Theseus MVP received 6.0 hours."
    }
  ],
  "insights": [
    {
      "title": "Goal-time alignment is improving",
      "evidence": "The highest priority goal received the most project time."
    }
  ],
  "risk_flags": [
    {
      "type": "slack_risk",
      "severity": "medium",
      "evidence": "Planned workload used 90% of available capacity."
    }
  ],
  "next_steps": [
    {
      "title": "Protect one 2-hour implementation block",
      "reason": "Keeps progress realistic without overfilling the week."
    }
  ],
  "evidence": {
    "schema_version": "sprint2.review_evidence.v1",
    "summary": {
      "planned_total_minutes": 660,
      "actual_total_minutes": 450,
      "goal_count": 2,
      "project_count": 3,
      "time_log_count": 5,
      "reflection_count": 1
    },
    "goals": [],
    "projects": [],
    "plan": {
      "planned_capacity_minutes": 1800,
      "planned_total_minutes": 660,
      "planned_slack_minutes": 1140,
      "required_slack_minutes": 360,
      "slack_status": "healthy",
      "project_drift": [
        {
          "project_id": 2,
          "project_title": "Theseus frontend",
          "planned_minutes": 240,
          "actual_minutes": 60,
          "difference_minutes": -180,
          "difference_ratio": 0.75,
          "status": "under_plan"
        }
      ],
      "unplanned_project_minutes": 0,
      "unplanned_projects": []
    },
    "activity": {
      "mix": {
        "consuming": 300,
        "neutral": 0,
        "restore": 60,
        "destroy": 90
      },
      "total_minutes": 450,
      "unlinked_minutes": 150
    },
    "reflections": {
      "count": 1,
      "small_win_count": 1,
      "mood_note_count": 0,
      "free_note_count": 1
    },
    "dormancy": {
      "projects": [
        {
          "project_id": 3,
          "project_title": "Resume and applications",
          "weekly_min_minutes": 60,
          "actual_minutes": 0,
          "last_activity_date": "2026-05-15",
          "inactive_days": 30,
          "risk_level": "high",
          "missed_weekly_minimum": true
        }
      ]
    }
  },
  "generated_text": "Win: ... Insight: ... Risk: ... Next step: ...",
  "model_name": null,
  "created_at": "2026-07-15T12:00:00",
  "updated_at": "2026-07-15T12:00:00"
}
```

If no matching weekly plan exists for the authenticated account, the endpoint returns
`404`. The endpoint reads only that user's normalized evidence from SQLite,
calls the framework-independent review engine, and stores the structured result
under the same user before responding.

## 9. Validation and Errors

- Invalid request data returns `422`.
- A missing, invalid, expired, forged, or revoked Bearer token on a user-owned
  endpoint returns controlled `401` JSON with `WWW-Authenticate: Bearer`.
- Refresh without a matching CSRF cookie/header returns `403`; an expired or
  reused refresh session returns `401` and clears cookies.
- Missing referenced entities return `404` or `409`, depending on whether the operation is a lookup or a conflicting write.
- Weekly-plan replacement is whole-resource and atomic; it never leaves a
  partially replaced item collection.
- A reference to another user's goal, project, activity, or plan is rejected as
  `409`; APIs never fall back to an unscoped lookup.
- Create requests never accept database-managed IDs or timestamps.
- User-owned create bodies never accept `user_id`; ownership comes only from
  authenticated server context.
- Empty optional strings are accepted; required names and titles must not be empty.
- `start_time` and `end_time` must be supplied together.
- Batch mobile imports report unresolved `activity_id` or `project_id` as record-level `skipped` and `needs_mapping` counts instead of failing the whole request.

## 10. Evaluation

Planned contract only: this endpoint is not implemented in the 2026-07-18
checkpoint.

### POST /evaluation/review-feedback

Request:

```json
{
  "review_id": 1,
  "factual_accuracy": 5,
  "goal_relevance": 4,
  "positive_recognition": 5,
  "actionability": 4,
  "restraint": 4,
  "slack_protection": 4,
  "risk_detection": 4,
  "comments": "The review was clear and realistic."
}
```

## 11. Accepted Agent-Foundation Contract

Current implementation status: STORY-036 Task routes, Plan Task links, and
TimeLog Task links are implemented, verified, and product-owner accepted on
the schema-v5 runtime baseline. STORY-033 Activity routes are also
product-owner accepted. Section 11.5 and the schema-v6 Focus provenance/exact
seconds subset of Section 11.6 are implemented, automatically verified, and
product-owner accepted through STORY-037.
TimeLog correction, removal, revision, and Undo remain future runtime
contracts.

Implementation is split across STORY-036, STORY-033, STORY-037, and STORY-034.
Each story must update this status only for the routes it actually delivers.

### 11.1 Mutation, Ownership, And Concurrency Rules

- Browser requests continue using the formal Bearer session described above.
- Request bodies never accept `user_id`. Every Task, Activity, FocusSession,
  TimeLog, and referenced Project is resolved inside the authenticated account.
- Cross-account references return `409` without revealing whether the foreign
  record exists.
- Focus commands and every TimeLog mutation/Undo require an opaque
  `Idempotency-Key` header. Keys are scoped to the authenticated account.
- A repeated key with the same normalized operation and payload returns the
  original status and response. Reusing it with a different target or payload
  returns `409 idempotency_conflict`.
- Receipts for terminal Focus commands and TimeLog mutations remain available
  while their target record is retained; cleanup cannot weaken exactly-once
  replay behavior.
- Versioned requests include `expected_version`. A new command against a stale
  version returns `409 version_conflict` with the current safe read
  representation. A replay using an already completed idempotency key still
  returns the original result.
- Services own validation, transactions, idempotency, and state transitions.
  Routes contain no SQL. LangGraph and channel adapters later call the same
  services rather than repositories.
- UTC instants use ISO 8601 with `Z`. Task due dates and TimeLog `date` values
  are account-local ISO dates.

New conflict responses use a stable detail shape:

```json
{
  "detail": {
    "code": "version_conflict",
    "message": "The record changed after it was loaded",
    "current": {}
  }
}
```

`current` is omitted when returning it would disclose unrelated data.

### 11.2 Tasks

Implementation status: STORY-036 accepted on 2026-07-22 PDT.

#### POST /tasks

Creates one finite, durable outcome:

```json
{
  "project_id": 1,
  "title": "Draft final report",
  "description": "Complete the findings and limitations sections.",
  "priority": 1,
  "estimated_minutes": 240,
  "due_date": "2026-08-01"
}
```

Status: `201 Created`.

The server sets `status = open`, `created_source = user`,
`completed_at = null`, and `archived_at = null`. Later approved Assistant
operations may set `created_source = assistant_approved`; a public client
cannot claim that provenance.

Response:

```json
{
  "id": 21,
  "user_id": 1,
  "project_id": 1,
  "title": "Draft final report",
  "description": "Complete the findings and limitations sections.",
  "status": "open",
  "priority": 1,
  "estimated_minutes": 240,
  "due_date": "2026-08-01",
  "created_source": "user",
  "completed_at": null,
  "archived_at": null,
  "version": 1,
  "created_at": "2026-08-03T18:00:00Z",
  "updated_at": "2026-08-03T18:00:00Z"
}
```

#### GET /tasks

Optional query parameters:

- `project_id`
- repeated `status`
- `include_archived`, default `false`
- `due_from` and `due_to`

Ordering is archived last, then due date with null last, priority, and ID.

#### GET /tasks/{task_id}

Returns one user-owned Task. Missing, foreign, or normally hidden archived
records return `404`; `include_archived=true` may be used by the management
surface.

#### PATCH /tasks/{task_id}

Accepts one or more of:

```json
{
  "expected_version": 1,
  "title": "Draft and revise final report",
  "description": null,
  "priority": 1,
  "estimated_minutes": 300,
  "due_date": "2026-08-01",
  "status": "in_progress",
  "archived": false
}
```

`description`, `estimated_minutes`, and `due_date` accept explicit `null` to
clear them. `completed_at`, `archived_at`, and `version` are server-managed.
Every successful mutation increments `version`.

Allowed lifecycle transitions:

```text
open -> in_progress | completed | cancelled
in_progress -> open | completed | cancelled
completed -> in_progress
cancelled -> open
```

Archive and restore are reversible visibility changes independent of status.
Archiving a Task with an open FocusSession returns `409 task_in_use`. There is
no normal hard-delete Task route; account deletion remains the ownership-level
destructive operation.

### 11.3 Activities

Implementation status: STORY-033 product-owner accepted on
`feature/033-persisted-activities` after browser, stable-ID TimeLog linkage,
and backend-restart verification on 2026-07-25 PDT.

#### POST /activities

```json
{
  "project_id": 1,
  "name": "Focused writing",
  "description": "Drafting or revising report prose.",
  "activity_type": "consuming",
  "type_source": "user_selected"
}
```

Status: `201 Created`.

For the authenticated public route, `type_source` may be omitted or
`user_selected`; the server rejects a client that claims `ai_suggested`.
Future approved Assistant proposals may call the internal ActivityService with
`ai_suggested` provenance.

#### GET /activities

Optional `project_id` filters project-scoped Activities. Global Activities have
`project_id = null`. Results are ordered by name case-insensitively and ID.

#### GET /activities/{activity_id}

Returns one user-owned Activity.

#### PATCH /activities/{activity_id}

Requires `expected_version` and accepts one or more of `project_id`, `name`,
`description`, and `activity_type`. Explicit null clears `project_id` or
`description`. Activity reads include a server-managed `version`, beginning at
1 and incremented by every correction.

When the authenticated user changes `activity_type`, the server records
`type_source = user_corrected`. The client cannot claim `ai_suggested`.
Renaming or reclassifying an Activity does not rewrite historical
FocusSession or TimeLog snapshots.

Changing the Activity Project while its FocusSession is open returns
`409 activity_in_use`; snapshot-safe name, description, and type correction may
still proceed.

Activities are not hard-deleted in STORY-033. A later archive contract must
return to product-owner review rather than being added implicitly.

### 11.4 WeeklyPlan Task References

Implementation status: STORY-036 accepted on 2026-07-22 PDT.

`POST /weekly-plans` and `PUT /weekly-plans/{plan_id}` accept optional
`task_id` on each item:

```json
{
  "task_id": 21,
  "project_id": 1,
  "title": "Draft findings section",
  "planned_minutes": 120,
  "priority": 1
}
```

When `task_id` is present, `project_id` may be omitted and is filled from the
Task. If both are supplied they must match. The Task, Project, and WeeklyPlan
must have the same owner. The PlannedItem title remains a weekly snapshot and
`is_completed` does not silently change durable Task status.

Existing requests without `task_id` retain their pre-v5 behavior.

### 11.5 Focus Sessions

Implementation status: STORY-037 is implemented and product-owner accepted.
Backend, frontend, migration, production-build, persisted-review, and browser
verification pass.

FocusSession is the durable live timer boundary. It is intentionally distinct
from `auth_sessions`.

#### POST /focus-sessions

Requires `Idempotency-Key`.

```json
{
  "activity_id": 7,
  "task_id": 21
}
```

`activity_id` is required. `task_id` is optional. The server derives the
Project, captures Activity/Task snapshots and the account timezone, creates a
`running` session, and opens its one segment in one transaction.

An `open` Task becomes `in_progress` as part of that transaction. A completed,
cancelled, or archived Task returns `409 task_not_runnable` until the user
explicitly reopens or restores it.

If the account timezone is not a valid IANA timezone, start returns
`409 invalid_account_timezone` and creates nothing. The user must correct the
account setting explicitly.

Status: `201 Created`.

Response:

```json
{
  "id": 31,
  "user_id": 1,
  "activity_id": 7,
  "task_id": 21,
  "project_id": 1,
  "activity_name": "Focused writing",
  "activity_type": "consuming",
  "type_source": "user_selected",
  "task_title": "Draft final report",
  "timezone": "America/Los_Angeles",
  "status": "running",
  "accumulated_seconds": 0,
  "current_run_started_at": "2026-08-03T18:05:00Z",
  "elapsed_seconds": 0,
  "version": 1,
  "started_at": "2026-08-03T18:05:00Z",
  "completed_at": null,
  "cancelled_at": null,
  "created_at": "2026-08-03T18:05:00Z",
  "updated_at": "2026-08-03T18:05:00Z"
}
```

`elapsed_seconds` is calculated at response time from the server-owned open
segment. It is not a background counter.

A second running session for the same Activity returns
`409 activity_already_open` with the existing same-user session ID. Different
Activities may run concurrently.

#### GET /focus-sessions

Optional `state=open` returns running sessions. Repeated `status` filters exact
statuses. Ordering is running first, then start time and ID.

#### GET /focus-sessions/{session_id}

Returns the current user-owned session. Completed and cancelled sessions remain
inspectable.

#### POST /focus-sessions/{session_id}/commands

Requires `Idempotency-Key`.

End:

```json
{
  "command": "end",
  "expected_version": 1
}
```

Cancel uses `command = cancel`. The v6 terminal commands accept no result or
note form; later notes are edited on the generated TimeLog through the v7
correction contract. Valid transitions are:

```text
running -> completed | cancelled
completed -> no transitions
cancelled -> no transitions
```

Status: `200 OK`.

Command response:

```json
{
  "session": {},
  "time_logs": []
}
```

The first successful End closes the open segment, groups exact seconds by the
session timezone, atomically creates at most one TimeLog per affected local
date, stores the final `accumulated_seconds`, increments the session version,
marks the session completed, and stores a response containing those TimeLogs
in the idempotency receipt. A replay returns that original session and those
TimeLogs without creating new rows or incrementing the version again.

The first successful Cancel closes the segment, increments the session version,
marks the session cancelled, and returns an empty `time_logs` list. A completed
or cancelled session cannot be reopened; the user starts a new session. Ending
Focus never silently marks a linked Task completed, and cancelling Focus does
not silently cancel or reopen the Task.

### 11.6 TimeLog Read, Correction, Removal, And Undo

STORY-036 implements nullable `task_id` input/linkage and the server-owned
`task_title` snapshot on the existing create, batch, mobile-import, and list
paths. The STORY-037 schema-v6 runtime implements nullable
`focus_session_id` and canonical `duration_seconds` on TimeLog reads. TimeLog
versions, correction, soft deletion, revisions, review invalidation, Undo, and
mutation idempotency remain owned by schema v7.

In schema v6, the existing `TimeLogRead` shape includes nullable `task_id`,
`focus_session_id`, `task_title`, and required `duration_seconds`. Legacy rows
are represented with `duration_seconds = duration_minutes * 60` and null
extension links. Schema v7 later adds `deleted_at` and required `version`.

After schema v6, `duration_seconds` is positive and canonical.
`duration_minutes` is a non-negative compatibility and Review value. A
sub-minute local-day slice may legitimately expose zero minutes while retaining
positive seconds.

After their owning migrations:

- `POST /time-logs`, `POST /time-logs/batch`, and mobile import accept optional
  `task_id`;
- schema-v6 manual and imported writes continue accepting
  `duration_minutes`, with the service deriving exact seconds;
- schema-v7 manual and imported writes may accept either `duration_minutes` or
  `duration_seconds` and derive the other representation;
- `focus_session_id`, `task_title`, user ownership, and snapshot provenance are
  always server-controlled;
- Task, Activity, and explicit Project links must resolve to one same-user
  Project.

#### GET /time-logs

The existing list adds optional:

- `date_from` and `date_to`
- `project_id`, `task_id`, and `activity_id`
- `include_deleted`, default `false`

Ordering remains local date, start time, and ID. Soft-deleted rows never appear
in normal Today totals or review input.

#### GET /time-logs/{time_log_id}

Returns one user-owned record. A soft-deleted row returns `404` unless
`include_deleted=true`.

#### PATCH /time-logs/{time_log_id}

Requires `Idempotency-Key`.

Example correction:

```json
{
  "expected_version": 1,
  "duration_seconds": 3300,
  "activity_type": "neutral",
  "note": "Corrected an accidentally running timer.",
  "reason": "Timer was left on."
}
```

The request may correct Activity, Task, Project, date/times, duration, snapshots,
type, or note. Link ownership and Project agreement are revalidated. Changing
the type sets `type_source = user_corrected`.

Status: `200 OK`.

Response:

```json
{
  "time_log": {},
  "revision_id": 41,
  "affected_review_weeks": [
    {
      "week_start": "2026-08-03",
      "week_end": "2026-08-09"
    }
  ]
}
```

`duration_minutes` is derived from the accepted exact seconds rule. A
schema-v4 client may continue sending `duration_minutes`; sending both values
with an inconsistent result returns `422`. Whole-session rounding uses
`floor((total_seconds + 30) / 60)` before largest-remainder allocation across
local dates.

For a Focus-produced daily TimeLog, `start_time` and `end_time` are the earliest
and latest local boundaries for that date. Paused intervals inside those bounds
are represented by FocusSession segments and are not counted in
`duration_seconds`.

#### DELETE /time-logs/{time_log_id}?expected_version=2

Requires `Idempotency-Key`.

Soft-deletes one record and returns the same mutation-result shape with a new
revision ID. Status: `200 OK`. Deleting an already deleted record with a new
command returns `409 invalid_state`.

#### POST /time-logs/{time_log_id}/revisions/{revision_id}/undo

Requires `Idempotency-Key`.

```json
{
  "expected_version": 3
}
```

Restores the complete `before` representation when it still belongs to the
same user and passes current link validation. Undo creates another audit
revision and returns the mutation-result shape. It never erases history.

Every correction, deletion, or Undo transaction:

- recalculates `projects.last_activity_date` for both the old and new Project;
- marks stored WeeklyReviews overlapping the old or new local date with
  `stale_at`;
- leaves unrelated users and weeks unchanged;
- refreshes Today totals from the committed rows.

Review generation ignores deleted rows, uses corrected values, preserves the
WeeklyReview ID, and clears `stale_at`. Existing generated review content is
not silently rewritten before regeneration.

After schema v7, successful manual TimeLog creation, batch creation, mobile
import, and Focus completion also mark overlapping stored WeeklyReviews stale
in the same transaction. This prevents a previously generated review from
appearing current after new evidence arrives.

### 11.7 Implementation And Test Boundary

The accepted service boundary is:

```text
FastAPI route or future Assistant tool
  -> authenticated domain service
  -> user-scoped repositories
  -> SQLite transaction
```

Task lifecycle belongs to `TaskService`; Activity correction to
`ActivityService`; Focus transitions and segment allocation to `FocusService`;
TimeLog corrections, project-date recalculation, revision, and review
invalidation to `TimeLogService`. The existing `ReviewService` remains the only
persisted path into the framework-independent review engine.

OpenAPI must not expose any Section 11 operation until its implementation,
failure tests, migration tests, and current-story acceptance gate pass.

## 12. Trust, Memory, And Action Ledger

STORY-025A is the accepted schema-v8 repository/domain-service foundation.
STORY-025B implements the following authenticated API and was product-owner
accepted on 2026-07-25 PDT after automated contract and persistence
verification.

### 12.1 Preferences

```text
POST   /preferences
GET    /preferences?source=&include_deleted=
GET    /preferences/{preference_id}?include_deleted=
PATCH  /preferences/{preference_id}
DELETE /preferences/{preference_id}?expected_version=&reason=
POST   /preferences/{preference_id}/restore
```

Public create accepts only `preference_key`, JSON `value`, `scope_type`, and
`scope_ref_id`. The server records `source = user_stated`; clients cannot claim
inference provenance or confidence.

Correction accepts `expected_version`, JSON `value`, and optional `reason`.
Correcting an inferred preference turns the record into a user-stated
preference and records its former source/version in provenance. Correction,
soft deletion, and restore return the new record plus `revision_id`. Detail
returns the owned record and its ordered append-only revisions.

### 12.2 Proposals, Decisions, And Outcomes

```text
POST /proposals
GET  /proposals?status=
GET  /proposals/{proposal_id}
POST /proposals/{proposal_id}/decisions
POST /proposals/{proposal_id}/outcomes
PATCH /proposals/{proposal_id}/outcomes/{outcome_id}/consent
```

Public proposal creation records `source = deterministic`; a client cannot
claim `assistant`. Proposal detail includes ordered decisions, audit-only
actions, and outcomes. Decisions accept `expected_version`, `decision`, an
optional edited after-state, and reason. Expired proposals return
`409 proposal_expired`; stale or already-decided proposals return
`409 version_conflict`.

Outcome feedback may record completion, usefulness from 1-5, actual duration,
energy feedback, a note, and explicit personalization consent. Consent defaults
to `false`; existing outcomes migrated to schema v13 remain unconsented. A
referenced Action must belong to the same account and Proposal.

Consent correction accepts `expected_version` and
`personalization_consent`. It updates only the consent fields, increments
`consent_version`, and returns `409 version_conflict` with the current safe
outcome when stale. It does not alter the recorded result or usefulness.

There is deliberately no public generic Action-create or Action-execute route
in STORY-025B. Actions retain user-scoped idempotency, request/result,
verification, failure, reversibility, and Undo links inside the domain
service. A future bounded Assistant API may call typed execution operations;
neither a browser nor a model receives arbitrary operation authority.

All requests derive `user_id` from authentication. Cross-account resources
return a non-disclosing `404`, optimistic conflicts include the current safe
read representation, and multi-record mutations are transactional.

### 12.3 Consented Personalization Baseline

```text
GET /personalization/baseline
```

The authenticated, read-only v1 baseline counts only proposal outcomes whose
explicit consent is currently enabled. It reports per-proposal-type outcome
counts, usefulness averages, result counts, and a deterministic completion
rate. Fewer than five consented outcomes returns `status =
insufficient_data`. At five it returns `status = ready`; in both states
`ranking_applied` remains `false`. This slice neither creates inferred
preferences nor changes suggestion ordering.

## 13. Bounded Assistant API

STORY-038A introduced the first automatically verified and product-owner
accepted operation on 2026-07-26 PDT. It is read-only, deterministic, and
available without an external model key. Proposal drafting, approval,
execution, and language interpretation remain outside this slice.

### 13.1 Read Assistant Context

```text
GET /assistant/context?week_start=YYYY-MM-DD&week_end=YYYY-MM-DD
```

Both dates are required and the inclusive window must contain between 1 and
31 days. Invalid or unbounded windows return:

```json
{
  "detail": {
    "code": "invalid_context_window",
    "message": "Assistant context must cover between 1 and 31 days"
  }
}
```

The authenticated response has `context_version = "v1"` and includes the
account's timezone and locale, current Goals, Projects, Tasks, Activities, the
exact-window WeeklyPlan, running FocusSessions, non-deleted TimeLogs in the
window, active Preferences, and an optional exact-window WeeklyReview summary.

The review summary contains Wins, Risks, Next Steps, staleness, and timestamps.
It deliberately excludes generated prose and the full evidence JSON. The
context includes only active Goals, active Projects, open/in-progress Tasks,
and Activities that are unbound or belong to an active Project. It excludes
email, credentials, auth sessions, deleted Preferences, completed/cancelled
Tasks, completed FocusSessions, and data from every other account.

`GET /assistant/context` delegates aggregation to
`AssistantContextService`, which calls existing user-scoped services and
repositories. No SQL or review rules live in the route, and no `/assistant`
write operation is exposed in STORY-038A.

### 13.2 Draft A Weekly Plan Adjustment

Implementation status: STORY-038B was product-owner accepted on 2026-07-26
PDT after automated API, persistence, idempotency, and rollback verification.

```text
POST /assistant/proposals/weekly-adjustment
Idempotency-Key: <opaque client key>
```

Request:

```json
{
  "review_week_start": "2026-06-08",
  "review_week_end": "2026-06-14",
  "target_week_start": "2026-06-15",
  "target_week_end": "2026-06-21"
}
```

Each explicit inclusive window must contain between 1 and 31 days. The
authenticated service requires a current exact-window stored WeeklyReview and
its reviewed WeeklyPlan. A stale review returns
`409 weekly_review_stale`; missing source data returns a non-disclosing `404`.

The deterministic policy selects the highest-ratio supported `under_plan`
Project from `weekly_review.evidence.plan.project_drift`. It proposes a
bounded restart allocation of `max(30, actual_minutes)` only when that value is
lower than the current target allocation. If no supported reduction exists,
the route returns `409 weekly_adjustment_unavailable`.

Status: `201 Created`. The response is the normal `ProposalRead` shape with:

- `proposal_type = weekly_plan_adjustment`;
- `source = deterministic` and `status = pending`;
- evidence identifying the stored review and exact Project-drift row;
- `before.weekly_plan` containing the existing target plan, or null when none
  exists;
- `after.weekly_plan` containing a complete future plan command shape with the
  proposed allocation.

The operation writes only the Proposal and its idempotency receipt. It never
creates or replaces a WeeklyPlan. Replaying the same key and payload returns
the original Proposal; key reuse with another payload returns
`409 idempotency_conflict`. A different key for the same stored-review version
and target window reuses the same Proposal rather than creating a duplicate.
Receipt, Proposal, and failure rollback share one transaction.

### 13.3 Execute An Approved Weekly Plan Proposal

Implementation status: STORY-038C was product-owner accepted on 2026-07-26
PDT after focused API, persistence, idempotency, rollback, full-suite,
compilation, and deterministic sample-review verification.

```text
POST /assistant/proposals/{proposal_id}/execute-weekly-plan
Idempotency-Key: <opaque action key>
```

Request:

```json
{
  "expected_version": 2
}
```

Only an owned `weekly_plan_adjustment` Proposal in `approved` state may enter
this operation. An `approve` decision uses the Proposal's original
`after.weekly_plan`; an `edit` decision uses its complete `decided_after`
WeeklyPlan. Edited approval may change the plan values and items but cannot
silently move the change to another target week.

Before writing, the service validates the complete `WeeklyPlanCreate` shape
and compares the target Plan with `before.weekly_plan`. A null before-state
requires that no target Plan exists and creates one. A populated before-state
must match the current Plan and is atomically replaced. Any intervening change
returns `409 weekly_plan_state_conflict` without overwriting it.

Status: `200 OK`. Response:

```json
{
  "proposal": {},
  "action": {},
  "weekly_plan": {}
}
```

The successful transaction:

- creates one Action tied to the approving Decision and opaque idempotency key;
- creates or replaces the target WeeklyPlan through `WeeklyPlanService`;
- reads the stored Plan back and verifies it matches the approved after-state;
- marks the Proposal `executed` with an incremented version;
- marks the Action `succeeded` with the stored Plan, verification result,
  operation, and Plan ID.

The Action is marked reversible and retains the full approved before/after
request for a later typed Undo slice. STORY-038C does not expose generic Action
execution or an Undo endpoint.

An exact idempotency replay returns the original Proposal, Action, and Plan
without another write. Key reuse for another action returns
`409 idempotency_conflict`. Missing/foreign Proposals return `404`; pending or
rejected Proposals, unsupported proposal types, stale proposal versions,
invalid stored payloads, invalid links, and verification failures return
controlled `409` responses. Proposal, Action, and Plan success writes commit
or roll back together.

### 13.4 Undo A Weekly Plan Action

Implementation status: STORY-038D was product-owner accepted on 2026-07-26
PDT after focused API, atomic persistence, idempotency, rollback, OpenAPI,
account-isolation, compilation, and deterministic sample-review verification.
The independently tracked long-process authentication-test flake does not
change this public contract.

```text
POST /assistant/proposals/{proposal_id}/actions/{action_id}/undo-weekly-plan
Idempotency-Key: <opaque action key>
```

Request:

```json
{
  "expected_version": 3
}
```

This is a typed inverse of Section 13.3, not a generic Action executor. The
authenticated account must own both path records. The Proposal must be
`executed`, and the selected Action must belong to it, be `succeeded`, be
marked reversible, and use `weekly_plan.create` or `weekly_plan.replace`.

Before writing, the service validates the Action's recorded before/after
payload and verified persisted Plan. The target Plan must still have the same
ID and complete command representation as the successful Action result. A
later edit returns `409 weekly_plan_state_conflict` without creating an Undo
Action or changing the original Action or Proposal.

Status: `200 OK`. Response:

```json
{
  "proposal": {},
  "action": {},
  "undone_action": {},
  "weekly_plan": null
}
```

For an original create, Undo deletes that exact target Plan and returns
`weekly_plan = null`. For an original replace, Undo restores the exact recorded
before-state while preserving the target Plan ID. The successful transaction:

- creates one non-reversible `weekly_plan.undo_create` or
  `weekly_plan.undo_replace` Action linked by `undo_of_action_id`;
- restores the recorded before-state through `WeeklyPlanService`;
- reads back and verifies absence or exact equality;
- marks the original Action `undone` and records `undone_at`;
- marks the Proposal `undone` with an incremented version;
- finishes the Undo Action as `succeeded` with verification evidence.

All writes commit or roll back together. Exact key replay returns the original
Undo result; another payload using the key returns `409 idempotency_conflict`.
Missing or foreign records return non-disclosing `404` responses. Unsupported,
already-undone, stale-version, malformed-payload, drift, and persistence states
return controlled `409` responses.

## 14. Channel Identity And Scoped Integration Access

Implementation status: STORY-039 was product-owner accepted on 2026-07-26
PDT. Browser-authenticated management operations are:

```text
POST   /integrations/pair
GET    /integrations
DELETE /integrations/{credential_id}
```

Pairing accepts `label`, `channel_type`, raw `external_identity`, one or more
of `context:read`, `proposal:create`, `proposal:decide`, `action:execute`, and
`action:undo`,
and an expiry from
300 to 2,592,000 seconds. The response returns the integration `access_token`
exactly once. Lists return only its prefix and lifecycle metadata; neither raw
token nor raw external identity is readable later. Duplicate active channel
identity returns `409 channel_identity_already_paired`; foreign management is
non-disclosing `404`. Delete returns `204` and revokes the credential/binding
without deleting domain data.

Schema v12 makes the durable channel constraint match the documented
`local_test | openclaw | telegram | whatsapp` API enum. Only the active
channel-identity unique constraint is mapped to
`409 channel_identity_already_paired`; unrelated persistence integrity errors
are not misreported as an existing pairing.

The read-only channel operation is:

```text
GET /integrations/channel/context?week_start=&week_end=
Authorization: Bearer <integration token>
X-Channel-Type: local_test | openclaw | telegram | whatsapp
X-External-Identity: <paired external identity>
X-External-Message-ID: <channel message ID>
```

It requires `context:read` and delegates to `AssistantContextService`. Invalid,
expired, revoked, or mismatched credentials return one redacted
`401 integration_access_denied`; insufficient scope returns
`403 integration_scope_denied`. Reusing one external message ID with another
request returns `409 external_message_replay_conflict`. The receipt stores only
HMAC/hash metadata, not the external identifiers or Assistant context payload.

### 14.1 Draft A Channel Weekly Plan Adjustment

Implementation status: STORY-027 rollout gate two is a draft-only channel
operation. It never approves or executes a proposal.

```text
POST /integrations/channel/proposals/weekly-adjustment
Authorization: Bearer <integration token>
X-Channel-Type: local_test | openclaw | telegram | whatsapp
X-External-Identity: <paired external identity>
X-External-Message-ID: <channel message ID>
```

The JSON body is the `AssistantWeeklyPlanProposalRequest` date-window shape
from Section 13.2. The endpoint requires `proposal:create`, authenticates the
same scoped channel binding, and delegates to
`AssistantWeeklyPlanProposalService`. It returns `201 Created` with the normal
`ProposalRead` response, whose status is always `pending`; it writes neither a
WeeklyPlan nor an Action.

The server derives an opaque, user-scoped Assistant idempotency key from the
paired credential and external message ID. Thus an exact channel retry returns
the original proposal, while reusing a message ID for another operation or
payload returns `409 external_message_replay_conflict`. Integration receipts
retain only HMAC/hash metadata and never store the proposal response. Invalid,
expired, revoked, or mismatched credentials return the same redacted `401
integration_access_denied`; missing scope returns `403
integration_scope_denied`.

### 14.2 Decide A Channel Weekly Plan Proposal

Implementation status: STORY-027 rollout gate three records only a narrow
approval response. It never executes a plan change.

```text
POST /integrations/channel/proposals/{proposal_id}/decision
Authorization: Bearer <integration token>
X-Channel-Type: local_test | openclaw | telegram | whatsapp
X-External-Identity: <paired external identity>
X-External-Message-ID: <channel message ID>
```

The JSON body accepts `expected_version`, `decision` (`approve` or `reject`),
and an optional `reason`. It requires the distinct `proposal:decide` scope and
delegates to `ProposalLedgerService`, which appends the decision and changes the
owned pending Proposal to `approved` or `rejected`. It cannot accept `edit` or
`expire`, writes neither a WeeklyPlan nor an Action, and exposes no channel
execution endpoint.

The same HMAC-protected message receipt contract applies: an exact retry
returns the original decision, whereas reusing its message ID for a different
proposal or payload returns `409 external_message_replay_conflict`. Stale,
already decided, or expired proposals return controlled `409` responses;
missing proposals return `404 proposal_not_found`. Invalid, expired, revoked,
or mismatched credentials return redacted `401 integration_access_denied`, and
missing scope returns `403 integration_scope_denied`.

### 14.3 Execute An Approved Channel Weekly Plan Proposal

```text
POST /integrations/channel/proposals/{proposal_id}/execute-weekly-plan
Authorization: Bearer <integration token>
X-Channel-Type: local_test | openclaw | telegram | whatsapp
X-External-Identity: <paired external identity>
X-External-Message-ID: <channel message ID>
```

The body accepts only `expected_version`. The endpoint requires `action:execute`
and delegates to `AssistantWeeklyPlanExecutionService`; it only accepts an
approved `weekly_plan_adjustment` Proposal, derives its opaque Action idempotency
key from the pairing and external message ID, and preserves its existing Action,
verification, and Undo data. Exact retries return the original execution;
different reuse returns `409 external_message_replay_conflict`. It exposes no
generic execution or arbitrary plan-write shape.

### 14.4 Undo A Channel Weekly Plan Action

```text
POST /integrations/channel/proposals/{proposal_id}/actions/{action_id}/undo-weekly-plan
Authorization: Bearer <integration token>
X-Channel-Type: local_test | openclaw | telegram | whatsapp
X-External-Identity: <paired external identity>
X-External-Message-ID: <channel message ID>
```

The body accepts only `expected_version`. This is a separately bounded
`action:undo` permission, not an extension of `action:execute`. It delegates to
`AssistantWeeklyPlanUndoService` and can undo only the successful, reversible
Action belonging to the specified `weekly_plan_adjustment` Proposal. The
existing action verification and undo record remain canonical. Exact retries
return the original undo response; a changed request with the same message ID
returns `409 external_message_replay_conflict`. It exposes no arbitrary plan
delete, replace, or generic Action undo shape.
