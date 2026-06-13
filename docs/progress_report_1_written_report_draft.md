# CSIS 4495 - 071 Progress Report 1

Team Name: Zisyphuz  
Project Name: Theseus: Weekly AI Review for Goal-Time Alignment  
Team Members: Dong Zhang, Zhi Kang  
Instructor: Michael Ma  
Date: June 13, 2026

## 1. Project Update

### 1.1 Tasks Completed Since the Proposal

Since submitting the proposal on June 9, 2026, the team has moved Theseus from a broad concept into an implementation-ready MVP plan. The main work completed after the proposal was Sprint 0 foundation work: refining the project scope, organizing the GitHub repository, documenting the system architecture, and creating a repeatable local review-engine demo.

Theseus is now defined as a weekly AI review layer for goal-time alignment. The system compares a user's goals, weekly plan, actual time logs, activity energy-impact labels, and optional reflection notes. It then produces a supportive weekly review with evidence-backed wins, insights, risk flags, and next-week adjustments. This is narrower than the original broader productivity concept and gives the team a clear implementation path for the course timeline.

The GitHub repository now includes organized folders for backend code, frontend planning, review-engine logic, documentation, sample data, scripts, and evaluation materials. The documentation set includes the product requirements, system architecture, data model, API contract, review-engine design, agile delivery plan, product backlog, decision log, GitHub workflow, and architectural runway. These files make the project easier to divide into implementation tasks and help ensure the team is working from the same technical assumptions.

On the implementation side, the repository includes a FastAPI backend skeleton with a health route and a weekly review analysis route. It also includes Pydantic schemas for goals, projects, weekly plans, planned items, time logs, daily reflections, and weekly review requests. The review engine currently runs as a separate Python module, which keeps the analysis logic independent from the API layer. This separation is important because the same review logic can be used by command-line demos, backend endpoints, evaluation scripts, and later AI wording.

The team also created a sample weekly dataset at `data/sample/sample_week.json` and a repeatable demo command:

```bash
python3 scripts/run_sample_review.py
```

This command loads the sample week, calls `review_engine.rules.analyze_week`, and prints a structured weekly review. The output includes wins, insights, risk flags, next steps, evidence, and generated text. Example output includes a win showing that Theseus backend work received 4.0 hours, an insight showing that the Build Theseus MVP goal received 5.0 hours of goal-linked work, a risk flag showing that internship preparation received 0 goal-linked minutes, and a next step recommending one small restart block.

### 1.2 Current Implementation Status

The current status is that Sprint 0 is complete and Sprint 1 is ready to begin. The project is not a finished product yet. The current demo proves that the rule-based review logic can analyze repeatable sample data, but it does not yet prove database persistence, CRUD flows, frontend integration, or stored weekly reviews.

The safest current technical claims are:

- The MVP scope and architecture are documented.
- The backend skeleton and validation schemas exist.
- The review engine can run against `data/sample/sample_week.json`.
- The demo output includes wins, insights, risk flags, next steps, evidence, and generated text.
- Sprint 1 will connect the review path to SQLite and FastAPI persistence.

The current architecture has five layers. The frontend will collect goals, plans, logs, and display the weekly review. The FastAPI backend will validate data, expose endpoints, and orchestrate review generation. SQLite will store local MVP records. The review engine will run deterministic checks before any AI-generated wording. The evaluation layer will use sample weeks, a scoring rubric, and classmate feedback to judge whether the reviews are factual, useful, encouraging, and restrained.

This evidence-first architecture is a key design decision. The team does not want AI to invent productivity advice directly from raw logs. Instead, the system first calculates facts such as planned minutes, actual minutes, activity mix, plan drift, dormancy risk, and slack risk. AI can later help phrase the review, but the reasoning should be grounded in deterministic evidence.

### 1.3 Challenges or Issues Encountered

The first challenge was scope control. The proposal and early design references included future ideas such as mobile capture, sync, wearable data, automatic scheduling, and broader AI interaction. These ideas may be valuable later, but including them in Sprint 1 would make the project too large and difficult to verify. The team responded by narrowing the MVP to one weekly review loop: goals, weekly plan, actual time logs, activity labels, evidence checks, weekly review, and next-week adjustment.

The second challenge was avoiding vague AI output. If the project asks an AI model to generate advice without structured evidence, the review could become generic or unsupported. The current review engine reduces that risk by producing structured evidence first. The current demo already reports concrete findings such as actual minutes per project, goal-linked time, plan drift, activity mix, and dormancy risk.

