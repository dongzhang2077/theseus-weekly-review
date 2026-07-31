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

Supersession note (2026-07-25 PDT): STORY-037 replaces the historical
pause/resume and result-note interaction below with the accepted two-tap
Start/End flow. End auto-saves the resulting TimeLogs without a confirmation
form; Cancel remains recovery-only.

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

### STORY-032 Correct the mobile execution and review feedback loops

As a user, I want Focus, Review, Signals, and Plan to form one clear mobile
workflow so that an observed problem can become a contextual, reversible plan
change without duplicated status cards or hidden state.

Priority: P0 corrective work for the 2026-07-18 demo

Local implementation checkpoint (2026-07-18 PDT): implemented and verified on
`feature/032-focus-ux-v2`, but not merged or released. This candidate remains
subject to product-owner browser approval. The implementation keeps the 430px
Warm Stationery shell, replaces repeated category summaries with concrete
issues, and carries a selected Risk or Signal into a contextual Plan change.
The full frontend suite passes 102 tests across 19 files, TypeScript and the
production build pass, and the final diff check is clean.

Focus freeze checkpoint (2026-07-21 PDT): the product owner accepted the
restored midterm-style Focus hierarchy and Activity-bar state treatment. The
frozen candidate preserves independent multi-Activity timers, separate live-run
and accumulated-session values, account-scoped refresh checkpoints, local-date
rollover, and atomic cross-midnight TimeLog persistence. Verification passes
113 frontend tests across 20 files, 103 backend tests, TypeScript, the
production build, compileall, and the sample review path. Persisted creation of
new Activities, an inspectable/correctable Today history, and cross-tab session
coordination remain non-blocking follow-up work in STORY-033, STORY-034, and
STORY-031 respectively.

Acceptance criteria:

- the primary workspace stays phone-sized at 430px and detail views are opaque
  full-screen surfaces rather than transparent layers over the source page;
- Focus preserves an in-progress draft across tab changes, records a completed
  result exactly once, and determines Today using the user's local date;
- Review browses real Monday-to-Sunday weeks, including an empty week, without
  a stale response replacing the currently selected week;
- Signals lists only concrete attention or risk items, collapses normal checks,
  avoids repeating a priority category, and keeps Evidence optional;
- a Risk or Signal reaches the correct contextual Plan draft in one action and
  can be applied or saved as the second action; unknown project context opens
  editing instead of guessing;
- Energy signals use the same deterministic thresholds as the review engine:
  restoration below 20% of consuming time, or destructive activity at least
  120 minutes and at least 25% of total time;
- Plan shows one clear adjustment path, one primary edit action, and truthful
  loading, conflict, saved, undo, empty, and error states;
- semantic Tailwind tokens and existing shared components remain the default;
  large page-specific CSS or decoration-only animation is not introduced;
- focused and full frontend tests, TypeScript, production build, diff check,
  and 430x932 browser review pass before merge.

### STORY-033 Persist user-created Focus activities

As a local account user, I want an Activity created in Focus to be stored under
my account so that it remains available after restart and can own later TimeLog
records.

Priority: P1 after the accepted Focus freeze

Accepted checkpoint (2026-07-25 PDT): authenticated create, list,
detail, and optimistic correction routes; account/Project isolation; durable
Focus loading and create/edit save states; restart persistence; stable
`activity_id` TimeLog linkage and snapshots; and focused/full automated
verification are implemented on `feature/033-persisted-activities`.
The product owner verified creation and correction in the browser, automatic
Session save, stable Activity-ID TimeLog linkage, and authenticated reload
after a backend restart.

Acceptance criteria:

- authenticated Activity create, list, and correction routes use the existing
  `activities` table and `ActivityRepository` rather than route-level SQL;
- Activity reads expose an optimistic version and stale corrections are
  rejected without overwriting a newer user change;
- ownership comes only from the validated JWT, and project links belonging to
  another account are rejected;
- Focus loads persisted activities and saves a newly created Activity before
  presenting it as durable;
- later TimeLogs reference the persisted `activity_id` while preserving the raw
  activity name and normalized type snapshot;
- Project reassignment is rejected while that Activity has an open
  FocusSession;
- loading, saving, validation, retry, restart, and cross-account isolation have
  focused API and frontend tests;
