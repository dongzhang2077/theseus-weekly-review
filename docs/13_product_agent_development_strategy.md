# Theseus Product and Agent Development Strategy

- Status: guiding document
- Baseline date: 2026-07-15
- Near-term checkpoint: midterm demo on 2026-07-18
- Latest accepted product direction: 2026-07-30
- Product owners: Dong Zhang and Zhi Kang

## 1. Purpose and Authority

This document records the product direction agreed after the Sprint 5 UX and
architecture review. It connects the course MVP to a longer-term personal
assistant direction without expanding the current demo into an unsafe or
unverifiable autonomous-agent project.

Use it to decide what to build next, what to defer, and where new capabilities
belong. It is a strategy and delivery guide, not a replacement for executable
contracts.

The sequential implementation branches, story dependencies, verification
commands, and product-owner acceptance gates are maintained in
[`15_agent_implementation_roadmap.md`](15_agent_implementation_roadmap.md).
The accepted post-pilot visual-workspace and local-first conversational
assistant direction is maintained in
[`17_product_direction_v2.md`](17_product_direction_v2.md). That document
supersedes broad future-direction examples here when deciding the next product
slice; it does not supersede accepted data, API, or security contracts.

When sources disagree, use this order:

1. `AGENTS.md` repository guidance.
2. Executable code and tests for current behavior.
3. `docs/03_data_model.md` and `docs/04_api_contract.md` for accepted contracts.
4. This document for product direction and phase gates.
5. Visual references for replaceable presentation style only.

Any implementation that changes persistence, API behavior, or cross-module
ownership still requires a focused issue, contract update, tests, and review.

## 2. North Star

Theseus should reduce the recurring cognitive work of planning and reviewing a
week while keeping the user in control of consequential decisions.

The intended loop is:

```text
Observe -> Explain -> Propose -> Approve -> Execute -> Verify -> Learn
```

The product promise is not "AI decides how the user should live." The promise
is:

- turn personal evidence into a small number of understandable signals;
- compress planning into a short approval and adjustment loop;
- support execution with low-noise reminders and bounded actions;
- preserve enough history to learn preferences and improve future proposals;
- keep evidence, provenance, consent, and reversibility visible.

Weekly evidence-backed review remains the product kernel. Conversation,
automation, and machine learning extend that kernel; they do not replace it.

## 3. Current Reality

As of 2026-07-25, Theseus is a working weekly-review MVP foundation rather than
a general life assistant. The product owner accepted the sequential Agent
implementation roadmap and STORY-035 domain contract. STORY-036 durable Tasks
and STORY-033 durable Activities are locally verified and product-owner
accepted; later Agent-domain
endpoints remain unimplemented.

| Capability | Current state | Direction |
|---|---|---|
| Stable review entities | Schema v6 preserves STORY-030 ownership, credentials, sessions, and existing review records while adding durable Focus state | Preserve supported migration paths while later Agent-domain migrations are implemented |
| Durable Tasks and live Focus state | Durable Tasks and nullable Plan/TimeLog links are accepted in STORY-036; durable Activity management is accepted in STORY-033; persisted two-tap Focus and exact TimeLogs are accepted in STORY-037; correctable Today history and review invalidation are accepted in STORY-034 | Begin the next Agent-domain module from the frozen STORY-034 baseline |
| Persistent review path | User-scoped sample data flows through SQLite, the review engine, and stored review; v1 migration and restart coverage are merged | Rehearse the browser-to-API restart path |
| Review reasoning | Deterministic, evidence-first rules | Keep framework-independent |
| AI wording | Evidence-bound writer adapters exist | Keep AI wording downstream of computed facts |
| React app | The authenticated Warm Stationery app is on `main`; a corrective Focus/Review/Signals/Plan candidate is implemented locally on `feature/032-focus-ux-v2` and is not yet released | Preserve the 430px mobile hierarchy through product-owner screenshot and interaction gates |
| Personal identity | Argon2id local accounts, JWT/session rotation, account management, and authenticated isolation are implemented and verified in STORY-030 | Keep this separate from cloud identity and sync |
| Long-term preferences | Not represented | Add explicit, provenance-bearing preferences after user ownership |
| Agent orchestration | Not implemented | Pilot one LangGraph workflow after the domain foundation is stable |
| External execution | Not implemented | Add OpenClaw as an optional, policy-gated adapter later |

