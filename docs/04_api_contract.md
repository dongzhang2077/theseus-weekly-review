# API Contract

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
