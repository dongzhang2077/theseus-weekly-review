# Decision Log

## 2026-06-11: Create a Clean Theseus Workspace

Decision:

Create a new GitHub-ready workspace named `theseus-weekly-review`.

Reason:

Pre-proposal work contains useful exploration but mixes personal notes, proposal files, slides, historical data, and prototype code. A clean repo is easier for team collaboration, GitHub issues, sprint tracking, and final submission.

Consequences:

- Theseus implementation work should happen in the clean course repo.
- Prior exploration may inform requirements and architecture, while implementation work remains in this course repo.
- The new repo follows the proposal scope.
- The old workspace remains an archive and reference source.

## 2026-06-11: Scope Theseus as a Weekly Review Layer

Decision:

Treat Theseus as a weekly AI review system, not a complete personal operating system.

Reason:

The proposal baseline and course timeline require a focused MVP. Weekly review is specific, testable, and demonstrable.

Consequences:

- Calendar rewriting is out of scope.
- Wearables are out of scope.
- Full OpenClaw integration is a later extension.
- The MVP focuses on goals, weekly plans, time logs, activity labels, and review output.

## 2026-06-11: Use Deterministic Checks Before LLM Generation

Decision:

Build rule-based checks before introducing LangGraph or LLM-generated wording.

Reason:

The review must be explainable and factually grounded. Deterministic checks reduce the risk of vague AI advice.

Consequences:

- The first working review can be generated without an API key.
- LLM integration becomes a wording layer over structured evidence.
- Evaluation can separately score evidence quality and wording quality.

## 2026-06-11: Use SQLite for MVP

Decision:

Use SQLite for the MVP.

Reason:

SQLite is simple, local-first, and enough for sample data and demo workflows.

Consequences:

- No cloud database setup is required for early development.
- Schema should still be designed so PostgreSQL can be used later.

## 2026-07-15: Add a Local User as the Data Ownership Root

Decision:

Add local user creation and selection, then scope personal records and weekly
review persistence to that user. This is local identity for data ownership, not
production authentication.

Reason:

Teacher feedback identified restart-safe personal persistence as valuable for
the demo. A stable ownership root is also required before Theseus can maintain
long-term preferences or safely expose agent tools.

Consequences:

- The data model and API contract define `users` as the ownership root.
- User-owned HTTP operations use `X-Theseus-User-Id`; the header is an explicit
  local ownership scope, not an authentication credential.
- The browser retains the selected local user ID and restores it on restart.
- User-owned uniqueness rules must include the user context.
- Cross-user references and unscoped list/review operations are invalid.
- Schema version 1 data migrates to a generated `Local User` instead of being
  silently discarded.
- At this checkpoint, production auth, cloud sync, and multi-tenant security
  remained deferred. The local HTTP identity mechanism is superseded by the
  following 2026-07-17 decision.

## 2026-07-17: Replace Selectable Profiles with Formal Local Accounts

Decision:

Keep SQLite and local-only deployment, but replace public profile discovery and
`X-Theseus-User-Id` selection with email/password accounts, JWT sessions, and
authenticated ownership resolution.

Reason:

The product owner chose durable user identity and isolation as a P0 capability,
not a disposable demo shortcut. A selectable integer header permits trivial
impersonation and cannot safely support long-lived personal data or future
agent tools.

Consequences:

- Passwords are hashed with Argon2id; plaintext passwords are never stored.
- Short-lived access JWTs stay in browser memory. Rotating refresh JWTs use an
  HttpOnly SameSite cookie plus a readable, hashed CSRF token.
- Session rows support logout, password-change revocation, expiry, and refresh
  reuse detection; access requests also require an active session.
- Registration, login, profile/email/password changes, logout, and
  account deletion are first-class API and mobile UI flows.
- Public `/users` routes are removed. Personal routes ignore the old user-ID
  header and derive ownership only from authenticated context.
- Schema v3 adds credentials and sessions without deleting v2 profile data;
  v4 removes the unused recovery-code column while preserving accounts.
- Cloud sync, third-party login, email delivery, and multi-device conflict
  handling are still deferred; this decision is formal local auth, not a cloud
  identity service.

## 2026-07-15: Simplify Signals and Plan Before Adding More Features

Decision:

Preserve the current Review and Track information hierarchy. Redesign Signals
as an evidence explanation surface and Plan as a next-week adjustment surface.

Reason:

Signals currently uses decorative severity cues that compete with evidence.
Plan combines weekly adjustment, capacity, and Goal/Project setup while relying
on fixture-specific values. Both increase interpretation cost and weaken trust.

Consequences:

- This is an information-architecture refactor, not an art-direction change.
- Signals and Plan retain the current Warm Stationery palette, paper texture,
  line treatment, and purposeful companion-art language so they remain
  visually consistent with Review and Track.
- Signals uses aligned, data-backed rows and evidence details instead of a
  decorative orbit.
- Plan shows real week/capacity/slack data, one proposal, a diff, and reversible
  application.
- Goal and Project creation move outside Plan Level 1.
- Fixture, loading, empty, and error states must be explicit.

## 2026-07-15: Separate Domain Truth, Agent Workflow, and Execution Channels

Decision:

Treat Theseus as the source of truth, LangGraph as a future workflow
orchestrator, and OpenClaw as an optional conversation/execution adapter.

Reason:

This preserves the evidence-first domain model and avoids three competing
memory systems or duplicated review logic.

Consequences:

- LangGraph is introduced only for a workflow that needs durable state and
  human approval.
- OpenClaw starts read-only and never accesses the domain database directly.
- Material writes require policy, approval, idempotency, audit, verification,
  and Undo where practical.
- Agent and personalization work remains outside the 2026-07-18 demo scope.
- The detailed phase gates live in
  `docs/13_product_agent_development_strategy.md`.