The Sprint 5 integration reached `origin/main` as commit `306061c` through PR
#64. Repository status and GitHub issues must still be checked before every
sprint plan; documents must not describe later local work as released behavior.

## 4. Product Scope Boundaries

### Course MVP

Keep the course MVP focused on:

- formal local registration, login, and account management;
- goals, projects, weekly plans, time logs, reflections, and stored reviews;
- evidence-backed Signals;
- a realistic next-week adjustment in Plan;
- deterministic review plus optional supportive wording;
- sanitized sample scenarios and review-quality evaluation.

### Deferred from the course MVP

Do not put these on the 2026-07-18 critical path:

- cloud identity, email-based recovery, and third-party login;
- cloud sync or multi-device conflict resolution;
- automatic calendar rewriting;
- unrestricted shell, browser, email, or messaging actions;
- full OpenClaw integration;
- multi-agent orchestration;
- custom model training or reinforcement learning;
- mental-health diagnosis or claims about an objectively "best" life.

## 5. UX Direction

All screens follow the repository UX standard: structured first, decorative
second; one clear task per Level 1 screen; evidence reachable within two taps;
and visible loading, empty, error, success, and disabled states.

The Signals and Plan redesign is an information-architecture change, not an
art-direction replacement. Preserve the current Warm Stationery App identity:

- warm paper canvas and subtle paper/desk texture;
- the existing muted green, amber, blue, red, and neutral tokens;
- thin hand-drawn lines, low shadows, restrained borders, and line icons;
- the existing companion-character and illustration language when it
  communicates a real state;
- subtle fades and sheet movement rather than generic dashboard animation.

Reuse the current tokens and suitable assets before commissioning new artwork.
The updated screens must still feel like the same product as Review and Track;
they must not become a generic admin dashboard. Decoration may support the
hierarchy, but it may not be mistaken for evidence or computed severity.

| Screen | Level 1 question | Direction |
|---|---|---|
| Review | What mattered this week? | Preserve the current hierarchy and evidence expansion |
| Signals | What needs attention, why, and what can I do now? | Show concrete evidence-backed issues with their next action; collapse normal checks |
| Track | What am I doing now and what was recorded? | Preserve the timer/log focus and improve real-data states as needed |
| Plan | What should change next week? | Show capacity, planned load, slack, one proposal, and its effect |

### 5.1 Signals

Signals is interpreted evidence, not a decorative status dashboard and not a
duplicate of Track.

Level 1 should contain:

- the highest-priority concrete issue, followed by any remaining severe or
  attention issues;
- one short reason and key value for each issue using concrete evidence;
- one direct action on each issue, with Evidence as an optional secondary path;
- normal checks collapsed into a quiet summary instead of occupying equal
  visual weight;
- a clear distinction between API data, sample data, and no data.

Level 2 should contain the affected projects or records. Level 3 may contain
raw evidence details. Every summary signal must either open matching evidence
or explicitly say that evidence is unavailable.

Do not repeat the same issue as both a priority card and a category row. A
Signal or Review Risk must preserve its project and delta when it opens Plan;
when the source does not identify a project, open manual editing rather than
inventing one. The target interaction budget is two steps: select the action,
then apply or save the contextual adjustment.

Energy semantics must match the deterministic review engine. A restoration gap
is raised when restorative time is below 20% of consuming time. A destructive
pattern is raised only when destructive activity is at least 120 minutes and at
least 25% of all recorded time. The UI must state the measured value and the
threshold instead of reducing the conclusion to color.

Remove static red/amber/green orbit dots, arbitrary card rotation, and any
decoration that can be mistaken for a computed status. Do not use color as the
only state indicator.

A compact character, hand-drawn mark, or paper illustration may remain near
the priority signal when it communicates that signal's real state and does not
displace the reason or evidence.

### 5.2 Plan

Plan turns review feedback into a next-week adjustment. It is not a full
project-management or setup screen.

Level 1 should contain:

- real week dates;
- planned time, capacity, and slack in numbers and one compact visual;
- one evidence-linked proposal;
- a before/after change preview;
- Apply, Edit, and Undo states;
- a small number of labeled focus, maintenance, and slack rows.

