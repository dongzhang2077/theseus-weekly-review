# Product Backlog

## Epic 1: Project Foundation

### STORY-001 Create GitHub-ready project workspace

As a team member, I want a clean repository structure so that development work is separated from pre-proposal exploratory files.

Priority: P0

Acceptance criteria:

- Repository has README, docs, backend, frontend, review engine, data sample, and evaluation folders.
- README explains scope and architecture.
- Proposal scope is reflected in docs.

### STORY-002 Define MVP architecture

As a team member, I want architecture documents so that backend, frontend, and review engine work can be split safely.

Priority: P0

Acceptance criteria:

- System architecture diagram exists.
- Data model exists.
- API contract exists.
- Review engine design exists.

## Epic 2: Data and Backend

### STORY-018 Define backend architectural runway

As a developer, I want stable module boundaries before implementing persistence so that Sprint 1 code can support later web, mobile, import, sync, and AI extensions.

Priority: P0

Acceptance criteria:

- Backend schema is based on stable domain entities, not only `sample_week.json`.
- Review engine logic remains independent from FastAPI routes.
- Data-source adapters are planned for sample JSON, web input, mobile export, and historical imports.
- Sync/auth complexity is explicitly deferred.

### STORY-003 Implement SQLite schema

As a backend developer, I want persistent tables for goals, projects, plans, logs, and reviews so that weekly reviews can be generated from stored data.

Priority: P0

Acceptance criteria:

- Schema includes goals, projects, activities, weekly plans, planned items, time logs, daily reflections, and weekly reviews.
- Activity type enum values are documented.
- Sample week can be loaded.

### STORY-004 Implement CRUD APIs

As a frontend developer, I want backend endpoints for goals, projects, plans, and logs so that the UI can save user input.

Priority: P0

Acceptance criteria:

- API supports create/list for goals.
- API supports create/list for projects.
- API supports create/list for weekly plans.
- API supports create/list for time logs.

### STORY-005 Add sample data loader

As a developer, I want a sample data loader so that the prototype can be demonstrated consistently.

Priority: P0

Acceptance criteria:

- Loader imports `data/sample/sample_week.json`.
- Loaded data can run through the review engine.

## Epic 3: Review Engine

### STORY-006 Goal-time alignment check

As a user, I want the review to show whether my time supported my goals.

Priority: P0

Acceptance criteria:

- The engine calculates actual minutes per goal and project.
- The engine flags zero-time active goals.
- Findings include evidence.

### STORY-007 Plan-vs-actual check

As a user, I want to see where my week drifted from the plan.

Priority: P0

Acceptance criteria:

- The engine compares planned minutes and actual minutes by project.
- The engine identifies major over/under differences.
- Findings include project-level evidence.

### STORY-008 Activity energy-impact analysis

As a user, I want to understand the balance between consuming, neutral, restore, and destroy activities.

Priority: P0

Acceptance criteria:

- The engine summarizes minutes by activity type.
- The engine can identify high destroy time.
- The engine can recognize restore activity as useful progress.

### STORY-009 Dormancy and slack risk checks

As a user, I want Theseus to detect dormant goals and unrealistic plans.

Priority: P0

Acceptance criteria:

- Active projects with no weekly time are flagged.
- Projects inactive for 21+ days are marked as wake-up risk.
- Plans that leave too little buffer are flagged.

### STORY-010 Generate weekly review text

As a user, I want a clear review with wins, insights, and next steps.

Priority: P0

Acceptance criteria:

- Review starts with wins.
- Review includes evidence-backed insights.
- Review gives no more than three next steps.
- Review avoids blaming language.

## Epic 4: Frontend

### STORY-011 Goal and project setup UI

Priority: P1

Acceptance criteria:

- User can create active goals.
- User can create projects linked to goals.
- User can set project stage.

### STORY-012 Weekly plan UI

Priority: P1

Acceptance criteria:

- User can create a weekly plan.
- User can add planned items.
- UI shows total planned minutes and slack estimate.

### STORY-013 Time-log UI

Priority: P1

Acceptance criteria:

- User can add a time log.
- User can choose activity type.
- User can link a log to a project.

### STORY-014 Weekly review page

Priority: P1

Acceptance criteria:

- Page shows wins, insights, risks, and next steps.
- Evidence is visible or expandable.
- Layout is readable for demo.

## Epic 5: Evaluation

### STORY-015 Build sample weekly datasets

Priority: P1

Acceptance criteria:

- At least 3 sample weeks exist.
- Samples include different patterns: aligned week, drift week, overloaded week.

### STORY-016 Review quality scoring

Priority: P1

Acceptance criteria:

- Reviews are scored on factual accuracy, goal relevance, positive recognition, actionability, restraint, slack protection, and risk detection.
- Scores are stored or documented.

### STORY-017 Classmate feedback

Priority: P2

Acceptance criteria:

- 2-3 classmates review generated output.
- Feedback captures understandability, encouragement, realism, and usefulness.

## Epic 6: Mobile Capture

### STORY-019 Build mobile capture module

As a team member, I want a mobile capture module on the roadmap so that actual time records can feed Theseus without overloading the first backend sprint.

Priority: P1

Acceptance criteria:

- A `mobile/` module plan is documented as `Theseus Capture`.
- Generated build artifacts and local databases are excluded from Git.
- The module exports normalized time logs compatible with Theseus.
- Any implementation in this repo should be independently developed for the course project.

### STORY-020 Define mobile-to-Theseus export contract

As a developer, I want the mobile app to export normalized time logs so that mobile records can feed the weekly review without requiring full sync.

Priority: P1

Acceptance criteria:

- Mobile records map to backend `TimeLog` fields.
- `consume` is normalized to `consuming`.
- Export includes date, start/end time, duration, activity name, activity type, and note.
- Backend import endpoint is planned.

### STORY-021 Defer full sync backend

As a product team, we want to defer Postgres/JWT push-pull sync so that the MVP can focus on proving the weekly review loop first.

Priority: P2

Acceptance criteria:

- Sync backend is documented as a later extension.
- Sync API design is preserved as a future reference.
- Sprint 1 does not depend on cloud deployment or authentication.