- view-local fallback behavior, if retained for a demo, is labelled truthfully
  and is never presented as persisted data.

### STORY-034 Add an inspectable and correctable Today history

As a local account user, I want Today total to open the records that produced
the number so that I can inspect and correct mistakes instead of seeing only an
activity picker.

Priority: P1 after the accepted Focus freeze

Acceptance criteria:

- Today total is calculated from authenticated persisted TimeLogs plus open
  local sessions without double counting completed sessions;
- opening Today shows chronological records and their Activity, Project,
  duration, energy type, and note provenance;
- a user can correct a mistaken record or remove it through user-scoped API
  behavior, with confirmation and immediate total refresh;
- removal is a versioned soft delete; every correction, removal, restore, and
  Undo appends an owned revision rather than erasing history;
- corrections flow into project progress, Evidence, and Weekly Review through
  the existing normalized TimeLog path;
- overlapping stored reviews are marked stale until successful regeneration;
- empty, loading, error, retry, save, and undo or confirmation states are
  explicit;
- local-date boundaries follow the account timezone and have cross-midnight,
  restart, and account-isolation tests.

Accepted checkpoint (2026-07-25 PDT): schema v7, authenticated TimeLog
correction/removal/Undo, append-only revisions, review invalidation, and the
mobile Today-history flow are implemented on
`feature/034-correctable-today-history`. Backend, frontend, migration, sample,
and persisted-review verification pass. Product-owner browser acceptance
passed.

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

STORY-025A accepted checkpoint (2026-07-25 PDT): schema v8, supported v1-v7
migration composition, user-scoped Preference/PreferenceRevision persistence,
and the Proposal/Decision/Action/Outcome repository and domain-service
foundation are implemented on `feature/025-trust-ledger`. Focused migration,
rollback, provenance, scope-isolation, audit, expiry, and idempotency tests
pass. Authenticated APIs and Pending/History/Memory UI remain the next two
acceptance slices. Product-owner acceptance passed.

STORY-025B accepted checkpoint (2026-07-25 PDT): authenticated Preference
create/list/detail/correct/delete/restore and Proposal
create/list/detail/decision/outcome routes are implemented. Public schemas
cannot claim inferred or assistant provenance, Action remains audit-only, and
focused authentication, OpenAPI, expiry, optimistic conflict, revision,
cross-account, and restart-safe persistence tests pass. Product-owner
acceptance passed. STORY-025C Pending/History/Memory control surfaces are the
next sequential gate.

STORY-025C accepted checkpoint (2026-07-26 PDT): an authenticated Assistant
control surface is available from Account without adding a fifth primary tab.
It separates the summary, Pending/History/Memory lists, and full-screen detail
layers; supports proposal review, structured edit-and-approve, rejection,
preference creation/correction, soft deletion, deleted filtering, restore,
and explicit loading/error/empty/conflict states. Tags remain single-line and
the implementation adds no custom CSS or raw JSON editor. Focused interaction
tests, the full 138-test frontend suite, type checking, and production build
pass. Product-owner browser acceptance passed after reviewing the populated
Assistant demo.

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

STORY-026 accepted checkpoint (2026-07-26 PDT): a bounded
`WeeklyAdjustmentWorkflow` uses LangGraph 1.x interrupts and the official
SQLite checkpointer to orchestrate the accepted STORY-038 proposal, decision,
execution, verification, and Action services. It pauses with only a Proposal
ID, survives closing and reopening both databases, supports approve, edit, and
reject, replays completed approval without another Plan or Action, and retries
a failed execution without duplicating the Decision. Checkpoints contain only
account/date/status and ledger IDs; canonical Plan and Evidence data remain in
Theseus. Seven workflow integration tests and 34 combined STORY-038/026 tests
pass. No HTTP route, frontend control, model call, or OpenClaw adapter is added
in this slice. Product-owner acceptance passed on 2026-07-26 PDT.

Verification checkpoint: all 191 backend/workflow tests pass in one run;
Python compilation, dependency consistency, deterministic sample review, and a
four-process start/status/resume/replay CLI demonstration also pass.

### STORY-027 Add an OpenClaw conversation adapter

As a user, I want to reach Theseus through one conversational channel so that I
can review and capture information without opening the main UI every time.

Priority: P2

Acceptance criteria:

