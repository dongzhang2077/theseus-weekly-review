# Theseus Agent Implementation Roadmap

- Status: accepted execution plan
- Baseline date: 2026-07-22
- Stable product checkpoint: `677de39`
- Active planning branch: `feature/035-agent-ready-domain-contract`
- Product owner and acceptance gate: Dong Zhang
- Engineering owner: Dong Zhang with Codex implementation support
- UX implementation lead: Kimi K3, subject to product-owner browser approval
- Architecture, contract, and regression challenger: Codex

## 1. Delivery Principle

Theseus will evolve from an evidence-backed weekly-review application into a
long-running personal agent without replacing the stable domain core.

Daily conversation will become the primary lightweight interaction. The app
will remain the structured control surface for evidence, planning, focus,
approvals, corrections, memory, history, and Undo.

Development proceeds through one accepted module at a time:

```text
Ready contract
  -> focused implementation branch
  -> automated verification
  -> local browser/API demo
  -> product-owner acceptance
  -> frozen commit and merge
  -> next module
```

Only one roadmap module may be `In Progress` at a time. A later module does not
begin merely because its implementation is technically possible.

## 2. Baseline And Protected Behavior

Commit `677de39` is the Agent-transition baseline. It includes the accepted
mobile Review, Signals, Focus, and Plan corrections on top of formal local
accounts and user-scoped persistence.

The following behavior is protected throughout the roadmap:

- formal local registration, login, session rotation, and account isolation;
- SQLite foreign-key and cross-account ownership enforcement;
- framework-independent deterministic review rules;
- stored evidence-backed weekly reviews;
- atomic WeeklyPlan create, replace, and Undo behavior;
- independent multi-Activity Focus timing, local-day rollover, and atomic
  cross-midnight TimeLog persistence;
- 430px Warm Stationery information hierarchy and accessible controls;
- deterministic operation without an external model key.

Every module must preserve the sample review path and all previously accepted
tests. Untracked presentations, local databases, personal exports, credentials,
and `.env` files remain outside Git.

## 3. Target Product Boundary

```text
WhatsApp / later channels
          |
     OpenClaw adapter
          |
 Theseus Assistant API
          |
 Policy + approval gate
          |
       LangGraph
          |
 Theseus domain services
          |
 SQLite domain data + deterministic review engine
```

Responsibility stays explicit:

- Theseus owns users, Goals, Projects, Tasks, Activities, plans, sessions,
  TimeLogs, reviews, preferences, proposals, decisions, actions, and outcomes.
- LangGraph owns resumable workflow state and approval checkpoints, not
  canonical personal data.
- OpenClaw owns channel transport and bounded delivery, not planning rules or a
  second user memory.
- LLM providers may interpret language and draft typed proposals. They cannot
  write the database directly or invent evidence.

## 4. Domain Decisions To Lock First

STORY-035 must settle these contracts before persistence changes begin:

### Task, Activity, PlannedItem, FocusSession, And TimeLog

- `Task` is a finite outcome with lifecycle state and may continue across
  weeks.
- `Activity` is a reusable way of working or spending time.
- `PlannedItem` allocates weekly time to a Task or an ad-hoc plan block.
- `FocusSession` stores a running, completed, or cancelled execution state
  using exact server timestamps.
- `TimeLog` is the normalized completed evidence produced by a FocusSession or
  a corrected/imported manual record.

Existing PlannedItems and TimeLogs must remain valid. New foreign keys are
nullable during migration so the current sample and user databases do not
require destructive rewriting.

### Domain Services

HTTP routes, LangGraph nodes, and OpenClaw tools must call the same user-scoped
domain services. Agent nodes may not bypass services to call repositories or
execute SQL.

### Runtime And Domain Storage

LangGraph checkpoints use a separate runtime persistence boundary. They may
reference domain IDs but do not duplicate Goal, Project, Task, Plan, or TimeLog
truth.

## 5. Ordered Modules And Acceptance Gates

Indicative effort assumes one focused engineering stream with AI assistance,
existing regression tests preserved, and product-owner feedback returned at
each gate. It is a planning range rather than a commitment to merge unaccepted
work.

