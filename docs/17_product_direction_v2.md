# Theseus Product Direction v2

- Status: accepted product direction
- Decision date: 2026-07-30
- Product owner: Dong Zhang
- Engineering owner: Dong Zhang with Codex implementation support
- Scope: post-pilot product evolution; not a claim of released behavior

## 1. Purpose and Authority

This document freezes the two product directions agreed after the first
authenticated App, Assistant, OpenClaw, Telegram, and personalization pilots:

1. turn the local App into a quieter, visual-first daily workspace;
2. turn the same local domain into a user-initiated conversational assistant.

The two tracks share one product model and one evidence boundary. They are not
separate products, and neither track may introduce a second source of truth.

This document owns the product direction and delivery order. Executable code
and tests remain authoritative for current behavior. Data and HTTP contracts
remain in `docs/03_data_model.md` and `docs/04_api_contract.md`.

## 2. Product North Star

Theseus should become a local personal assistant that is useful every day
without making the user surrender their personal history or decision authority.

The intended daily loop is:

```text
See the day -> ask or speak -> understand the recommendation
-> approve a bounded change -> focus -> record evidence -> review
```

The weekly evidence-backed review remains the product kernel. Daily
visualization and conversation make that kernel faster to use; they do not
replace deterministic evidence, inspectability, or user approval.

## 3. Non-Negotiable Product Boundary

The accepted architecture is:

> Local-first, cloud-assisted, consent-bound AI.

- SQLite and Theseus domain services are the only canonical source of personal
  data.
- Cloud AI is called only after an explicit user text, tap, or voice action.
  There is no default background listening or unsolicited cloud inference.
- Provider API keys and calendar credentials stay in the local backend. They
  never enter frontend storage, channel messages, model context, or logs.
- The backend builds an allowlisted, request-specific context envelope. It
  never sends a raw database, complete history, unrestricted notes, or
  credentials to a model.
- The model receives only the user utterance and the smallest structured facts
  needed to complete that intent.
- Model output cannot execute SQL or mutate domain records directly. It may
  select typed read tools or draft typed proposals.
- Material writes preserve the accepted control loop:

```text
Proposal -> Preview -> Approve -> Execute -> Verify -> Undo
```

- The deterministic review, plan, focus, history, and recommendation fallback
  continue working without an external model key.
- Provider and channel adapters remain replaceable.

## 4. Direction A: Visual-First Daily Workspace

### 4.1 Outcome

The App should answer the user's current question by shape, position, and
comparison before asking them to read prose. Text remains available for exact
values, evidence, decisions, accessibility, and deeper interpretation.

The target is not a generic analytics dashboard. Each visual must help the user
decide what to inspect or do next.

### 4.2 Information Architecture

- Reduce repeated Review and Signals summaries.
- Where Review and Signals present the same deterministic conclusion, combine
  their Level 1 experience into one weekly-insight flow. Preserve their
  underlying evidence types and drill-down behavior until a separate contract
  change is accepted.
- Keep Focus as the live execution surface and Plan as the bounded adjustment
  surface.
- Keep detailed narrative and raw evidence behind a focused detail layer.
- Use icons for stable actions and categories, not as decoration or as a
  replacement for evidence.
- Use one familiar icon system, accessible names, and a text or pattern cue
  wherever color carries meaning.

### 4.3 Visual Mapping

Choose charts by time scale and question:

| User question | Time scale | Preferred visual | Required detail |
|---|---|---|---|
| Where did today's time go? | One day | Timeline or ordered duration bands | Exact session, start/end, Activity, Project |
| How was this week distributed? | Seven days | Stacked day bars | Daily totals and category/project breakdown |
| Was the month consistent? | Four to six weeks | Calendar heatmap | Date, total, and selected measure |
| What share went to each area? | Selected period | Donut chart | Total minutes, segment minutes, percentage |
| Did actual time match the plan? | Week/project | Paired or variance bars | Planned, actual, and delta |
| What needs attention? | Current week | Ranked compact signal marks | Measured value, threshold, evidence, next action |

Specific constraints:

- Do not use a seven-day heatmap. Seven days do not provide enough visual
  density; use daily bars or a timeline.
- Use the donut chart for time distribution, with the total in the center and a
  bounded number of meaningful segments. Group negligible categories only when
  the grouped contents remain inspectable.
- Use the monthly heatmap for consistency or intensity, not for comparing many
  categories.
- Never infer importance from chart color alone.
- Every chart must have an accessible summary and a path to the exact records
  that produced it.
- Empty or sparse data must remain truthful; do not render a persuasive chart
  from insufficient evidence.

### 4.4 Required UX Production Pipeline

Every material UI/UX change follows this sequence:

