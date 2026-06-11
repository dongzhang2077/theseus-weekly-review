# Progress Report 1 Visual Assets

These visuals are source material for issue #14. They are also embedded in `slides/progress_report_1.html`.

## 1. Architecture Visual

Use this visual to explain how Theseus keeps evidence, analysis, storage, and presentation separate.

```mermaid
flowchart TB
    UI[Frontend UI<br/>goals, plans, logs, review page]
    API[FastAPI Backend<br/>validation, CRUD APIs, orchestration]
    DB[(SQLite Database<br/>goals, projects, plans, logs, reviews)]
    Engine[Review Engine<br/>deterministic checks first]
    Eval[Evaluation Layer<br/>sample weeks, rubric, feedback]

    UI -->|HTTP JSON| API
    API -->|SQL| DB
    API -->|weekly context| Engine
    Engine -->|structured review| API
    API -->|review result| UI
    Engine -->|review output + evidence| Eval
```

Presentation message:

- Frontend collects and displays data.
- Backend validates, persists, and orchestrates.
- SQLite stores stable MVP entities.
- Review engine calculates evidence before advice.
- Evaluation checks quality and usefulness.

## 2. Roadmap Visual

Use this visual to show that Progress Report 1 is between Sprint 0 and Sprint 1.

```mermaid
flowchart LR
    S0[Sprint 0<br/>scope, architecture, backlog,<br/>sample review demo]
    S1[Sprint 1<br/>SQLite schema, repositories,<br/>CRUD APIs, sample loader]
    S2[Sprint 2<br/>rule checks, more sample weeks,<br/>review output hardening]
    S3[Sprint 3<br/>frontend input flow,<br/>weekly review page]
    S4[Sprint 4+<br/>AI wording, evaluation,<br/>midterm demo prep]

    S0 --> S1 --> S2 --> S3 --> S4
```

Presentation message:

- Sprint 0 is complete.
- Sprint 1 starts backend persistence.
- Do not claim SQLite persistence or CRUD APIs are already complete.
- The current demo proves the review logic with sample data.

## 3. Demo Flow Visual

Use this as the technical demo transition.

```mermaid
sequenceDiagram
    participant JSON as sample_week.json
    participant Script as run_sample_review.py
    participant Engine as review_engine.rules
    participant Output as structured review JSON

    JSON->>Script: load sample week
    Script->>Engine: analyze_week(payload)
    Engine->>Engine: compute evidence and risks
    Engine->>Output: wins, insights, risk_flags, next_steps
```

Presentation message:

- Current path is local and repeatable.
- It does not yet write to SQLite.
- Sprint 1 will persist the same data and store generated reviews.
