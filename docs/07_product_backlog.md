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

Status note (2026-07-17): cloud sync remains deferred. Local authentication is
no longer deferred because the product owner promoted it into STORY-030; this
does not authorize cloud deployment or multi-device sync.

## Epic 7: Local User Ownership and Trustworthy UX

### STORY-022 Add local user-scoped persistence

As a local user, I want my goals, plans, logs, reflections, and reviews stored
under my profile so that my data survives restart and does not mix with another
profile.

Priority: P0

Delivery checkpoint (2026-07-15 PDT): implemented across SQLite schema
v2/migration, scoped repositories and services, FastAPI local-user context,
frontend profile selection, and focused isolation/restart tests. Full sprint
verification passed and the work reached `main` through PR #64 (`306061c`).
The selectable profile/UI/header portion is historical and superseded by
STORY-030; stable `user_id` ownership and all domain isolation rules remain.

Acceptance criteria:

- A local user can be created, listed, and selected without production auth.
- User-owned records are scoped by a stable `user_id`.
- Weekly-plan, daily-reflection, and weekly-review uniqueness is user-scoped.
- Cross-user references and unscoped reads are rejected.
- The full sample data -> SQLite -> review engine -> stored weekly review path
  runs under one user and still works after process restart.
- Local databases and personal data remain excluded from Git.

### STORY-023 Simplify Signals around inspectable evidence

As a user, I want Signals to explain the review conclusion clearly so that I
can trust the status without decoding decorative graphics.

Priority: P1

Delivery checkpoint (2026-07-15 PDT): merged to `main` through PR #64. The
decorative orbit was replaced by one evidence-ranked priority signal and four
stable summary rows; every signal opens matching evidence or a track-first
empty state. Canonical plan/stage/goal mappings, explicit load failure and retry,
accessibility labels, component tests, and the production build are verified.

Acceptance criteria:

- The first screen shows one priority signal and aligned Plan, Stage, Goal, and
  Energy rows.
- Static severity decoration is removed; status always comes from evidence.
- The current Warm Stationery palette, paper texture, line treatment, and
  purposeful companion-art language are preserved.
- The result remains visually consistent with Review and Track rather than
  becoming a generic dashboard.
- Every summary opens matching evidence or an explicit no-evidence state.
- API, sample, loading, empty, and error states are distinguishable.
- Severity is not communicated by color alone.

### STORY-024 Make Plan a real next-week adjustment surface

As a user, I want to see and approve a concrete next-week adjustment so that I
can act on the review without rebuilding my whole project setup.

Priority: P1

Delivery checkpoint (2026-07-15 PDT): merged to `main` through PR #64. Plan now
derives its target week and proposal from review/current data, loads the
selected user's persisted plans and projects, shows project/load/slack
before-and-after evidence, and atomically creates or replaces one weekly plan.
Success, conflict, load/save error, retry, and Undo are covered; Goal/Project
creation and fixture-specific values are absent from the live Plan surface.
Sanitized mobile/desktop screenshots were captured on 2026-07-15. The final
live rehearsal and fallback recording remain Task F work.

Acceptance criteria:

- Week, project, planned time, capacity, and slack come from current data.
- The current Warm Stationery palette, paper texture, line treatment, and
  restrained illustration language are preserved.
- The result remains visually consistent with Review and Track rather than
  becoming a generic dashboard.
- The first screen shows one evidence-linked proposal and a before/after diff.
- Apply persists one consistent user-scoped weekly plan and exposes success,
  conflict, error, retry, and Undo states.
- Goal and Project creation are moved out of Plan Level 1.
- Hard-coded fixture dates and project names are absent from the live path.

### STORY-029 Stabilize the demo frontend with semantic Tailwind UI

As a user, I want Focus and Plan to be calm, legible, and connected so that I
can move from an explained recommendation to execution without decoding a
decorative dashboard.

Priority: P0 for the 2026-07-18 demo

Implementation checkpoint (2026-07-17 PDT): implemented and verified on
`feature/story-029-tailwind-demo-ui`. The accepted Kimi K3 “Desk Pad” proposal
uses semantic Tailwind v4 tokens; the teammate's large prototype stylesheet
and decoration-only motion are intentionally excluded. The full frontend suite
passes 71 tests, the production build passes, production dependency audit is
clean, and sanitized mobile/desktop screenshots were refreshed.

Acceptance criteria:

- Tailwind is integrated through Vite and new styling uses shared `desk-*`
  semantic tokens rather than page-specific CSS.
- Focus explains its recommendation and supports Next, Delay, Skip, Choose,
  start, pause/resume, end, and a result note.
- Plan shows capacity, planned time, slack, one adjustment, manual editing, and
  direct handoff from a plan block to Focus.