- OpenClaw calls a typed Theseus adapter and does not access the database
  directly.
- Rollout gate one is read-only. Gate two may create a pending proposal only
  from a trusted inbound message ID. Gate three may record only an `approve`
  or `reject` decision with a distinct scope, replay protection, and audit
  record; it cannot edit a plan change. Gate four may execute only an approved
  proposal through the existing reversible Action service with `action:execute`.
  Gate five may undo only the resulting successful reversible Action with the
  independent `action:undo` scope.
- Any approved write operation requires bounded permissions, approval,
  idempotency, audit, verification, and Undo where practical.
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

Implementation checkpoint (2026-07-29 PDT): the first observation slice is
implemented on `feature/028-consented-outcome-baseline`. Schema v13 adds
explicit, versioned outcome consent with a safe default of off. The
authenticated Assistant can record an outcome and grant or withdraw consent.
A read-only deterministic baseline includes only currently consented outcomes,
reports `insufficient_data` below five observations, and never ranks
suggestions or creates an inferred preference. Automated verification is
complete: 214 backend tests and 145 frontend tests pass, along with Python
compilation, deterministic sample review, frontend typecheck, and production
build.

Product-owner acceptance checkpoint (2026-07-30 PDT): the authenticated
browser flow recorded one real Outcome, included it in the baseline only after
explicit consent, and removed it again after consent withdrawal. Persistence
evidence retained the Outcome, advanced only `consent_version` from 1 to 2,
returned the consented count to zero, and passed foreign-key verification. The
observation slice is accepted; sparse data still blocks any ranking claim.

STORY-028B candidate checkpoint (2026-07-30 PDT): the existing Assistant
Baseline summary now opens a focused read-only detail layer. It exposes the
current consent threshold and remaining count, per-proposal-type usefulness,
completion, and result aggregates when available, and always states that
ranking is not applied. It adds no endpoint, schema, inferred Preference, or
suggestion-order change. Four focused Assistant tests, all 146 frontend tests,
TypeScript verification, and the production build pass. Product-owner browser
acceptance passed on 2026-07-30 PDT after the Baseline row opened the
collecting/readiness detail, exposed the current consented count and aggregate
boundary, preserved Back navigation, and stated that ranking was not applied.
STORY-028B is accepted.

STORY-028C candidate checkpoint (2026-07-30 PDT): the offline usefulness
evaluation protocol is frozen before enough data exists to inspect a holdout
result. A read-only local CLI includes only currently consented, rated Outcomes,
uses a chronological 30-record minimum with at least 10 holdout records, and
measures a Proposal-type mean baseline with global fallback by mean absolute
error. Its aggregate output excludes proposal titles and Outcome notes.
Because the ledger does not record candidate-set exposure, every snapshot
blocks ranking evaluation explicitly. Three focused evaluation tests, the
27-test evaluation/consent/schema slice, all 217 backend tests, Python
compilation, and the deterministic sample review pass. Product-owner protocol
acceptance passed on 2026-07-30 PDT. STORY-028C is accepted; collecting enough
real consented Outcomes remains an evidence gate, not an implementation claim.

## Epic 9: Agent-Ready Domain And Integration

These stories turn the personal-assistant strategy into independently
verifiable modules. Their dependency order and product-owner acceptance gates
are defined in `docs/15_agent_implementation_roadmap.md`.

### STORY-035 Lock the agent-ready domain contract

As a product owner, I want Task, Activity, PlannedItem, FocusSession, TimeLog,
domain-service, idempotency, and migration responsibilities agreed before
implementation so that Agent frameworks do not dictate or duplicate product
data.

Priority: P0 before Agent runtime work

Accepted contract checkpoint (2026-07-22 PDT): the product owner accepted the
authoritative data/API contracts, atomic v5-v7 migration sequence,
Task-to-corrected-Review lifecycle, service boundaries, decision record, and
executable test outline on `feature/035-agent-ready-domain-contract`. No SQL,
Python, frontend runtime, LangGraph, or OpenClaw behavior is included. This
accepted contract is the baseline for STORY-036.

Acceptance criteria:

- Task, Activity, PlannedItem, FocusSession, and TimeLog have non-overlapping
  responsibilities and a documented lifecycle.
- The data model and API contract define user ownership, timezone,
  idempotency, correction, deletion, and Undo behavior.
