# Progress Report 1 Technical Notes

Date: 2026-06-15

Purpose: technical handoff notes for Progress Report 1 slides and script.

## 1. Technical Status Summary

Sprint 0 is complete. The project has moved from proposal scope into an implementation-ready MVP plan.

Completed Sprint 0 technical work:

- Defined the MVP as a weekly AI review layer, not a replacement for calendars, task managers, or time trackers.
- Documented the system architecture: frontend, FastAPI backend, SQLite storage, review engine, and evaluation layer.
- Added a FastAPI backend skeleton and Pydantic schemas for the public API contract.
- Built the first review engine path that reads a sample week and returns structured review output.
- Added `data/sample/sample_week.json` as a repeatable demo fixture.
- Added an evaluation rubric for judging review usefulness, evidence quality, tone, and actionability.
- Set up GitHub issues and Project Board tracking for both engineering and course-deliverable work.

Sprint 1 starts next. The technical goal is to move from an in-memory sample review to a persisted backend path.

Sprint 1 backend tasks:

- Implement the SQLite schema for goals, projects, weekly plans, planned items, time logs, daily reflections, and weekly reviews.
- Add a repository layer so SQL stays out of FastAPI route handlers.
- Implement CRUD APIs for the Sprint 1 entities.
- Load `sample_week.json` into SQLite for repeatable demos and tests.
- Harden the review engine against persisted records.
- Add a persisted weekly review orchestration path.
- Add a verification script for `sample_week.json -> SQLite -> review_engine -> stored weekly_review`.

Avoid this wording:

- "The SQLite backend is complete."
- "Sprint 1 implementation is done."
- "The mobile app sync path is part of the current sprint."

Use this wording instead:

- "Sprint 0 is complete, and Sprint 1 starts with backend persistence."
- "The current demo proves the review logic using sample data."
- "The next sprint connects the same review logic to SQLite and API workflows."

## 2. Demo Talking Points

Current demo path:

```text
data/sample/sample_week.json -> review_engine -> structured weekly review output
```

What the demo proves:

- Theseus can read a representative week of goals, plans, time logs, and reflections.
- The review engine computes evidence before writing advice.
- The output includes wins, insights, risk flags, next steps, evidence, and generated text.
- The review can identify both progress and risk without blaming the user.

Example signals from the current sample:

- Win: Theseus backend received 4.0 hours.
- Insight: the Build Theseus MVP goal received 5.0 hours of actual goal-linked work.
- Risk: internship preparation received 0 goal-linked minutes.
- Risk: resume and applications had no logged time and has been inactive for 30 days.
- Next step: protect one small restart block instead of adding a large task dump.

Why deterministic checks come first:

- The system should not ask an LLM to invent analysis from unsorted raw data.
- Deterministic checks calculate facts such as planned minutes, actual minutes, activity mix, and dormancy risk.
- The AI layer should receive structured evidence and focus on supportive wording.
- This keeps the review evidence-backed, easier to test, and safer for a course MVP.

## 3. 45-60 Second Technical Script

For the technical demo, the current implemented path is sample data into the review engine. The input is `sample_week.json`, which contains goals, weekly plans, time logs, activity energy labels, and a reflection. The review engine turns that evidence into a structured weekly review with wins, insights, risk flags, next steps, and a generated summary.

The important design choice is that Theseus does not start by asking an LLM for general productivity advice. It first runs deterministic checks: goal-time alignment, plan-vs-actual gaps, activity energy mix, and dormancy risk. For example, the sample output can show backend progress, frontend plan drift, and a dormant resume project using actual logged evidence.

Sprint 1 will connect this same review logic to SQLite and the FastAPI backend. That means the next step is persistence: schema, repository layer, CRUD APIs, sample data loader, and a stored weekly review path.

## 4. Slide Integration Notes

Recommended slide content for the technical section:

- Current status: "Review engine demo works with sample weekly data."
- Architecture: "Frontend -> FastAPI -> SQLite -> review_engine -> weekly review."
- Demo flow: "`sample_week.json -> review_engine -> review output`."
- Next sprint: "Replace in-memory sample data with SQLite-backed records and stored reviews."

Keep the technical section short. The main message is that the MVP architecture is stable, the first review path is demonstrable, and the next sprint has a concrete backend implementation path.

## 5. Final Review Checklist

Before presentation, confirm:

- Slides say Sprint 0 is complete.
- Slides say Sprint 1 starts next.
- Slides do not claim SQLite persistence is already implemented.
- Demo language matches the actual command: `python3 scripts/run_sample_review.py`.
- Project Board shows both code tasks and course-deliverable tasks.
- The presentation fits a 5-minute progress update.