The third challenge is data quality. Theseus depends on the user's time logs and activity labels. If the input data is incomplete or inconsistent, the review can only make limited conclusions. For that reason, the team started with a clean sample week and will add more sample weeks before broader user testing. The evaluation plan will test aligned weeks, drifted weeks, overloaded weeks, and dormant-project weeks.

The fourth challenge is feedback tone. A weekly review can discourage users if it only lists failures. The MVP output is designed to start with wins, recognize useful work and recovery activities, and limit next steps to a small number of realistic actions. This keeps the review supportive while still showing risks clearly.

### 1.4 Planned Tasks for the Next Stage

Sprint 1 will focus on backend persistence. The technical target is to move from the current local demo path:

```text
sample_week.json -> review_engine -> structured weekly review
```

to the persisted backend path:

```text
sample_week.json -> SQLite -> review_engine -> stored weekly_review
```

The planned Sprint 1 tasks are to implement the SQLite schema, add a repository layer, build CRUD APIs for goals, projects, weekly plans, and time logs, load `sample_week.json` into SQLite, generate reviews from records loaded from the database, store the generated review and evidence JSON, and add a verification script for the full sample-data-to-stored-review path.

After Sprint 1, the team will harden the review checks with additional sample weeks and then build the frontend input flow and weekly review result page. The AI wording layer will come after the deterministic checks and persistence path are stable. Evaluation will use the review quality rubric and limited classmate feedback to test whether the output is understandable, useful, realistic, and evidence-backed.

### 1.5 Changes to Timeline or Project Scope

The core project direction has not changed: Theseus remains a weekly review system for goal-time alignment. The major change is scope refinement. The team removed or deferred features that would distract from the MVP, including automatic calendar rewriting, wearable integration, full mobile sync, and a general conversational productivity assistant.

This change improves feasibility. It gives the team a concrete midterm target: a working backend path that can load sample data, persist it, generate a review, and store the result. The final project can then focus on review quality, frontend usability, and evaluation rather than trying to build several loosely connected productivity tools at once.

## References

FastAPI. (n.d.). FastAPI documentation. https://fastapi.tiangolo.com/

Pydantic. (n.d.). Pydantic documentation. https://docs.pydantic.dev/

SQLite. (n.d.). SQLite documentation. https://www.sqlite.org/docs.html

Python Software Foundation. (n.d.). Python documentation. https://docs.python.org/3/

OpenAI. (n.d.). ChatGPT. https://chat.openai.com/

Project repository materials: `README.md`, `docs/01_product_requirements.md`, `docs/02_system_architecture.md`, `docs/03_data_model.md`, `docs/04_api_contract.md`, `docs/05_review_engine_design.md`, `docs/06_agile_delivery_plan.md`, `docs/07_product_backlog.md`, `docs/09_decision_log.md`, and `evaluation/review_quality_rubric.md`.

## Appendix: AI Usage Report and Documentation

AI tools were used as drafting and review support during proposal preparation, progress report preparation, slide drafting, document review, and wording refinement. AI output was not treated as final authority. The team checked final project claims against the repository, current implementation status, and Progress Report 1 feedback.

Major AI-assisted steps included:

- Extracting the project scope, problem statement, MVP boundary, architecture, and timeline from the proposal.
- Comparing Progress Report 1 requirements with the current repository status.
- Drafting and revising the five-minute presentation structure.
- Checking slide and report claims against approved technical claims.
- Preparing the written report and AI usage documentation.

Representative prompt categories:

| Prompt Category | Purpose | Output Used |
|---|---|---|
| Proposal review | Extract the project problem, MVP scope, architecture, and timeline. | Project update and scope summary. |
| Progress report planning | Match teacher requirements to current project status. | Report structure and slide outline. |
| GitHub status review | Compare repository files and issues with presentation claims. | Accurate deliverable and remaining-task lists. |
| Slide refinement | Reduce text density and avoid overstating progress. | Final Progress Report 1 slides and speaker notes. |
| AI usage documentation | Summarize how AI supported the work and how humans verified it. | Appendix content. |

Human verification included running `python3 scripts/run_sample_review.py`, checking that the report describes Sprint 0 as complete and Sprint 1 as upcoming, reviewing repository files before listing deliverables, and keeping SQLite persistence, CRUD APIs, stored weekly reviews, and frontend pages listed as next steps rather than completed work.