- Existing version-4 accounts, PlannedItems, TimeLogs, and sample fixtures have
  a non-destructive migration path.
- Routes, LangGraph nodes, and channel tools share user-scoped domain services
  instead of duplicating SQL or business rules.
- LangGraph runtime persistence remains separate from canonical domain truth.
- The product owner approves the contract and lifecycle before schema code is
  written.

### STORY-036 Add durable Tasks

As a user, I want a Task to persist across weekly plans so that the assistant
can help me progress a finite outcome instead of recreating it as an unrelated
plan block every week.

Priority: P0 for Agent foundation

Accepted checkpoint (2026-07-22 PDT): schema v5, atomic v1-v4
migrations, authenticated Task lifecycle API, optimistic versions,
PlannedItem/TimeLog Task links, restart isolation, and the focused mobile
Plan -> Tasks -> Task detail flow are implemented on
`feature/036-durable-tasks`. Automated verification is green, and the product
owner completed the local browser acceptance flow for create, complete,
reopen, archive, restore, Plan linkage, and reload persistence.

Acceptance criteria:

- A user can create, list, inspect, update, complete, reopen, and archive a
  Task linked to one of their Projects.
- Task updates use optimistic versions and never silently overwrite a newer
  mutation.
- PlannedItems may reference a Task while existing ad-hoc PlannedItems remain
  valid.
- Cross-account links and invalid lifecycle transitions are rejected.
- Task history survives restart and remains distinct from reusable Activities.
- Migration, API, persistence, sample-review, and frontend tests pass.

### STORY-037 Persist Focus sessions

As a user, I want running Focus state stored under my account so that the App
and future conversation channels observe and end the same execution without
losing or duplicating time.

Priority: P0 for Agent foundation

Acceptance criteria:

- Authenticated Start, End, and recovery-only Cancel transitions are persisted
  and user-scoped.
- Independent multi-Activity sessions remain supported.
- Server timestamps determine exact elapsed time; browser counters are only a
  presentation.
- End automatically creates cross-midnight TimeLog segments atomically and
  exactly once without a confirmation form.
- Duplicate commands return the original result rather than double counting.
- Browser refresh, backend restart, timezone rollover, and account isolation
  have focused tests.

Accepted checkpoint (2026-07-25 PDT): schema v6, authenticated
Start/End/recovery-only Cancel, user-scoped idempotency, atomic cross-day
TimeLogs, server-time recovery, multi-Activity frontend integration, and
supported migration paths are implemented. The full backend/frontend suites,
production build, compilation, deterministic sample review, and persisted
sample-to-review path pass. Product-owner browser acceptance passed.

### STORY-038 Build a bounded Assistant API

As a user, I want language requests to use typed, evidence-backed operations so
that an assistant can read context and draft changes without receiving direct
database authority.

Priority: P0 before LangGraph or OpenClaw

Acceptance criteria:

- Read, propose, approve, and execute operations have separate schemas and
  permission checks.
- Operations call authenticated domain services and never expose SQL or
  provider-generated IDs as domain truth.
- Ambiguous requests ask one focused clarification instead of guessing.
- Proposals contain evidence and a before/after diff and cannot write before
  approval.
- Provider errors, invalid output, duplicate requests, and cross-account
  attempts cannot leave partial changes.
- A deterministic local path remains available without an external model key.

STORY-038A accepted checkpoint (2026-07-26 PDT): authenticated
`GET /assistant/context` aggregates one bounded date window of stable
user-scoped active Goals/Projects, open or in-progress Tasks, relevant
Activities, WeeklyPlan,
running FocusSessions, non-deleted TimeLogs, active Preferences, and a compact
WeeklyReview summary through `AssistantContextService`. The route exposes no
write method, SQL, email, credentials, full review prose, or full review
evidence. Authentication, stable empty shape, exact-window aggregation,
OpenAPI, cross-account isolation, and invalid/unbounded-window tests pass.
Product-owner acceptance passed on 2026-07-26 PDT.
Proposal and execution operations remain deferred to later STORY-038 slices.

