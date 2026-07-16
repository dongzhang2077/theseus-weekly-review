# Agile Delivery Plan

## 1. Process

The team will use a lightweight Scrum-style process:

- One-week sprints
- GitHub issues for user stories and tasks
- A simple board with `Backlog`, `Ready`, `In Progress`, `Review`, and `Done`
- Short weekly demo at the end of each sprint
- Definition of Done for every merged feature

## 2. Roles

| Role | Owner | Responsibility |
|---|---|---|
| Product owner | Both | Keep scope aligned with the proposal and course deliverables. |
| Backend/review lead | Dong Zhang | Backend, database, review engine, integration. |
| Frontend/design lead | Zhi Kang | UI screens, review report page, dashboard, visual presentation. |
| QA/evaluation | Both | Sample data, review scoring, user feedback, final validation. |

## 3. Sprint Calendar

### Sprint 0: Project Setup and Architecture

Dates: 2026-06-10 to 2026-06-13

Goal:

Prepare the project workspace, architecture, backlog, and Progress Report 1.

Deliverables:

- GitHub-ready repository structure
- Architecture documents
- MVP backlog
- Progress Report 1 talking points
- Sample week data format

### Sprint 1: Backend Data Foundation

Dates: 2026-06-14 to 2026-06-20

Goal:

Build the backend MVP foundation.

Deliverables:

- SQLite schema
- FastAPI app skeleton
- CRUD endpoints for goals, projects, plans, and time logs
- Sample data loader
- Deterministic review endpoint stub

### Sprint 2: Rule-Based Weekly Review

Dates: 2026-06-21 to 2026-06-27

Goal:

Generate useful review output without relying on an LLM.

Deliverables:

- Goal-time alignment check
- Plan-vs-actual check
- Activity energy-impact summary
- Dormancy and slack risk checks
- JSON weekly review output

### Sprint 3: Frontend MVP

Dates: 2026-06-28 to 2026-07-04

Goal:

Build the user-facing flow for input and review display.

Deliverables:

- Goal/project setup page
- Weekly plan page
- Time-log page
- Weekly review result page
- Simple dashboard shell

### Sprint 4: AI Review Integration

Dates: 2026-07-05 to 2026-07-11

Goal:

Turn deterministic evidence into supportive weekly review text.

Deliverables:

- LLM adapter
- Structured prompt
- `win`, `insight`, `next_step` output
- Stored review result
- Factual guardrails

### Sprint 5: Midterm Demo Preparation

Dates: 2026-07-12 to 2026-07-18

Goal:

Prepare a working prototype for the midterm implementation checkpoint.

Deliverables:

- Integrated backend + frontend demo
- 3-5 sample weekly datasets
- Review quality scores
- Demo script
- Midterm slides

#### Sprint 5 Replan: 2026-07-15

This replan records new teacher feedback and the implementation state three
days before the checkpoint. It does not rewrite the original sprint goal.

Measurable sprint goal:

By 2026-07-18, demonstrate that one local user can create and retain personal
weekly-review data, understand the most important evidence-backed signal, and
approve a realistic next-week adjustment.

Critical path:

```text
Local-user contract -> SQLite/API ownership -> frontend user context
-> restart persistence -> Signals/Plan integration -> verification
-> demo rehearsal
```

Required scope:

- Local user creation and selection without production authentication.
- User-scoped goals, projects, plans, logs, reflections, and stored reviews on
  the demonstrated path.
- A restart test proving local persistence.
- Removal of misleading static severity from Signals.
- Real week/project/capacity data in the demonstrated Plan path.
- Integrated verification and a fallback demo recording.

Deferred from this sprint:

- LangGraph runtime integration.
- OpenClaw integration.
- Production auth, cloud sync, and broad external tool execution.
- Learned personalization or custom model training.

Owners, dependencies, acceptance criteria, verification commands, and demo
evidence are defined in
[`13_product_agent_development_strategy.md`](13_product_agent_development_strategy.md#11-immediate-sprint-5-replan).

Delivery checkpoint (2026-07-15 PDT):

- GitHub Issue #63 is completed and the project board is `Done`.
- PR #64 was squash-merged to `main` as commit `306061c`.
- The project owner explicitly approved direct merge and waived the separate
  teammate-review gate for this checkpoint.
- Engineering verification is complete; one timed live rehearsal and one
  fallback recording remain before the July 18 demo.

### Sprint 6: Evaluation and Final Report

Dates: 2026-07-19 to 2026-08-01

Goal:

Improve the prototype and finish validation/reporting.

Deliverables:

- Classmate feedback
- Evaluation summary
- Revised review output
- Final presentation
- Final report
- AI usage documentation

## 4. Definition of Ready

A task is ready when:

- The goal is clear.
- Inputs and outputs are known.
- Acceptance criteria are written.
- Dependencies are listed.
- The task can be completed in one sprint.

## 5. Definition of Done

A task is done when:

- Code or documentation is committed.
- The acceptance criteria are satisfied.
- The feature works with sample data.
- The implementation is reviewed by the other teammate when practical.
- Any known limitation is documented.

## 6. Weekly Rituals

Suggested weekly rhythm:

- Planning: choose sprint tasks and owners.
- Midweek check: identify blockers.
- Demo: show working output, not only plans.
- Retrospective: decide one process improvement.