Move Goal and Project creation into onboarding, Profile, or Setup. A Plan item
must reference a real project when applicable. Saving the same user and week
must follow a documented create/update rule instead of depending on fixture
dates or hard-coded project names.

Plan may retain a restrained hand-drawn balance or route motif, but it must be
driven by real planned/capacity/slack values and remain secondary to the
numbers and proposed change.

### 5.3 Trust and Accessibility

- Never silently present fixture data as live personal evidence.
- Every data-dependent surface needs loading, empty, error, and retry behavior.
- Every interactive icon needs an accessible name and keyboard-visible focus.
- Material changes need confirmation or a preview and should be reversible.
- Keep visible interface copy terse; put explanations in evidence/details.

## 6. Target Architecture

```mermaid
flowchart TB
    React[React App] --> API[Theseus Assistant API]
    Claw[OpenClaw Channels] --> Adapter[OpenClaw Adapter]
    Adapter --> API
    API --> Policy[Policy and Approval Gate]
    Policy --> Graph[LangGraph Workflow]
    Graph --> Services[Theseus Domain Services]
    Services --> Engine[Deterministic Review Engine]
    Services --> DB[(Theseus Domain Database)]
    Graph --> Checkpoints[(Workflow Checkpoints)]
    Policy --> Tools[Bounded Tool Adapters]
    Tools --> Ledger[(Action and Outcome Ledger)]
    Ledger --> Services
```

### 6.1 Component Responsibilities

| Component | Owns | Must not own |
|---|---|---|
| Theseus domain database and services | Users, goals, projects, plans, logs, reviews, preferences, provenance, approvals, actions, outcomes | Channel-specific session state |
| Deterministic review engine | Evidence calculation, risk rules, structured findings | HTTP routes, tool execution, provider sessions |
| LangGraph | Durable workflow state, pause/resume, approval checkpoints, retries | Canonical user records or duplicated review rules |
| OpenClaw | Conversation channels, scheduling, and bounded tool invocation through an adapter | A second source of truth, independent user policy, unrestricted writes |
| LLM providers | Wording, bounded classification, proposal generation from supplied context | Unverified facts or direct database mutation |

There must be one source of truth for user and domain data: Theseus. LangGraph
checkpoints and OpenClaw memory are supporting runtime stores, not replacements
for the domain database.

## 7. Local Account and Persistent Ownership

Theseus remains local-first, but the accepted HTTP boundary is now formal
local authentication rather than a selectable profile header. Cloud identity
and sync remain later work.

Minimum model direction:

- retain `users` as a stable ownership root and add one-to-one hashed
  credentials plus revocable session records;
- associate all user-owned top-level records with `user_id`;
- reject cross-user references between goals, projects, plans, items, and logs;
- scope weekly-plan, daily-reflection, and weekly-review uniqueness by user;
- make every list, create, review-generation, import, and sample-load operation
  run under an explicit local user context;
- enable SQLite foreign keys for every connection;
- keep local databases, raw exports, and personal records out of Git.

The accepted local-account mechanism is:

- register and sign in through `/auth`; public user enumeration is absent;
- hash passwords with Argon2id and never persist plaintext credentials;
- keep access JWTs in browser memory and rotate refresh JWTs through an
  HttpOnly SameSite cookie plus CSRF validation;
- every persisted personal request sends Bearer authentication;
- the API validates both JWT claims and active session state, then binds
  repositories and domain services to that account ID;
- request bodies cannot provide or override `user_id`;
- schema version 4 keeps auth tables while removing the unused recovery-code
  column without deleting existing
  profile-owned work; legacy profiles are not publicly enumerable or
  impersonable.

This mechanism is documented in `docs/03_data_model.md` and
`docs/04_api_contract.md`. Endpoints may not silently read or return records
belonging to every user.

The demo proof is behavioral:

```text
Register -> save account-owned records -> stop app -> restart app
-> restore/login -> regenerate review -> retrieve stored review
```

## 8. Long-Term Personalization and Memory

Long-term memory is not one vector database and is not synonymous with model
training. Store different kinds of knowledge separately.