```text
Information question
  -> low-fidelity wireframe
  -> app-sized HTML prototype
  -> screenshot and interaction review
  -> product-owner acceptance
  -> React implementation from accepted HTML and images
  -> responsive, accessibility, state, and browser verification
```

Rules:

- Do not begin production React restoration before the wireframe and HTML
  hierarchy are accepted.
- Treat screenshots and visual references as replaceable style evidence, not
  as behavior specifications.
- Reuse semantic tokens and shared components before adding page-specific CSS.
- Test populated, sparse, empty, loading, error, disabled, and success states.
- Review at phone width and desktop composition width.
- References such as Keep may inform density and scanability, but Theseus must
  preserve its own evidence-first behavior and visual identity.

### 4.5 Direction A Acceptance Gate

The first visual slice is accepted only when:

- a user can understand today's and this week's time distribution without
  reading a paragraph;
- the donut, weekly bars, and later monthly heatmap each answer a distinct
  question;
- Review/Signals duplication is measurably reduced;
- every visual opens matching persisted evidence;
- chart semantics do not diverge from the review engine;
- mobile and desktop screenshots, keyboard behavior, accessible names, focused
  frontend tests, TypeScript, and the production build pass.

## 5. Direction B: Local-First Conversational Assistant

### 5.1 Outcome

The App and Telegram should provide the same assistant capability:

- ask what to do now;
- query plans, Tasks, Focus state, time use, and review evidence;
- draft a plan or Task change;
- approve, execute, verify, and undo supported changes;
- start with text and add deliberate push-to-talk voice;
- support English and Chinese first without changing canonical domain data.

OpenClaw and Telegram remain channel adapters. They do not own a separate
assistant personality, planning policy, memory, or authorization model.

### 5.2 Shared Assistant Boundary

```text
App text / App voice / Telegram
                |
       Theseus Assistant Gateway
                |
  Intent + minimal context envelope
                |
 Cloud model <-> typed Theseus tools
                |
 Policy + proposal/approval/action ledger
                |
 Local domain services -> SQLite
```

The Assistant Gateway owns provider selection, context minimization, redaction,
request limits, and cloud-failure fallback. Channels only normalize trusted
input and present typed results.

### 5.3 Minimal Context Envelope

The backend creates a fresh envelope for each user request. An envelope may
contain:

- the current utterance or transcript;
- account timezone and requested date window;
- IDs, names, statuses, and bounded aggregates for directly relevant Goals,
  Projects, Tasks, Activities, FocusSessions, plans, and TimeLogs;
- a compact deterministic review or recommendation result;
- free/busy Calendar intervals or explicitly selected event fields;
- the exact typed tool schemas available for that request.

It must not contain:

- API keys, OAuth tokens, passwords, session credentials, or pairing tokens;
- account email unless the user explicitly asks for an email-related action;
- unrestricted notes, full review prose, raw evidence dumps, or unrelated
  history;
- records from another account;
- raw audio after transcription unless the user explicitly opts into retention.

Each provider request must be testable as a serialized envelope. Privacy tests
must fail if a denied field is present.

### 5.4 What-Should-I-Do-Now Service

The answer to "What should I do now?" must not depend on model intuition alone.
A deterministic `NextActionService` should rank bounded candidates using:

- an active FocusSession;
- the next fixed Calendar commitment and available interval;
- the current WeeklyPlan and open Tasks;
- project priority, stage, dormancy, and recent evidence;
- estimated duration and remaining time;
- explicit user preferences and protected slack.

The service returns a recommendation, evidence, alternatives, and any
uncertainty. The model may explain or translate that result but may not invent
the ranking evidence.

### 5.5 App Assistant Interaction

- Provide one persistent, restrained assistant affordance inside the App shell.
- Tap opens text conversation.
- Press and hold starts push-to-talk only while visibly active.
- Provide an equivalent explicit record control for keyboard, switch-control,
  and users who cannot use long press.
- Show clear listening, processing, speaking, cancelled, offline, and error
  states.
- Do not retain raw audio by default. Transcript retention must be visible and
  user-controlled.
- The first voice release is turn-based:

```text
Record -> transcribe -> resolve intent -> call typed tools
-> present/approve -> optionally speak the result
```

- Continuous full-duplex voice is a later optimization after the turn-based
  path is accurate, cancellable, and privacy-tested.

### 5.6 Google Calendar Boundary

Google Calendar is an external commitment adapter, not a second planning
database.

First release:

- connect explicitly and store OAuth credentials only in protected local
  backend storage;
- read free/busy intervals first;
- optionally import selected event title, start, end, calendar ID, and external
  ID when the user enables event detail;
- represent fixed commitments separately from Theseus Tasks and TimeLogs;
- use incremental pull and manual refresh for the local product;
- expose connection state, last sync, error, disconnect, and credential
  deletion.

