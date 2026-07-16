# System Architecture

## 1. Architectural Goal

The architecture separates user input, data persistence, deterministic review logic, AI generation, and evaluation. This keeps the MVP explainable and testable.

## 2. High-Level Diagram

```text
┌─────────────────────────────────────────────────────────────┐
│ Frontend                                                     │
│ Local profile | Goal/project | Plan | Time logs | Review      │
└───────────────────────────────┬─────────────────────────────┘
                                │ HTTP/JSON
┌───────────────────────────────▼─────────────────────────────┐
│ FastAPI Backend                                               │
│ Validation | User scope | CRUD | Review orchestration         │
└───────────────────────────────┬─────────────────────────────┘
                                │ SQL
┌───────────────────────────────▼─────────────────────────────┐
│ SQLite Database                                               │
│ Users | Goals | Projects | Plans | Logs | Reviews             │
└───────────────────────────────┬─────────────────────────────┘
                                │ Structured review state
┌───────────────────────────────▼─────────────────────────────┐
│ Review Engine                                                 │
│ Deterministic checks | LLM adapter | Report builder           │
└───────────────────────────────┬─────────────────────────────┘
                                │ Review output + metrics
┌───────────────────────────────▼─────────────────────────────┐
│ Evaluation Layer                                              │
│ Sample weeks | Review quality rubric | User feedback           │
└─────────────────────────────────────────────────────────────┘
```

## 3. Component Responsibilities

### Frontend

Responsibilities:

- Collect goals, projects, plans, time logs, and reflection notes.
- Create/select a local profile, retain its ID, and send it with personal API
  requests.
- Display weekly review output.
- Display a simple dashboard for time distribution and risk flags.

Expected technology:

- React or Next.js
- TypeScript
- Simple component library or plain CSS for MVP speed

### Backend

Responsibilities:

- Validate all incoming data.
- Resolve `X-Theseus-User-Id` and bind personal operations to that local owner.
- Store data in SQLite.
- Prepare structured review state.
- Call the review engine.
- Return review results to the frontend.

Expected technology:

- FastAPI
- Pydantic
- SQLite for MVP

### Database

Responsibilities:

- Persist local users plus user-owned goals, projects, plans, logs,
  reflections, reviews, and evaluation records.
- Enforce user-scoped uniqueness and reject cross-user references.
- Preserve raw activity names and user-corrected activity labels.

Expected technology:

- SQLite for MVP
- PostgreSQL-compatible schema direction for future cloud version

### Review Engine

Responsibilities:

- Run deterministic checks first.
- Detect goal-time gaps, plan-vs-actual drift, activity-impact mix, dormancy risk, overload risk, and slack risk.
- Generate a structured review.
- Use LLM only after the evidence state is prepared.

Expected technology:

- Python rule modules for deterministic checks
- LangGraph for stateful workflow after the MVP rule pipeline is stable
- OpenAI or Claude provider adapter

### Evaluation Layer

Responsibilities:

- Store sample weekly datasets.
- Rate generated reviews using a rubric.
- Record limited external feedback from classmates.

## 4. Review Pipeline

```text
Load weekly context
  -> Validate required inputs
  -> Normalize durations and project links
  -> Suggest missing activity labels if needed
  -> Analyze goal-time alignment
  -> Analyze plan-vs-actual gap
  -> Analyze activity energy-impact mix
  -> Detect dormancy and overload risk
  -> Generate evidence package
  -> Generate positive weekly review
  -> Store review result
  -> Collect feedback
```

## 5. Design Principles

1. Evidence before advice.
2. Deterministic checks before AI wording.
3. User corrections override AI suggestions.
4. Reviews should be supportive, specific, and restrained.
5. Slack protection is part of quality, not an optional feature.

## 6. MVP Technology Decisions

| Decision | Choice | Reason |
|---|---|---|
| Backend | FastAPI | Fits Python AI workflow and Pydantic validation. |
| Database | SQLite | Enough for local MVP and simple demos. |
| Local identity | Explicit user ID header; no production auth | Gives persistent ownership without expanding into cloud identity. |
| Review workflow | Rule pipeline first, LangGraph later | Reduces risk and improves explainability. |
| Frontend | React or Next.js | Familiar, fast to prototype, easy to deploy. |
| AI provider | Adapter interface | Avoids locking the project to one provider. |

## 7. Design References

Theseus implementation should be built independently in this repository. Useful design reference areas include:

- time-log data requirements
- SQLite schema ideas
- project lifecycle and dormancy concepts
- activity energy-impact labels
- evidence-first weekly review flow
- mobile capture and sync architecture experiments

These references should inform the design while the course implementation remains independent.
