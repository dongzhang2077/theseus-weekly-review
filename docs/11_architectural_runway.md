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

- Goal
- Project
- WeeklyPlan
- PlannedItem
- TimeLog
- ActivityType
- DailyReflection
- WeeklyReview
- ReviewFinding
- RiskFlag
- ReviewRecommendation

The backend schema and review engine should be built around these concepts, not around one demo JSON file.

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

## 3. Target Module Boundaries

```text
backend/
  app/
    api/              HTTP endpoints
    db/               SQLite connection, schema, repositories
    schemas.py        API/Pydantic models
    services/         orchestration

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

Do not add production-grade auth or multi-user complexity in Sprint 1 unless it is required for the course demo.

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

Sprint 1 target.

### Stage C: Web Input

```text
web forms -> backend SQLite -> review_engine
```

Sprint 2 or Sprint 3 target.

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

## 10. Anti-Patterns to Avoid

Avoid:

- Treating `sample_week.json` as the real data model.
- Mixing review rule logic into FastAPI route files.
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