| Memory layer | Examples | Storage rule |
|---|---|---|
| Explicit profile | Time zone, working hours, preferred slack | User editable; high trust |
| Domain facts | Goals, plans, logs, reflections, reviews | Structured source of truth |
| Episodic summaries | What happened in a week and what was tried | Evidence-linked and dated |
| Inferred preferences | Best reminder time, preferred task size | Confidence, source, scope, expiry, and correction required |
| Agent history | Proposal, approval, action, undo, result | Immutable audit trail where practical |
| Evaluation feedback | Accepted/rejected advice, usefulness, completion result | Used for ranking and evaluation |

Facts, user-stated preferences, and model inferences must remain distinguishable.
Every learned preference should carry provenance, confidence, evidence count,
last-confirmed time, and an expiry or review rule.

Personalization should optimize bounded outcomes such as suggestion usefulness,
plan adherence, protected slack, and restart success. Start with rules and
simple statistics. Introduce learned ranking only after the product records
enough proposal, decision, and outcome examples to evaluate it honestly.

STORY-028C freezes the first offline usefulness protocol in
`evaluation/personalization_evaluation_protocol.md`. Five consented Outcomes
make the UI aggregate readable; they do not authorize training. The first
chronological baseline comparison requires 30 consented, rated Outcomes and a
minimum 10-Outcome holdout. Current records do not contain candidate-set
exposure, so ranking evaluation remains explicitly unsupported.

## 9. Agent Workflow and Autonomy

The first LangGraph workflow should be narrow:

```text
Load user context
  -> compute deterministic weekly evidence
  -> draft one next-week adjustment
  -> show evidence and before/after diff
  -> wait for user approval or edit
  -> persist the approved plan change
  -> verify the stored result
  -> record outcome and feedback
```

Use an autonomy ladder:

| Level | Behavior | Release condition |
|---|---|---|
| 0 | Observe and explain | Evidence contract is complete |
| 1 | Suggest | Proposal is evidence-linked |
| 2 | Draft a reversible change | Diff and user edit are available |
| 3 | Execute a low-risk change after approval | Idempotency, audit, verification, and undo exist |
| 4 | Execute a bounded standing order | User-defined scope, expiry, rate limit, and kill switch exist |

Do not silently perform high-impact actions. Shell access, browser control,
external messages, financial actions, health decisions, destructive changes,
and broad calendar rewrites stay outside default authority.

## 10. Phased Roadmap and Gates

### Phase 0: Midterm Stabilization — 2026-07-15 to 2026-07-18

Goal: demonstrate one trustworthy local-user weekly-review loop.

Exit gate:

- a formal local account can register, sign in, restore a session, and keep its
  data isolated;
- user-owned records survive an application restart;
- the persisted-data-to-stored-review path passes;
- Focus records a truthful, exactly-once session result;
- Review browses actual weeks and keeps navigation available for empty weeks;
- Signals presents concrete actionable issues without duplicated categories or
  misleading static severity;
- Risk/Signal context reaches Plan and Plan uses the selected week and real
  project data for the demo path;
- opaque full-screen details and the primary workspace remain usable at 430px;
- a repeatable demo script and sanitized fixture are available.

LangGraph and OpenClaw are explicitly excluded from this phase.

### Phase 1: Personal Data Foundation

Goal: make ownership, provenance, feedback, and reversible changes reliable.

Status note (2026-07-25): the product owner accepted the gated implementation
roadmap and the STORY-035 authoritative Task/Activity/Plan/Focus/TimeLog
contract with its v5-v7 migration sequence. STORY-036 passed its runtime
implementation and product-owner browser gate on 2026-07-22 PDT. STORY-033
passed browser, stable-ID TimeLog linkage, and backend-restart acceptance on
2026-07-25 PDT. STORY-037's two-tap Start/End contract is accepted, and its
schema-v6 runtime implementation passed automated and product-owner browser
acceptance on 2026-07-25 PDT. STORY-034 also passed automated verification and
product-owner browser acceptance on 2026-07-25 PDT.

Exit gate:

- all relevant repositories and API operations are user-scoped;
- durable Task and FocusSession behavior, exactly-once TimeLog production, and
  correctable Evidence are implemented through shared domain services;
- migrations, export, and reset behavior are documented;
- preferences, proposals, approvals, actions, and outcomes have accepted
  contracts;