STORY-038B accepted checkpoint (2026-07-26 PDT): authenticated
`POST /assistant/proposals/weekly-adjustment` deterministically turns one
current stored review's Project-drift Evidence into one Pending
`weekly_plan_adjustment` Proposal. The response exposes exact review/Project
provenance plus a complete before/after WeeklyPlan diff; it does not write the
Plan. Required idempotency, existing-proposal reuse, rollback after failure,
stale/missing/unsupported states, OpenAPI shape, and account isolation are
covered. Focused tests, the full 172-test suite, Python compilation, and the
deterministic sample review pass. Product-owner acceptance passed on
2026-07-26 PDT; approval and execution remain later slices.

STORY-038C accepted checkpoint (2026-07-26 PDT): authenticated
`POST /assistant/proposals/{proposal_id}/execute-weekly-plan` accepts only an
owned, approved `weekly_plan_adjustment`, honors edited approval, validates the
complete target Plan, and creates or replaces it through `WeeklyPlanService`.
The operation detects target drift before writing, verifies the stored
after-state, marks the Proposal executed, and records one reversible,
Decision-linked succeeded Action with full before/after provenance. Exact
replay returns the same Action and Plan. Pending, unsupported, stale,
cross-account, reused-key, invalid-link, and rollback paths are covered.
Focused tests pass 27 cases; the full 179-test suite, Python compilation, and
deterministic sample review pass. Product-owner API acceptance passed on
2026-07-26 PDT; typed Undo remains the next bounded slice.

STORY-038D accepted checkpoint (2026-07-26 PDT): authenticated
`POST /assistant/proposals/{proposal_id}/actions/{action_id}/undo-weekly-plan`
reverses only one owned, succeeded, reversible STORY-038C Weekly Plan Action.
It proves the target still matches the verified Action result, restores the
recorded before-state through `WeeklyPlanService`, verifies the result, and
atomically records the Undo Action while marking the original Action and
Proposal undone. Exact replay, create deletion, replace restoration, stale
version, target drift, rollback, OpenAPI typing, and account isolation are
covered by 29 focused Assistant/ledger tests. Python compilation and deterministic sample
review pass. Repeated full-suite runs consistently complete with exactly one
transient authenticated request failure: the current inventory passed 183 of
184, and the prior inventory passed 182 of 183. Different tests fail each run,
every isolated failure passes on rerun, and the complete inventory passes
across bounded partitions. Product-owner API acceptance passed on 2026-07-26
PDT. The product owner accepted the authentication-suite flake as a separate,
non-blocking stability investigation aligned with STORY-031; it is not evidence
that the random `401` has been fixed.

### STORY-039 Bind a conversation channel to an account

As a user, I want one external conversation identity securely paired with my
Theseus account so that a channel can access only my approved capabilities
without reusing browser credentials.

Priority: P0 before OpenClaw

Acceptance criteria:

- Integration credentials are scoped, revocable, expiring, hashed at rest, and
  displayed only once.
- Channel identities are explicitly paired with one account and minimized in
  storage and logs.
- Read, propose, and approved-execution scopes are separable.
- Replayed external message IDs are idempotent.
- Revocation immediately blocks the integration without deleting domain data.
- Pairing, expiry, scope, replay, revocation, redaction, and account-isolation
  tests pass.

STORY-039 accepted checkpoint (2026-07-26 PDT): schema v9 and authenticated
`/integrations` management now create one scoped, expiring credential and
channel binding. The token is returned once and stored only as a hash; channel
identity and external message IDs use keyed HMACs. A separate integration
Bearer credential can call only the read-only channel context endpoint when it
has `context:read`; browser JWTs are not reused. Replay receipts contain no
personal context copies. Pairing, OpenAPI, expiry, scope, replay conflict,
revocation, redaction, v8 migration, and account-isolation tests pass in the
focused candidate suite. Subsequent STORY-027 work added the pending-only
channel proposal endpoint, narrow approve/reject decision, approved-plan
execution, and reversible undo behind distinct scopes; the native OpenClaw
adapter remains a replaceable transport. Product-owner acceptance passed on
2026-07-26 PDT.

App-management checkpoint (2026-07-28 PDT): Account > Integrations provides
an authenticated OpenClaw-only pairing surface for label, identity, explicit
scopes, and expiry; it displays the raw token only in the one-time pairing
result, lists lifecycle metadata, and requires confirmation before revocation.
It uses the existing browser-authenticated management API and deliberately
does not store integration tokens or identities in browser persistence.
A one-click check creates a five-minute read-only pairing, validates the
channel context request, and revokes that temporary credential before success
is displayed.

