# Mobile Capture Plan

This document defines the planned mobile capture module for Theseus.

The course implementation should be developed in this repository. The mobile module is part of the product roadmap, but it should not block Sprint 1 backend and review-engine work.

## 1. Position

Theseus needs actual time evidence. A mobile capture module is the most natural way to collect that evidence with low user effort.

Planned module name:

```text
Theseus Capture
```

Role:

- fast activity timing
- local offline records
- activity type selection
- CSV/JSON export
- future sync support

The review UI can remain web-first while the mobile module focuses on time capture.

## 2. Scope

### Near-Term

The first mobile-related goal is not full sync. The first goal is an export contract:

```text
mobile records -> normalized JSON export -> backend import -> weekly review
```

This keeps the architecture simple while making the mobile path real.

### Later

After the weekly review loop works:

```text
mobile app -> sync API -> backend DB -> weekly review
```

This can support multi-device continuity and automated weekly review.

## 3. Capture Data Contract

The capture module should export normalized records that match Theseus backend concepts:

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
      "activity_type": "consuming",
      "type_source": "user_selected",
      "note": ""
    }
  ]
}
```

Required record fields:

- `date`
- `duration_minutes`
- `activity_name`
- `activity_type`

Optional record fields:

- `source_record_id`: mobile-local ID for identifying records inside an export batch.
- `activity_id`: backend activity ID when the mobile record is already mapped.
- `project_id`: backend project ID when the mobile record is already mapped.
- `start_time` and `end_time`: must be supplied together.
- `type_source`: defaults to `user_selected`.
- `note`: defaults to an empty string.

Activity type values should match the proposal:

```text
restore
consuming
neutral
destroy
```

Legacy mobile exports may send `consume`; the backend import normalizes it to
`consuming`. Other unknown activity types are skipped and counted as
`needs_mapping`.

## 4. Mobile Data Model

Recommended local mobile entities:

| Entity | Purpose |
|---|---|
| Category | Optional grouping for activities |
| Activity | User-selectable activity definition |
| RunningTimer | Persisted timer state |
| TimeRecord | Completed time record |
| ExportBatch | Records prepared for backend import |

Recommended activity fields:

| Field | Notes |
|---|---|
| id | Local ID |
| name | User-visible name |
| category_id | Optional |
| color | UI color |
| icon | UI icon |
| activity_type | `restore`, `consuming`, `neutral`, `destroy` |
| sort_order | Display order |

Recommended record fields:

| Field | Notes |
|---|---|
| id | Local ID |
| activity_id | Source activity |
| start_time | Timestamp |
| end_time | Timestamp |
| duration_seconds | Raw duration |
| date | Local date |
| note | Optional |

## 5. Backend Import Endpoint

Planned endpoint:

```text
POST /imports/mobile-time-logs
```

Responsibilities:

- validate payload
- normalize duration into minutes
- preserve raw activity names
- store normalized activity type
- link to project only when user mapping exists
- return import summary

Import behavior:

- Valid mapped records are inserted into backend `time_logs`.
- Valid records without `project_id` are inserted as ad hoc time logs and counted as `needs_mapping`.
- Unknown activity types are not inserted and are counted as both `skipped` and `needs_mapping`.
- Duplicate `source_record_id` values inside the same batch are skipped.
- Invalid payload shape, invalid dates, invalid duration, or partial start/end time returns `422`.

Example response:

```json
{
  "imported": 12,
  "skipped": 0,
  "needs_mapping": 3
}
```

## 6. Sprint Timing

Recommended timing:

- Sprint 1: backend schema and persisted review loop
- Sprint 2: mobile capture module plan and import contract
- Sprint 3: import endpoint and frontend review page
- Sprint 4: optional mobile UI or sync prototype, depending on course progress

## 7. Non-Goals for Early Mobile Work

Do not make early mobile work depend on:

- production authentication
- cloud deployment
- multi-device conflict resolution
- wearable integration
- full weekly review UI inside the mobile app

These can come later after the core review loop is useful.