- fixture/live-data states are explicit in the UI.

### Phase 2: One LangGraph Planning Workflow

Goal: orchestrate weekly review to approved next-week adjustment without moving
domain truth out of Theseus.

Entry gate: Phase 1 contracts and policy rules are stable.

Exit gate: pause/resume, retry, approval, idempotency, verification, and audit
are covered by integration tests.

Accepted checkpoint (2026-07-26 PDT): the bounded Weekly Adjustment workflow
is implemented with a separate SQLite checkpointer and the already accepted
Assistant/domain services. Automated restart, approve/edit/reject, retry,
idempotency, verification, and account-thread isolation tests pass. No model or
conversation channel is part of this slice. Product-owner acceptance passed on
2026-07-26 PDT.

Verification checkpoint: 191 backend/workflow tests, Python compilation,
dependency consistency, deterministic sample review, and the multi-process
restart CLI demonstration pass.

### Phase 3: OpenClaw Conversation Adapter

Goal: expose Theseus through one conversational channel.

Entry gate: the Theseus Assistant API has typed, bounded operations.

Rollout order: read-only context and review first; proposal second; approved
writes last. Keep OpenClaw behind an adapter so it can be replaced without
changing domain services.

STORY-039 accepted foundation (2026-07-26 PDT): the replaceable channel layer
can now be paired to one account using a one-time integration token rather than
browser credentials. Only the read-only context scope is exposed end to end;
proposal and approved-execution scopes are stored but remain unavailable until
their bounded adapter gates are implemented and accepted.

### Phase 4: Learned Personalization

Goal: rank or time suggestions from recorded feedback and outcomes.

Entry gate: the system has enough representative observations to compare a
learned method against a simple baseline.

Exit gate: offline evaluation, user correction, confidence display, expiry,
and deletion are available. No vague claim of learning how a person "should"
live is acceptable.

### Phase 5: Bounded Proactive Execution

Goal: execute a small set of reversible, user-authorized standing orders.

Entry gate: policy, approval, sandbox, audit, rate limit, undo, and kill switch
have all been exercised. External integrations remain separate adapters.

## 11. Immediate Sprint 5 Replan

Sprint goal: by 2026-07-18, demonstrate that one local user can create and
retain personal weekly-review data, understand the most important signal, and
approve a realistic next-week adjustment.

### Task A: Lock the local-user contract

Delivery status: completed and merged through PR #64 on 2026-07-15 PDT.
Historical note: its selectable-header identity mechanism is superseded by
Task G; the stable `user_id` ownership model remains valid.

- Owner: Dong Zhang
- Depends on: teacher feedback; current data model and API contract
- Files/modules: `docs/03_data_model.md`, `docs/04_api_contract.md`, schemas,
  SQLite schema, repository interfaces

Acceptance criteria:

- ownership and user-scoped uniqueness rules are documented;
- the local-user context mechanism is explicit;
- at that checkpoint, authentication and cloud sync were deferred;
- cross-user references and unscoped list operations are rejected by design.

Verification: run the `api-contract-review` and `sqlite-persistence` review
checklists before implementation begins.

Demo evidence: an approved schema/API diagram and one local-user request flow.

### Task B: Implement the persisted local-user vertical slice

Delivery status: completed and merged through PR #64 on 2026-07-15 PDT,
including schema-v1 migration, cross-user isolation coverage, and full sprint
verification.

- Owner: Dong Zhang
- Depends on: Task A
- Files/modules: `backend/app/db/`, `backend/app/schemas.py`, `backend/app/api/`,
  `backend/app/services/`, persistence and integration tests

Acceptance criteria:

- create/list/select local user works;
- goals, projects, plans, logs, reflections, and reviews are user-scoped on the
  demonstrated path;
- data survives process restart;
- sample loading and review generation use the selected user;
- foreign keys and user-scoped uniqueness are tested.

Verification:

```bash
python3 -m pytest -q tests/test_schemas.py tests/db tests/api tests/services tests/integration
python3 -m compileall backend review_engine scripts
python3 scripts/run_sample_review.py
python3 scripts/load_sample_data.py --database /tmp/theseus-demo.db --user-name "Demo User"
python3 scripts/run_persisted_review.py --database /tmp/theseus-demo.db --user-id 1 --week-start 2026-06-08 --week-end 2026-06-14
```