| Delivery window | Scope | Indicative effort |
|---|---|---:|
| 2026-07-22 to 2026-08-01 | Gate 0, course closeout, STORY-035 contract | 3-7 working days |
| Agent foundation weeks 1-3 | STORY-036, STORY-033, STORY-037, STORY-034 | 3-5 weeks |
| Agent foundation weeks 4-6 | STORY-025 and STORY-038 | 2-4 weeks |
| Agent alpha weeks 7-9 | STORY-026, STORY-039, STORY-027 | 2-4 weeks |
| Personalization period | STORY-028 observation and evaluation | 4+ weeks of real use |

The first credible conversational Agent alpha is therefore expected after
roughly 7-10 focused post-baseline weeks. Reliable personalization requires
additional real decisions and outcomes and must not be simulated to satisfy a
calendar target.

### Gate 0: Stable Release Baseline

Story: STORY-032

Goal: make the accepted local product state reproducible before Agent work.

Acceptance:

- current frontend suite, typecheck, and production build pass;
- current branch history and known limitations are documented;
- the baseline reaches the agreed release branch before schema work is merged;
- no local presentation or personal data enters the commit.

Verification:

```bash
cd frontend/app
npm test
npm run build
```

Demo evidence: Review -> Signal -> Plan -> Focus works in the accepted 430px
browser shell.

### Module 1: Agent-Ready Domain Contract

Story: STORY-035

Goal: approve the Task, Activity, FocusSession, TimeLog correction, service,
idempotency, and migration boundaries before code.

Depends on: Gate 0.

Files/modules:

- `docs/03_data_model.md`
- `docs/04_api_contract.md`
- `docs/11_architectural_runway.md`
- `docs/13_product_agent_development_strategy.md`
- `docs/16_agent_domain_contract_test_plan.md`

Acceptance:

- entity responsibilities and relationships are unambiguous;
- routes and response shapes are specified before implementation;
- user ownership, timezone, idempotency, correction, deletion, and Undo rules
  are explicit;
- migration preserves version-4 accounts and domain records;
- the product owner approves the contract diagram and one example lifecycle.

Verification: API-contract and SQLite-persistence review checklists; no runtime
dependency is added.

Demo evidence: one documented lifecycle from Task creation through completed
TimeLog and corrected Weekly Review.

### Module 2: Durable Tasks

Story: STORY-036

Goal: represent work that persists beyond one weekly plan.

Depends on: STORY-035.

Acceptance:

- authenticated create, list, inspect, update, complete, reopen, and archive
  behavior is user-scoped;
- a Task belongs to one Project and can be referenced by a PlannedItem;
- existing PlannedItems remain valid without a Task;
- cross-account references and invalid state transitions are rejected;
- the first UI surface is a focused setup/detail flow, not a new dashboard.

Verification:

- schema migration and rollback tests;
- focused repository/API tests;
- `python3 -m compileall backend review_engine scripts`;
- `python3 scripts/run_sample_review.py`;
- frontend focused tests and production build.

Demo evidence: create a Task, include it in a weekly plan, reload the app, and
complete it without losing its history.

### Module 3: Persisted Activities

Story: STORY-033

Goal: make a user-created Focus Activity durable and reusable.

Depends on: STORY-035; compatible with STORY-036.

Acceptance and verification are defined in the product backlog.

Demo evidence: create an Activity, restart backend and browser, select it again,
and persist a TimeLog referencing its stable ID.

### Module 4: Persisted Focus Sessions

Story: STORY-037

Goal: move live execution state behind an authenticated, exactly-once domain
boundary so browser and conversational channels observe the same session.

Depends on: STORY-033 and STORY-036.

Acceptance:

- Start, End, and recovery-only Cancel transitions are user-scoped;
- multiple Activities may run independently as the accepted Focus UX requires;
- elapsed time uses server timestamps rather than a browser-owned clock;
- End once creates the correct TimeLog segments atomically without a
  confirmation form;
- duplicate End requests return the original result and never double count;
- browser refresh, backend restart, local midnight, timezone, and account
  isolation are covered.

Verification: state-transition, idempotency, cross-midnight, restart, API, and
frontend integration tests plus the full backend/frontend gates.