Telegram private-pilot checkpoint (2026-07-28 PDT): Telegram is an allowed
scoped channel type. The first production configuration is private-chat only,
with an exact numeric trusted sender and only `context:read` plus
`proposal:create`; decision, execution, and undo remain disabled until a later
explicit approval gate.

Telegram decision-gate checkpoint (2026-07-29 PDT): after the pending-only
runtime gate passed, the active pairing was rotated to add only
`proposal:decide`, and the OpenClaw allowlist added only the narrow decision
tool. A real trusted Telegram `approve` request returned `200`, moved the
existing Proposal from pending version 1 to approved version 2, and appended
exactly one Decision. Read-only verification found no Agent Action and no
target-week WeeklyPlan. At that checkpoint, `action:execute` and `action:undo`
remained absent from both the pairing and tool allowlist.

Telegram execution-gate checkpoint (2026-07-29 PDT): the active pairing was
rotated again to add only `action:execute`, and the OpenClaw allowlist added
only `theseus_weekly_plan_execute`; `action:undo` and the Undo tool remained
disabled. A real trusted Telegram execution returned `200`, advanced the
approved Proposal from version 2 to executed version 3, and recorded exactly
one Decision-linked, reversible, succeeded `weekly_plan.create` Action whose
verification matched the approved after-state. Read-only verification found
one target-week WeeklyPlan with the complete approved three-item plan,
including the bounded 30-minute restart allocation, and no Undo Action. The
focused execution/scope tests pass 2 cases and the OpenClaw plugin suite passes
all 23 tests.

Telegram undo-gate checkpoint (2026-07-29 PDT): after the execution state was
verified in the App, the active pairing was rotated to add the independent
`action:undo` scope and the runtime allowlist added only
`theseus_weekly_plan_undo`. A real trusted Telegram Undo returned `200`,
advanced the Proposal from executed version 3 to undone version 4, marked the
original reversible Action undone, and recorded exactly one non-reversible,
succeeded `weekly_plan.undo_create` Action linked to it. Read-only verification
confirmed that the Undo matched the recorded before-state, removed the one
target-week Plan created by the original Action, preserved the source-week
Plan and approval Decision, and made no unrelated plan write. The focused
Undo/scope tests pass 2 cases. Final App consistency confirmation passed, so
the product owner accepted the complete five-gate private pilot.

Persistence correction checkpoint (2026-07-29 PDT): schema v12 rebuilds the
channel binding constraint to accept Telegram while preserving existing
bindings, uniqueness, ownership triggers, and foreign keys. A focused
migration regression proves a v11 database retains an existing OpenClaw
binding and then accepts Telegram. The Integration API regression proves the
first Telegram pairing returns `201` and only a duplicate active identity
returns `409`. The focused backend and frontend suites, full Python suite,
Python compilation, TypeScript, production build, and sanitized
sample-to-stored-review path pass.

Acceptance verification: 27 focused Integration/schema/migration tests pass.
The full suite completed 196 of 197 tests; the sole failure was the previously
tracked intermittent authenticated Activity request and passed immediately in
isolation. Python compilation and deterministic sample review pass. This is
not evidence that the separate authentication flake has been fixed.

## Epic 10: Daily Visual Workspace and Local-First Assistant

These candidate stories implement the two accepted product directions in
`docs/17_product_direction_v2.md`. They reserve boundaries only. Each needs a
focused issue, owner, contract, verification commands, and demo evidence before
moving to `Ready`.

### STORY-040 Freeze the visual-first workspace contract

As a daily user, I want the App to summarize streams visually so that I can
understand my day and week without reading repeated review prose.

Priority: P0 next product slice, after the current candidate is integrated

Planning checkpoint (2026-07-30 PDT): the product owner set UI optimization as
the first post-pilot direction. Assistant Gateway, next-action, Calendar,
in-App conversation, and voice stories remain sequenced after an accepted UI
baseline. The first STORY-040 artifact is the product-owner-review wireframe in
`docs/design/daily-workspace-wireframes-v2.md`; HTML and React work may not
begin before its acceptance gate.