Demo evidence: screen recording or live restart showing the same user's stored
records and stored weekly review.

### Task C: Connect local user context in the frontend

Delivery status: completed and merged through PR #64 on 2026-07-15 PDT; the
production frontend build is verified and the integrated demo rehearsal remains
in Task F. The profile chooser itself is superseded by Task G.

- Owner: Zhi Kang
- Depends on: Task A and the accepted user endpoint contract; may use a typed
  mock while Task B implements the backend
- Files/modules: `frontend/app/src/App.tsx`, shared API adapters, a focused
  onboarding/Profile surface, shared state surfaces

Acceptance criteria:

- first run offers formal account registration and an existing user can sign
  in without cloud connectivity;
- access identity is held in memory, refresh rotation restores the session, and
  no client-selected user ID enters personal API requests;
- restart restores a valid authenticated context and reloads that account's
  data;
- API, sample, loading, empty, and error states cannot be mistaken for each
  other;
- the focused profile surface uses the existing Warm Stationery tokens and is
  keyboard and screen-reader operable.

Verification:

```bash
npm --prefix frontend/app test
npm --prefix frontend/app run build
```

Demo evidence: sign in, restart the app, and show the restored account and its
persisted records.

### Task G: Replace selectable profiles with formal local authentication

Delivery status: implementation, full verification, independent contract and
security review, and product-owner browser approval completed on 2026-07-18
PDT. Release history is tracked by the focused STORY-030 GitHub PR #69.

- Owner: Dong Zhang
- Depends on: Tasks A-C, schema v2 ownership, accepted mobile shell
- Files/modules: auth schema/repository/service/routes, all protected route
  dependencies, frontend AuthClient/gate/account sheet, demo preparation, docs

Acceptance criteria:

- Argon2id registration/login does not persist plaintext
  credentials;
- access JWTs use fixed issuer/audience/type validation and an active session;
- rotating HttpOnly refresh cookies use CSRF validation and reuse detection;
- logout, password rotation, and deletion revoke relevant sessions;
- every personal repository is bound to the authenticated account and cross-
  account references remain rejected;
- registration, login, profile/email/password changes, logout,
  and deletion are operable in the 430px mobile shell;
- v2-to-v4 migration and authenticated demo restart are covered without
  discarding legacy data.

Post-demo hardening boundary: multi-tab refresh coordination is tracked as
STORY-031. The July 18 demo uses one browser tab; cloud identity and
multi-device sync remain outside STORY-030.

Verification:

```bash
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m pytest -p no:cacheprovider -q
python3 -m compileall backend review_engine scripts
python3 scripts/run_sample_review.py
npm --prefix frontend/app test
npm --prefix frontend/app run build
```

Verification checkpoint (2026-07-18 PDT): 102 Python tests and 71 frontend
tests pass; TypeScript and the production build pass; Python compilation, the
deterministic sample review, and authenticated demo preparation pass. The
focused auth suite covers 12 API cases, including CSRF failure recovery,
expired/type-confused JWT rejection, lockout, session-scoped logout, email
change, restart restore, deletion, and cookie clearing. Migration tests also
prove a failed v3-to-v4 upgrade rolls back account data and schema changes.

Verification checkpoint (2026-07-15): the merged Issue #63 delivery passes 91
Python tests, 64 frontend tests, Python compilation, the frontend production build,
the deterministic sample review, a schema-v1 migration test, and a separate-
process sample -> SQLite -> review engine -> stored review run. The verified
tree was squash-merged through PR #64 as `306061c`.

Tasks A-E and the engineering portion of Task F are merged. The only active
Sprint 5 work is timed rehearsal and fallback recording for the July 18 demo.
Do not begin LangGraph or OpenClaw work on this critical path.

### Task D: Simplify Signals

- Owner: Zhi Kang
- Depends on: stable signal view model and evidence mapping
- Files/modules: `frontend/app/src/features/signals/`, weekly-review mapping,
  shared state surfaces, global styles