Demo evidence: Start in the app, restart the browser and backend, observe the
same running Session, End it once, and show the resulting TimeLogs and Today
total.

### Module 5: Inspectable And Correctable Today History

Story: STORY-034

Goal: make actual execution evidence inspectable and correctable.

Depends on: STORY-037.

Acceptance and verification are defined in the product backlog. Correction or
deletion must also refresh dependent project progress and regenerated review
evidence.

Demo evidence: correct one mistaken TimeLog and show the Today total, project
evidence, and regenerated Weekly Review change consistently.

### Module 6: Trust, Memory, And Action Ledger

Story: STORY-025

Goal: store inspectable preferences and the complete proposal-to-outcome
history before orchestration.

Depends on: Modules 2-5.

Acceptance:

- user-stated preferences and inferred preferences remain distinguishable;
- proposals include evidence, before/after diff, expiry, and status;
- decisions record approve, edit, reject, or expire;
- actions are idempotent, verifiable, and reversible where practical;
- outcomes record completion, usefulness, actual duration, and optional energy
  feedback;
- the app exposes compact Pending, History, and Memory control surfaces.

Verification: migration, isolation, provenance, correction, deletion, expiry,
idempotency, Undo, API-contract, and accessible frontend tests.

Demo evidence: inspect why a proposal was made, edit and approve it, Undo it,
and delete one inferred preference.

### Module 7: Bounded Assistant API

Story: STORY-038

Goal: expose language-driven read and proposal operations without allowing a
model or channel to mutate domain data directly.

Depends on: STORY-025.

Initial typed operations:

- current context and active Goals/Projects/Tasks;
- week snapshot and current Focus state;
- draft Task and weekly adjustment;
- record reflection;
- approve, edit, reject, and Undo proposal;
- submit outcome feedback.

Acceptance:

- every operation uses authenticated domain services and explicit schemas;
- read, propose, approve, and execute permissions are separate;
- unknown or ambiguous language asks one focused clarification;
- fixture, live, and missing data are never conflated;
- a local template/deterministic path works without a provider key;
- provider failure cannot create a partial write.

Verification: schema, policy, injection, ambiguity, provider-failure,
idempotency, isolation, and end-to-end API tests.

Demo evidence: a local conversation asks what to do this week, receives one
evidence-backed proposal, and does not change Plan before approval.

### Module 8: One LangGraph Weekly-Adjustment Workflow

Story: STORY-026

Goal: make one valuable workflow durable before adding general agent behavior.

Depends on: STORY-038.

Workflow:

```text
load context
  -> compute deterministic evidence
  -> draft one adjustment
  -> validate and preview diff
  -> interrupt for approve/edit/reject
  -> execute idempotently
  -> verify stored result
  -> record action and outcome request
```

Acceptance and verification are defined in the product backlog. A restart
between proposal and approval must be part of the integration proof.

Demo evidence: create a proposal, stop the agent process, restart it, approve
the same proposal, and show exactly one verified Plan change.

### Module 9: Channel Identity And Scoped Integration Access

Story: STORY-039

Goal: bind one external conversation identity to one account without reusing a
browser access or refresh token.

Depends on: STORY-038.

Acceptance:

- revocable integration credentials are hashed at rest and shown once;
- a channel binding maps an allowed external identity to one user;
- scopes distinguish read, propose, and approved execution;
- replayed message IDs are idempotent;
- disconnecting a channel revokes access without deleting domain data;
- phone numbers and channel identifiers are minimized and never logged
  unnecessarily.

Verification: pairing, revocation, expiry, scope, replay, cross-account, and
redacted-log tests.

Demo evidence: pair a local test channel, read one week snapshot, revoke it,
and prove the old credential can no longer read data.

### Module 10: OpenClaw Conversation Adapter

Story: STORY-027

Goal: use one conversational channel while keeping OpenClaw replaceable.

Depends on: STORY-026 and STORY-039.

Rollout gates:

1. read-only review and context;
2. proposal creation;
3. approval response;
4. bounded, approved writes.

Acceptance:

- OpenClaw sees only typed Theseus tools;
- database, shell, filesystem, and broad browser tools are unavailable;
- WhatsApp uses pairing/allowlist and a dedicated account when practical;
- channel configuration writes are disabled;
- delivery failure and duplicate inbound messages do not duplicate actions;
- App and WhatsApp show the same pending proposal and final domain state.