Deferred:

- automatic event creation or rewriting;
- broad calendar scopes;
- unattended bidirectional synchronization;
- a public webhook requirement for the local-only product.

Any later calendar write is a separate permission and approval gate with
preview, idempotency, verification, and Undo where the provider supports it.

### 5.7 Conversational Onboarding

The assistant may shorten initialization by asking one question at a time for:

- timezone and working window;
- current Goals and Projects;
- recurring commitments;
- preferred focus duration and slack;
- first WeeklyPlan.

The assistant must show the resulting structured setup before saving it.
Conventional forms remain available as a fallback and correction path.

### 5.8 Direction B Acceptance Gate

The first conversational slice is accepted only when:

- App text and Telegram receive the same deterministic next-action result for
  the same account and context;
- no provider key or credential is observable in frontend storage or logs;
- cloud calls occur only after explicit user interaction;
- serialized request tests prove minimal context and account isolation;
- read failures and provider outages leave local core behavior usable;
- every write remains typed, previewed, approved, idempotent, audited,
  verified, and reversible where practical;
- request cancellation, timeouts, cost limits, and a visible cloud-processing
  indicator exist.

## 6. Ordered Delivery

The two directions may be planned together, but implementation should use
small, independently accepted vertical slices. With one engineering owner, do
not keep two cross-module slices in progress at once.

| Order | Slice | Depends on | Demonstrable result |
|---:|---|---|---|
| 0 | Integrate and freeze the current accepted candidate | Current PR verification and product-owner merge decision | One reproducible baseline |
| 1 | Privacy and Assistant Gateway contract | Existing typed Assistant API | A testable minimal context envelope with no model call required |
| 2 | Deterministic NextActionService | Plans, Tasks, Focus, review evidence | Local "what now" result with evidence and alternatives |
| 3 | Visual information architecture | Accepted local data views | Wireframes for Today, week, month, distribution, and combined weekly insight |
| 4 | App text assistant | Slices 1-2 | In-App query and proposal preview using the shared gateway |
| 5 | Read-only Calendar commitments | Slices 1-2 | Fixed commitments influence the same local next-action result |
| 6 | HTML visual prototype and chart validation | Slice 3 | Accepted app-sized interactive prototype |
| 7 | React visual restoration | Slice 6 | Donut and weekly visual flow backed by persisted evidence |
| 8 | Turn-based multilingual voice | Slice 4 | Tap/hold-to-talk query with visible cloud boundary |
| 9 | Conversational onboarding | Slices 4-5 and accepted setup contracts | Voice/text setup with preview and form fallback |
| 10 | Later gates | Real usage evidence | Realtime voice, calendar writes, bounded proactive behavior |

## 7. Candidate Backlog Split

These identifiers reserve scope; they do not claim that implementation is
ready or released.

| Story | Outcome | Entry dependency |
|---|---|---|
| STORY-040 | Freeze the visual-first information architecture and HTML prototype | Current baseline integrated |
| STORY-041 | Add evidence-backed time distribution and multi-scale charts | STORY-040 accepted |
| STORY-042 | Add the local Assistant Gateway and minimal-context policy | Existing Assistant API |
| STORY-043 | Add deterministic next-action recommendation | Stable Task/Plan/Focus services |
| STORY-044 | Add the in-App text assistant | STORY-042 and STORY-043 |
| STORY-045 | Add read-only Google Calendar commitments | STORY-042 and STORY-043 |
| STORY-046 | Add multilingual push-to-talk | STORY-044 |
| STORY-047 | Add conversational onboarding | STORY-044 and STORY-045 |

Each story needs a focused issue with owner, file ownership, API or component
contract, acceptance criteria, verification commands, and demo evidence before
it moves to `Ready`.

## 8. Explicitly Deferred

- Cloud sync as the source of truth.
- Cloud identity or third-party sign-in.
- Always-on listening.
- Sending full personal history to a model.
- Direct model access to SQLite.
- Automatic calendar rewriting.
- Unreviewed AI-generated plan or Task writes.
- Realtime voice before turn-based voice is accepted.
- Learned ranking before the frozen consented evaluation threshold is met.
- Background proactive execution before explicit standing-order controls,
  expiry, rate limits, audit, and a kill switch are exercised.

## 9. Verification Evidence for Every Slice

Every implementation slice records:

- focused automated tests and full affected-suite results;
- deterministic sample-review verification after review or evidence changes;
- Python compilation after Python changes;
- TypeScript, frontend tests, and production build after frontend changes;
- sanitized mobile and desktop screenshots after UI changes;
- a serialized redacted provider request after cloud-AI changes;
- a local fallback demonstration without a provider key;
- the product-owner browser or conversation acceptance result;
- known limitations and skipped checks.