Delivery checkpoint (2026-07-15 PDT): the decorative orbit and static dots
are removed; one evidence-ranked priority signal and stable Plan, Stage, Goal,
and Energy rows now drill into matching evidence and details. Canonical
`on_track`, stage-health, goal, no-data, and request-error paths are covered.
The focused checkpoint passed 46 tests across 11 files; the final integrated
suite passes 64 tests across 14 files, and the production build succeeds. The
result is included in PR #64 on `main`.

Corrective checkpoint (2026-07-18 PDT): subsequent product feedback found that
the stable category rows still duplicated the priority issue and delayed the
next action. STORY-032 therefore supersedes that final information architecture
locally: severe and attention issues are concrete records, normal checks are
collapsed, actions live on the issue card, and Evidence remains available but
secondary. This work is verified locally on `feature/032-focus-ux-v2` and is
not merged or released pending product-owner visual approval.

Acceptance criteria:

- static orbit severity decoration is removed;
- the Warm Stationery palette, paper texture, line treatment, and purposeful
  companion-art language remain visually consistent with Review and Track;
- Plan, Stage, Goal, and Energy summaries open matching evidence or an explicit
  no-evidence state;
- priority severity uses text as well as color;
- API, demo, loading, empty, and error states are distinguishable;
- desktop and mobile layouts remain readable and keyboard operable.

Verification:

```bash
npm --prefix frontend/app test
npm --prefix frontend/app run build
```

Demo evidence: screenshots and a click-through from the priority signal to its
project-level evidence.

### Task E: Make Plan a real adjustment surface

- Owner: Zhi Kang
- Depends on: Task A and a stable plan API response
- Files/modules: `frontend/app/src/features/plan/`, plan API adapter, shared
  state surfaces

Delivery checkpoint (2026-07-15 PDT): Plan now loads the selected user's
plans and projects, derives the target week from review or the next Monday,
shows a concrete project/load/slack diff, and atomically POSTs or PUTs the full
weekly plan. A new plan is deleted on Undo; an existing plan is restored by
replacement. Loading, saved, conflict/reload, error/retry, dismissed, and
restored states are explicit. Goal/Project CRUD and fixture values were removed
from the live surface while the Warm Stationery hierarchy was preserved.

Verification checkpoint: 91 Python tests and 64 frontend tests pass; Python
compilation, the frontend production build, deterministic sample review, and a
separate sample -> SQLite -> review engine -> stored review run also succeed.
The verified result is included in PR #64 on `main`.

Corrective checkpoint (2026-07-18 PDT): STORY-032 adds a contextual handoff
from Review Risk or Signals into Plan, keeps unknown project context editable
instead of guessed, removes the duplicate top edit control, and uses an opaque
full-screen detail surface with primary navigation hidden while open. The
candidate is locally verified but is not merged or released pending
product-owner visual approval.

Acceptance criteria:

- week dates, project, capacity, planned time, and slack come from current data;
- the Warm Stationery palette, paper texture, line treatment, and restrained
  illustration language remain visually consistent with Review and Track;
- fixture-specific project names and dates are removed from the live path;
- Goal/Project creation is not embedded in Plan Level 1;
- Apply shows a before/after diff and produces a consistent persisted plan;
- save success, conflict, error, retry, and Undo behavior are visible.

Verification:

```bash
npm --prefix frontend/app test
npm --prefix frontend/app run build
```

Demo evidence: review recommendation to Plan diff to approved saved plan.

### Task F: Integrate, review, and rehearse

- Owner: both
- Depends on: Tasks B, C, D, and E
- Files/modules: sanitized samples, demo script, evaluation notes, affected docs

Delivery checkpoint (2026-07-15 PDT): engineering-complete, merged through PR
#64 as `306061c`, and tracked as Done by GitHub Issue #63. A secret-free
`prepare_midterm_demo.py` entry point now creates a fresh temporary SQLite
database, a formal demo account with credentials in a Git-ignored local file,
imports the sanitized user week, and stores local supportive wording. A restart
integration test covers authenticated login, records, and review.
The four app tabs have sanitized mobile screenshots, with desktop composition
shots for Review and Plan, and a five-minute runbook now records preflight,
fallback, limitations, and the recording checklist. Scenario review exposed
and fixed one evidence inconsistency: unlinked planned items now count toward
total planned time and slack. The project owner explicitly approved direct
merge and waived the separate teammate-review gate. One live rehearsal and the
actual fallback recording remain human delivery gates.