Verification: adapter contract tests, mocked channel delivery, reconnect,
duplicate message, revoke, failure, and full approved-write integration tests.

Demo evidence: ask in WhatsApp for next week's adjustment, approve the proposal,
and show the same Plan and action history in the App.

### Module 11: Bounded Personalization

Story: STORY-028

Goal: improve ranking and timing from consented decisions and outcomes.

Depends on: enough accepted Module 6 outcome records.

Acceptance:

- an explicit rule/statistical baseline is measured first;
- features and optimization targets are documented and bounded;
- offline evaluation beats or matches the baseline before release;
- confidence, source, correction, expiry, and deletion remain visible;
- low confidence produces a question or neutral ordering, not silent autonomy.

Demo evidence: show why two otherwise similar suggestions are ranked
differently and let the user correct the inferred preference.

## 6. Branch And Commit Policy

Use one branch per accepted story:

```text
feature/035-agent-ready-domain-contract
feature/036-durable-tasks
feature/033-persist-focus-activities
feature/037-persisted-focus-sessions
feature/034-correctable-today-history
feature/025-agent-trust-records
feature/038-bounded-assistant-api
feature/026-langgraph-weekly-adjustment
feature/039-channel-identity
feature/027-openclaw-adapter
feature/028-bounded-personalization
```

Each branch begins from the last accepted and integrated module. Do not stack
unaccepted schema or API branches. Keep commits scoped to one behavior and
exclude generated-file churn.

## 7. Standard Acceptance Packet

Every module handoff to the product owner contains:

- what changed and what deliberately did not change;
- contract or migration summary;
- focused and full verification results;
- one reproducible local demo path;
- mobile screenshots for frontend changes;
- failure, empty, retry, and Undo evidence where applicable;
- remaining limitations and the exact next proposed module.

The product owner records one of:

- `Accepted`: freeze, merge, and open the next module;
- `Revise`: remain on the current branch with named corrections;
- `Rejected`: revert or retire the branch without contaminating the baseline.

## 8. Critical Path And Parallel Work

The critical path is:

```text
STORY-035
  -> STORY-036 + STORY-033
  -> STORY-037
  -> STORY-034
  -> STORY-025
  -> STORY-038
  -> STORY-026 + STORY-039
  -> STORY-027
  -> STORY-028
```

For the product-owner acceptance workflow, these are delivered sequentially
even when the dependency graph would permit parallel implementation.

Course evaluation, final-report work, and urgent regression fixes remain a
separate maintenance lane. They may not silently expand an Agent module or
weaken the August 1 course exit gate.

## 9. Current Gate

Current status: roadmap and STORY-035 domain contract accepted by the product
owner on 2026-07-22. STORY-036 is implemented, automatically verified, and
product-owner accepted on `feature/036-durable-tasks`. STORY-033 is implemented,
automatically verified, and product-owner accepted on
`feature/033-persisted-activities` after browser, stable-ID TimeLog linkage,
and backend-restart verification on 2026-07-25 PDT. STORY-037's two-tap
contract and schema-v6 runtime are implemented, automatically verified, and
product-owner accepted after browser verification on 2026-07-25 PDT.

Completed STORY-037 acceptance evidence:

1. Start one Activity in the authenticated app and observe its running state;
2. restart the browser and backend and observe the same running Session;
3. End it by tapping the Activity again and confirm the UI opens no result
   form;
4. confirm Today total and the stable-ID TimeLog survive another reload;
5. product-owner acceptance recorded on 2026-07-25 PDT.

Completed sequential gate: STORY-034 correctable Today history, audit revisions,
soft deletion, Undo, and stale-review invalidation is implemented and
automatically verified on `feature/034-correctable-today-history`. The
product-owner browser gate passed on 2026-07-25 PDT; freeze and merge are
authorized.

Completed sequential gate: STORY-025A Trust, Memory, and Action Ledger data
foundation. Schema v8, repositories, domain services, focused tests, and full
regression verification pass on `feature/025-trust-ledger`; product-owner
acceptance is recorded.

