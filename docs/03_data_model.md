# Data Model

## 1. Core Entities

```text
LocalUser
  ├── Goal
  │     └── Project
  │           ├── Activity
  │           ├── PlannedItem
  │           └── TimeLog
  ├── WeeklyPlan
  │     └── PlannedItem
  ├── DailyReflection
  └── WeeklyReview
        ├── ReviewFinding
        └── ReviewRecommendation
```

`LocalUser` is an ownership root for the local MVP, not a production
authentication identity. `PlannedItem` inherits ownership from its
`WeeklyPlan`; every other persisted personal table stores `user_id` directly.

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
| id | integer pk | Stable local profile ID |
| display_name | text | Required |
| timezone | text | Required; defaults to `UTC` |
| locale | text | Required; defaults to `en` |
| created_at | datetime | System timestamp |
| updated_at | datetime | System timestamp |

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
| title | text | Required |
| planned_minutes | integer | Required |
| priority | integer | Optional |
| is_completed | boolean | Optional manual flag |
| created_at | datetime | System timestamp |
| updated_at | datetime | System timestamp |

Ownership is inherited through `weekly_plan_id`. When `project_id` is present,
the project must belong to the same user as the plan.

### time_logs

| Field | Type | Notes |
|---|---|---|
| id | integer pk | Internal ID |
| user_id | integer fk | Required owner; linked activity/project must have the same owner |
| activity_id | integer fk | Optional if activity is ad hoc |
| project_id | integer fk | Optional |
| date | date | Required |
| start_time | time | Optional |
| end_time | time | Optional |
| duration_minutes | integer | Required |
| activity_name | text | Raw user-visible name |
| activity_type | text enum | Copied for easier review queries |
| type_source | text enum | User or AI source |
| note | text | Optional |
| created_at | datetime | System timestamp |
| updated_at | datetime | System timestamp |

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
- Weekly plans are unique per `(user_id, week_start, week_end)`.
- Daily reflections are unique per `(user_id, date)`.
- Weekly reviews are unique per `(user_id, week_start, week_end)`; regeneration
  replaces that user's stored structured result while preserving its ID.
- Foreign keys and database triggers reject cross-user goal, project, activity,
  planned-item, and time-log references.
- Schema version 2 adds local ownership. Initializing a version 1 database
  migrates existing records to a generated `Local User` profile with ID `1`.

## 5. Reference Mapping Notes

If importing records from a timer or historical tracking source, fields can map into the Theseus schema as follows:

| Source Field | Theseus Field |
|---|---|
| `time_entries.activity` | `time_logs.activity_name` |
| `time_entries.duration_minutes` | `time_logs.duration_minutes` |
| `time_entries.bandwidth_type` | `time_logs.activity_type` |
| `projects.current_stage` | `projects.stage` |
| `reviews.summary` | `weekly_reviews.generated_text` |
