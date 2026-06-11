# API Contract

The API uses JSON over HTTP. Authentication is optional for the local MVP and can be added later.

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

### GET /goals

Returns all goals.

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
  "generated_text": "Win: ... Insight: ... Next step: ..."
}
```

## 7. Evaluation

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