Completed sequential gate: STORY-025B authenticated preference and ledger
APIs. The route and error contract are implemented, automatically verified,
and product-owner accepted on `feature/025-trust-ledger` on 2026-07-25 PDT.
Arbitrary action execution remains private until the bounded Assistant API.

Completed sequential gate: STORY-025C compact authenticated Pending, History,
and Memory control surfaces. The automatically verified interface is available
from Account and remains outside the four primary bottom-navigation tabs. It
exposes summary/list/detail information layers plus explicit loading, empty,
error, approval, correction, deletion, and restore states. Product-owner
browser acceptance passed on 2026-07-26 PDT after reviewing the populated
Assistant demo.

Completed sequential gate: STORY-038A authenticated, read-only Assistant
context. The automatically verified operation aggregates stable user-scoped domain
reads behind one typed service and endpoint without model calls, proposal
creation, or write authority. Focused tests, the full 163-test backend suite,
Python compilation, and deterministic sample review pass. Product-owner API
acceptance passed on 2026-07-26 PDT.

Completed sequential gate: STORY-038B deterministic Weekly Plan proposal. This
automatically verified candidate creates one idempotent, evidence-backed
Pending proposal with an inspectable before/after diff, while preserving the
current WeeklyPlan until a later, explicit approval-and-execution slice.
Focused tests, the full 172-test suite, Python compilation, and the
deterministic sample review pass. Product-owner acceptance passed on
2026-07-26 PDT.

Completed sequential gate: STORY-038C approved Weekly Plan execution. This
automatically verified slice accepts only an already-approved
weekly-plan Proposal, applies its decided after-state exactly once through
`WeeklyPlanService`, verifies the stored Plan, and appends the reversible
Action result without granting generic execution authority. Focused tests pass
27 cases; the full 179-test suite, Python compilation, and deterministic sample
review pass. Product-owner API acceptance passed on 2026-07-26 PDT.

Completed sequential gate: STORY-038D typed Weekly Plan Undo. This slice may
reverse only one succeeded, reversible STORY-038C Action after proving the
target Plan still matches the Action's verified result. It restores the exact
recorded before-state through `WeeklyPlanService`, verifies the result, and
atomically records the Undo Action plus the original Action and Proposal state
changes. Generic Undo and unrelated Action operations remain unavailable.

Candidate checkpoint (2026-07-26 PDT): the typed endpoint and atomic service,
repository, schema, and audit behavior are implemented. Focused Assistant and
trust-ledger verification passes 29 tests; Python compilation and the
deterministic sample review pass. The current complete run passed 183 of 184
tests; prior complete runs passed 182 of 183. Each run had one different
transient authenticated request failure, every failing test passed in
isolation, and the complete inventory passed across bounded partitions.
Product-owner API acceptance passed on 2026-07-26 PDT. The product owner
accepted the full-suite authentication flake as a separate non-blocking
stability investigation aligned with STORY-031; the flake remains unresolved.

Current sequential gate: STORY-026 bounded LangGraph Weekly Adjustment pilot.
The accepted STORY-038A-D context, proposal, approval, execution, and typed
Undo services remain canonical. LangGraph may only orchestrate those services,
persist resumable workflow checkpoints separately from domain truth, and prove
pause, resume, rejection, retry, and exact-once execution before STORY-039 or
OpenClaw write integration proceeds.

Accepted checkpoint (2026-07-26 PDT): LangGraph 1.x and the official SQLite
checkpointer now orchestrate one deterministic Weekly Adjustment workflow. The
approval node has no pre-interrupt side effect; Decision recording is safely
reusable after a checkpoint failure; execution reuses the accepted idempotent
STORY-038C service. Seven workflow integration tests and 34 combined
STORY-038/026 tests pass, including process-boundary restart, edit, reject,
retry, exact replay, and account-scoped thread isolation. Checkpoints contain
only dates, status, account ID, and ledger IDs. A local start/resume/status CLI
is available for demo evidence. Product-owner acceptance passed on 2026-07-26
PDT.

Verification checkpoint: all 191 backend/workflow tests pass in one run;
Python compilation, `pip check`, deterministic sample review, and a real
four-process start/status/resume/replay CLI demonstration pass.
