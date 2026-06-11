# Decision Log

## 2026-06-11: Create a Clean Theseus Workspace

Decision:

Create a new GitHub-ready workspace named `theseus-weekly-review`.

Reason:

The previous workspace contains valuable exploration but mixes personal LifeOS ideas, proposal files, slides, historical data, and prototype code. A clean repo is easier for team collaboration, GitHub issues, sprint tracking, and final submission.

Consequences:

- Only selected assets from the earlier LifeOS work should be migrated.
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