Conditional-review checkpoint (2026-07-30 PDT): the three-destination
information architecture, default Today entry, Day/Week/Month chart split, and
Review/Signals Level 1 convergence remain approved in direction. The revised
wireframe now defines independent live-Focus and selected-period contexts,
Previous/Next/Today/timezone rules, concurrent Focus foreground selection and
the running-Activities sheet, explicit Insights and Plan state matrices, and
visible chart titles, totals, legends, and accessible data entries. STORY-040
remained unaccepted and HTML remained blocked until product-owner re-review.

Wireframe acceptance checkpoint (2026-07-30 PDT): the product owner accepted
the final visual-first workspace contract after historical Day drill-down
semantics, exact Month totals, visible Insights/Plan reset controls, and
distinct Plan load, failed-save, and unknown-save recovery were reconciled.
Responsive HTML prototyping is authorized. STORY-040 remains `In Progress`, and
React implementation remains blocked until the app-sized portrait prototype,
wide-screen QA preview, interactions, and represented states pass product-owner
review.

HTML review correction (2026-07-30 PDT): the product owner clarified that
Theseus is a mobile App and rejected a landscape-oriented wide-screen
rearrangement. The prototype and contract now keep the 430px portrait workspace,
bottom navigation, single-column reading order, and vertically stacked Plan
diff at wide browser sizes. Wide-screen output is QA preview evidence rather
than a separate desktop product. STORY-040 remains `In Progress` pending review
of this corrected portrait-first prototype.

Companion placement decision (2026-07-30 PDT): the product owner retained the
fresh stationery visual direction and the existing companion as a bounded
brand asset, while keeping it off routine Today, Insights, and Plan Level 1
surfaces. Allowed use is onboarding, meaningful empty/completion states, a
compact Review detail, and the future working assistant entry. No inactive
assistant placeholder or persistent decorative character is authorized.

Tracker preservation decision (2026-07-30 PDT): the product owner confirmed
that the existing fast, minimal Tracker is protected rather than removed. Today
keeps direct Start/End at Level 1, and tapping Current Focus opens the full-screen
Level 2 Tracker with Activity selection, the primary timer control, concurrent
running access, Today total, and correctable history. Tracker is absorbed into
Today navigation, not reduced to the compact summary row or restored as a fourth
tab.

HTML interaction correction checkpoint (2026-07-30 PDT): external review found
that chart targets shared static detail, the current week included future
fixtures, concurrent Focus actions were not stateful, and the Tracker timer
surface duplicated its End action. The corrected prototype now binds every
visual target to its selected date or period, category, and sanitized source
record IDs; excludes Jul 31-Aug 2 from the Jul 27-Aug 2 current-week total;
models foreground selection, running-state labels, independent End actions,
and safe fallback selection; and leaves the timer display read-only. Chart
semantics, touch targets, contrast, focus treatment, and long Activity wrapping
were also corrected. Exact portrait, desktop-QA, drawer, stale, conflict,
verified, and Tracker captures now exist. STORY-040 remains `In Progress` and
React remains blocked until the product owner accepts this corrected screenshot
and interaction evidence.

Prototype acceptance checkpoint (2026-07-30 PDT): after the corrected evidence
and verification were delivered, the product owner directed development to
continue. The app-sized Day, Week, Insights, Plan, Tracker, Running Activities,
stale, conflict, verified, 320px, 390px, and centered desktop-QA artifacts are
accepted as the React reference. STORY-040 is accepted. Production work now
moves to the dependent STORY-041 slice; this acceptance does not authorize a
main-branch merge or broaden STORY-041 into Month, Insights, Plan, Assistant,
Calendar, or voice work.

Acceptance criteria:

- the information architecture specifies a daily timeline, seven-day stacked
  bars, a time-distribution donut, and a longer-range calendar heatmap;
- each visual answers a distinct question and opens matching persisted records;
- overlapping Review and Signals content has one accepted Level 1 hierarchy;
- wireframes and an app-sized HTML prototype pass product-owner review before
  React implementation begins;
- mobile, desktop, sparse, empty, loading, error, and accessibility states are
  represented.

### STORY-041 Add evidence-backed time visualizations

As a daily user, I want to see time distribution and change across useful time
scales so that I can notice imbalance and choose what to inspect.

Priority: P1 after STORY-040