- Primary navigation has visible one-word labels and accessible selected
  states.
- Sample-only and view-local behavior is labelled truthfully.
- No teammate CSS bundle, decorative animation system, personal data, or
  credentials enter the change.
- Full frontend tests, TypeScript, production build, diff check, and mobile and
  desktop screenshot review pass.

### STORY-030 Add formal local accounts and JWT data isolation

As a user, I want a real account boundary even when Theseus runs only on my
computer so that another browser user cannot select or read my data by changing
an integer profile ID.

Priority: P0 for the 2026-07-18 demo

Delivery checkpoint (2026-07-18 PDT): implementation, automated verification,
independent contract/security review, and product-owner visual approval are
complete. Release history is tracked by the focused STORY-030 GitHub PR #69.

Acceptance criteria:

- Registration, sign-in, sign-out, session restore, profile editing, email and
  password change, and account deletion have mobile UI flows.
- Passwords use Argon2id; access JWTs are short lived and held only in browser
  memory; refresh JWTs rotate in an HttpOnly SameSite cookie with CSRF defense.
- Every persisted personal API resolves `user_id` from the validated JWT and
  rejects missing, forged, expired, revoked, or legacy user-header identity.
- Accounts cannot read or link another account's goals, projects, plans, logs,
  or reviews, and deleting an account cascades through its local records.
- SQLite schema v2 and v3 each migrate atomically to v4 without deleting
  accounts or personal data; a failed migration rolls back completely.
- The demo preparation path creates a real account and stores generated demo
  credentials only in a permission-restricted, Git-ignored local file.
- Focused auth, schema, migration, isolation, restart, frontend interaction,
  full-suite, build, and browser checks pass before merge.

### STORY-031 Coordinate refresh safely across browser tabs

As a local account user, I want two tabs to restore and refresh the same
session without being mistaken for token theft so that normal browser use does
not revoke every session.

Priority: P1 after the 2026-07-18 demo

Acceptance criteria:

- Legitimate concurrent refreshes from two browser contexts do not trigger the
  refresh-reuse account revocation path.
- Coordination does not persist access JWTs to local storage or expose the
  HttpOnly refresh token to JavaScript.
- Genuine reuse outside the narrowly defined concurrency window still revokes
  the affected account sessions.
- Two-context restore, 401 recovery, logout, and reuse cases have automated
  browser/API tests and documented security reasoning.

## Epic 8: Personal Assistant Evolution

These stories are roadmap work. They are not part of the 2026-07-18 demo and
must satisfy the phase gates in `docs/13_product_agent_development_strategy.md`.

### STORY-025 Add preference, proposal, approval, action, and outcome records

As a user, I want Theseus to remember why a suggestion was made and what
happened after I accepted it so that personalization remains inspectable and
correctable.

Priority: P2

Acceptance criteria:

- Explicit preferences and model inferences are stored separately.
- Inferences carry provenance, confidence, scope, timestamps, and an expiry or
  review rule.
- Proposals, approvals, actions, undo operations, and outcomes are auditable.
- The user can inspect, correct, and delete learned preferences.

### STORY-026 Pilot one LangGraph weekly-adjustment workflow

As a user, I want an approved review-to-plan workflow that can pause and resume
so that AI assistance remains durable and under my control.

Priority: P2

Acceptance criteria:

- The workflow computes evidence through the existing review engine.
- It drafts one adjustment, shows a diff, and waits for approval or edit.
- Approved writes are idempotent, verified, and recorded in the action ledger.
- LangGraph checkpoints do not become the canonical domain database.
- Retry, resume, rejection, and failure paths have integration tests.

### STORY-027 Add an OpenClaw conversation adapter

As a user, I want to reach Theseus through one conversational channel so that I
can review and capture information without opening the main UI every time.

Priority: P2

Acceptance criteria:

- OpenClaw calls a typed Theseus adapter and does not access the database
  directly.
- The first release is read-only.
- Write operations require bounded permissions, approval, idempotency, audit,
  verification, and Undo where practical.
- High-risk tools are denied by default.
- Removing the adapter does not change domain or review-engine behavior.

### STORY-028 Learn bounded suggestion preferences

As a user, I want suggestions to improve from my decisions and outcomes so that
Theseus becomes more useful without pretending to know how I should live.

Priority: P2

Acceptance criteria:

- A rule or statistical baseline exists before a learned ranker is introduced.
- Training/evaluation inputs come from consented proposal, feedback, and
  outcome records.
- Offline evaluation compares the learned method with the baseline.
- Confidence, correction, expiry, and deletion are visible to the user.
- Optimization targets are bounded, such as usefulness, plan adherence,
  protected slack, or restart success.