Acceptance criteria:

- the critical path works without an external model key;
- supportive wording failure falls back visibly to deterministic review;
- no personal database, credentials, or raw export is committed;
- known limitations are stated in the demo;
- focused schema, contract, persistence, UX, and cross-screen findings are
  recorded, and project-owner approval is explicit.

Verification:

```bash
python3 scripts/run_sample_review.py
python3 -m compileall backend review_engine scripts
python3 -m pytest -q
npm --prefix frontend/app test
npm --prefix frontend/app run build
git diff --check
```

Demo evidence: one rehearsed five-minute flow and a fallback recording.

## 12. Critical Path and Scope Rule

The Sprint 5 critical path is:

```text
Local-user contract -> persistence vertical slice -> frontend user context
-> Signals/Plan integration -> full verification -> demo rehearsal
```

If time is short, protect the persisted user/review path and truthful UI states.
Defer decorative polish, broad CRUD coverage in the demo, LangGraph, OpenClaw,
and machine learning. A smaller verified loop is better evidence than a larger
agent mock-up.

## 13. Decision Gates for Future Work

Do not introduce LangGraph until:

- the same workflow is understandable as explicit domain-service calls;
- user ownership and durable records are stable;
- Task, Activity, FocusSession, and TimeLog correction contracts have passed
  their product-owner implementation gates;
- a human approval checkpoint is genuinely required.

Do not enable OpenClaw writes until:

- operations use typed inputs and bounded permissions;
- approval, idempotency, audit, verification, and undo exist;
- high-risk tools are denied by default.

Do not introduce learned personalization until:

- proposal, decision, outcome, and correction data are stored;
- a simple rule/statistical baseline exists;
- the user can inspect, correct, expire, and delete learned preferences.

## 14. Success Measures

Near-term demo measures:

- persisted restart path succeeds;
- every visible signal has inspectable evidence;
- the user can explain the proposed plan change without developer narration;
- deterministic fallback works without external credentials.

Product measures for later phases:

- review factual accuracy;
- suggestion acceptance and user-rated usefulness;
- completion or restart success after an accepted suggestion;
- protected slack and reduced plan overload;
- correction rate for inferred preferences;
- unauthorized or unverifiable action count, which must remain zero.

## 15. Reference Material

Internal sources:

- `docs/02_system_architecture.md`
- `docs/03_data_model.md`
- `docs/04_api_contract.md`
- `docs/05_review_engine_design.md`
- `docs/07_product_backlog.md`
- `docs/11_architectural_runway.md`
- `docs/design/app-ux-spec.md`
- `docs/design/style-reference.md`

External implementation references:

- [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangGraph memory](https://docs.langchain.com/oss/python/langgraph/add-memory)
- [OpenClaw architecture](https://docs.openclaw.ai/concepts/architecture)
- [OpenClaw memory](https://docs.openclaw.ai/concepts/memory)
- [OpenClaw tools](https://docs.openclaw.ai/tools)
- [OpenClaw security](https://docs.openclaw.ai/gateway/security)

External tools are fast-moving dependencies. Recheck their official
documentation when the corresponding phase begins and keep each integration
behind a replaceable adapter.

## 16. Post-Pilot Product Direction

The 2026-07-30 product-owner decision establishes two coordinated workstreams:

1. a visual-first daily App that replaces repeated prose with evidence-backed
   timelines, weekly bars, a time-distribution donut, and a longer-range
   calendar heatmap; and
2. a local-first conversational assistant shared by the App and Telegram, with
   deliberate text or push-to-talk activation, a deterministic next-action
   service, minimal cloud context, and read-only Calendar commitments before
   any external writes.

The visual delivery pipeline is mandatory:

```text
Wireframe -> HTML prototype -> visual acceptance -> React restoration
```

The AI boundary is also mandatory: API keys remain in the local backend, cloud
inference occurs only after explicit user interaction, and each request
contains only an allowlisted minimum context envelope. The complete scope,
chart mapping, privacy rules, candidate stories, order, and acceptance gates
are authoritative in
[`17_product_direction_v2.md`](17_product_direction_v2.md).