Ready checkpoint (2026-07-30 PDT): STORY-040 is accepted. Dong owns the first
React slice. It is limited to authenticated TimeLog aggregation, the accepted
Project donut, seven-day stacked bars, accessible summaries, and exact
record-level drill-down. The Month heatmap remains deferred until a later
density gate, and Insights/Plan convergence remains outside this slice.

Acceptance criteria:

- the first React slice implements the accepted donut and seven-day visual
  against authenticated persisted TimeLogs;
- totals, segments, dates, and drill-down records reconcile exactly;
- charts retain accessible summaries and never use color as the only meaning;
- the monthly heatmap is implemented only after enough date density exists;
- focused tests, TypeScript, production build, and mobile/desktop browser
  review pass.

### STORY-042 Add a local Assistant Gateway and minimum-context policy

As a local account user, I want cloud language help without uploading my whole
history so that conversation remains useful and bounded.

Priority: P0 within the Assistant phase, after STORY-040 and STORY-041

Acceptance criteria:

- provider API keys remain in the local backend and are absent from frontend
  storage, model context, channel output, and logs;
- every cloud request is triggered by explicit user interaction;
- the gateway sends an allowlisted, request-specific context envelope;
- serialized-envelope tests reject credentials, unrelated history, raw
  evidence dumps, and cross-account records;
- provider failure preserves deterministic local behavior.

### STORY-043 Add deterministic next-action recommendation

As a user, I want a trustworthy answer to what I should do now so that current
commitments do not crowd out long-running Projects.

Priority: P0 within the Assistant phase, after the accepted UI baseline and
stable Task, Plan, Focus, and review services

Acceptance criteria:

- a shared service ranks bounded candidates from active Focus, the next fixed
  commitment, WeeklyPlan, open Tasks, project state, available time, and
  explicit preferences;
- the result includes evidence, alternatives, and uncertainty;
- App and Telegram receive the same result for the same account and context;
- a model may phrase but cannot invent ranking evidence;
- empty, conflict, stale, and offline cases have deterministic tests.

### STORY-044 Add the in-App text assistant

As a user, I want to ask Theseus questions inside the App so that conversation
is not limited to Telegram.

Priority: P1 after STORY-042 and STORY-043

Acceptance criteria:

- one restrained, accessible App affordance opens a focused text conversation;
- reads use the shared Assistant Gateway and typed tools;
- writes show typed previews and preserve approval, audit, verification, and
  Undo;
- Telegram and App do not maintain competing assistant memory or policy;
- loading, cancellation, timeout, offline, provider-error, and cost-limit
  states are visible and tested.

### STORY-045 Add read-only Google Calendar commitments

As a user, I want fixed Calendar commitments considered when Theseus recommends
my next action so that the recommendation fits the time actually available.

Priority: P1 after STORY-042 and STORY-043

Acceptance criteria:

- connection is explicit and OAuth credentials stay in protected local backend
  storage;
- free/busy is the default imported context and selected event detail is
  opt-in;
- external commitments remain distinct from Tasks and TimeLogs;
- sync state, last refresh, error, disconnect, and credential deletion are
  visible;
- no Calendar write or broad scope is included.

### STORY-046 Add multilingual push-to-talk

As a user, I want to hold a control and speak in English or Chinese so that I
can query and plan while reducing setup and navigation effort.

Priority: P1 after STORY-044

Acceptance criteria:

- recording begins only after a deliberate action and is visibly active;
- a non-long-press accessible recording control provides equivalent behavior;
- the first release uses the bounded record, transcribe, tool, present, and
  optional speech pipeline;
- raw audio is not retained by default and transcript retention is visible and
  controllable;
- cancel, timeout, denial, transcription error, and cloud-unavailable states
  are tested.

### STORY-047 Add conversational onboarding

As a new user, I want the assistant to guide initial setup one question at a
time so that I can start using Theseus without learning every screen first.

Priority: P2 after STORY-044 and STORY-045

Acceptance criteria:

- the assistant collects only the minimum timezone, working window, Goals,
  Projects, commitments, focus preference, slack, and first-plan inputs;
- the complete structured result is previewed before any write;
- setup writes use existing authenticated domain services and approval rules;
- conventional forms remain available for fallback and correction;
- partial, cancelled, resumed, invalid, and duplicate setup paths are tested.
