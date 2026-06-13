# Theseus Progress Report 1 Speaker Script

Target length: about 5 minutes.

## Slide 1: Title

Good morning. We are Team Zisyphuz: Dong Zhang and Zhi Kang.

Our project is Theseus, a weekly AI review system for goal-time alignment. The main idea is to help users check whether their actual weekly time supported their important goals.

The current status is that Sprint 0 is complete. The product is not complete yet. Sprint 1 starts next with backend persistence.

## Slide 2: Project Update

Theseus is not a calendar, not a task manager, and not an automatic scheduler.

The project focuses on one review loop: goals, weekly plan, actual time logs, evidence checks, and then a realistic next-week adjustment.

Since the proposal, we organized the idea into a GitHub-tracked Sprint 0 foundation. That means the project now has a clearer MVP boundary and a more concrete development path.

## Slide 3: Roadmap and Current Status

This slide shows the sprint rhythm.

Sprint 0 is complete. It covered the foundation: proposal follow-up, project structure, documentation, sample data, and the first local review demo.

Sprint 1 is next. It is planned as a two-week backend persistence sprint. The main work will be SQLite schema, repository layer, CRUD APIs, sample data loader, and a stored review path.

After that, Sprint 2 will focus on review hardening and frontend preparation. Then we move toward the frontend review prototype, evaluation, polish, and final defense package.

## Slide 4: Deliverables Update

For Sprint 0, the proposal became a buildable project foundation.

The GitHub repository now has the main folders: backend, frontend, review engine, docs, data, and evaluation.

The core documentation is also in place, including requirements, architecture, data model, API contract, delivery plan, and backlog.

We also have a local review demo. It runs sample weekly data through a rule-based review engine. This demo is working locally, but it is not persisted in SQLite yet.

The FastAPI skeleton exists, the review quality rubric is ready, and GitHub issues and the project board are organized.

## Slide 5: Demo Evidence

The current demo command is:

```bash
python3 scripts/run_sample_review.py
```

It loads `data/sample/sample_week.json`, calls `review_engine.rules.analyze_week`, and generates a structured weekly review.

The output includes wins, insights, risk flags, next steps, evidence, and generated text.

For example, the demo can identify a goal with zero linked minutes and suggest one small restart block.

The important limitation is that this path is working locally, but not yet persisted. SQLite storage, CRUD flows, and the frontend review page are still next steps.

## Slide 6: Issues, Actions, and Next

The main control for Sprint 1 is evidence first, then generated wording.

One issue is that AI output can become vague. Our action is to use deterministic checks first, so AI wording only explains evidence.

Another assumption is that logs may be incomplete. We will start with clean sample weeks and add validation before broader testing.

Feedback tone also matters. The review format should stay supportive: win, insight, and next step.

For Sprint 1, the backend persistence tasks are SQLite schema, repository layer, CRUD APIs, sample loader, and stored review path.

AI was used for planning, drafting, review, and wording support. Final scope and claims were checked by the team, and AI usage documentation will be submitted with the progress report.

## Slide 7: Closing

To summarize: Sprint 0 is complete, and Theseus now has a clear GitHub foundation and a working local review demo.

Sprint 1 begins with backend persistence, so the next milestone is moving from:

```text
sample_week.json -> review_engine
```

to:

```text
sample_week.json -> SQLite -> review_engine -> stored weekly review
```

Thank you. We are happy to answer questions.
