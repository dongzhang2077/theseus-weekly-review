# API Contract

The API uses JSON over HTTP. Authentication is optional for the local MVP and can be added later.

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

## 2. Goals

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
  "title": "Research Proposal",
  "description": "Finish and refine applied research proposal work.",
  "priority": 1,
  "active_status": true
}
```

Status: `201 Created`.

### GET /goals

Returns all goals ordered by priority and ID. Persisted responses also include `created_at` and `updated_at`.

## 3. Projects

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

## 4. Weekly Plans

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

## 5. Time Logs

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

## 6. Weekly Review

### POST /reviews/weekly/generate

Request:

```json
{
  "week_start": "2026-06-08",
  "week_end": "2026-06-14",
  "mode": "deterministic_first"
}
```

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
  "generated_text": "Win: ... Insight: ... Risk: ... Next step: ..."
}
```

The persisted response also includes `id`, `created_at`, and `updated_at`. If no matching weekly plan exists, the endpoint returns `404`. The endpoint reads normalized evidence from SQLite, calls the framework-independent review engine, and stores the structured result before responding.

## 7. Validation and Errors

- Invalid request data returns `422`.
- Missing referenced entities return `404` or `409`, depending on whether the operation is a lookup or a conflicting write.
- Create requests never accept database-managed IDs or timestamps.
- Empty optional strings are accepted; required names and titles must not be empty.
- `start_time` and `end_time` must be supplied together.

## 8. Evaluation

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
