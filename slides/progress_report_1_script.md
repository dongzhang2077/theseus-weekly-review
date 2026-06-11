# Progress Report 1 Speaker Script

Target length: 5 minutes.

## Slide 1: Title

Today we are presenting Progress Report 1 for Theseus, our weekly AI review system for goal-time alignment.

The main update is that we have moved from the submitted proposal into an implementation-ready MVP plan. We also have a small rule-based demo that can analyze a sample week and return structured review output.

## Slide 2: Current Status

Sprint 0 is complete.

The proposal was submitted on June 9, 2026. After that, we refined the project into a narrower MVP. Theseus is not trying to replace a calendar, task manager, or full productivity system. It focuses on one missing layer: the weekly review between what a person planned and where their time actually went.

During Sprint 0, we documented the product requirements, architecture, data model, API contract, review engine design, backlog, and delivery plan. We also created a repeatable sample week and a local demo command.

Sprint 1 starts next. The goal of Sprint 1 is backend persistence: SQLite schema, repository layer, CRUD APIs, sample data loader, and a stored weekly review path.

## Slide 3: Scoped MVP

The MVP has a simple workflow.

The user gives Theseus goals, projects, a weekly plan, actual time logs, activity energy labels, and optional daily reflections. The system analyzes those records for goal-time alignment, plan-vs-actual drift, activity energy mix, dormancy risk, and slack risk.

The output is a supportive weekly review with wins, insights, risk flags, evidence, and a limited set of realistic next steps.

This scope keeps the project feasible for the course timeline. We are not building automatic calendar rewriting, wearable integration, autonomous planning, or mental health diagnosis.

## Slide 4: Architecture

The architecture is designed around evidence before advice.

The frontend collects goals, plans, logs, and review display input. The FastAPI backend validates data, handles persistence, and orchestrates review generation. SQLite stores the MVP records. The review engine runs deterministic checks first. The evaluation layer uses sample weeks, a review rubric, and feedback to judge whether the review is factual, useful, and restrained.

The important design choice is that the review engine remains independent from FastAPI route handlers. That means the same logic can serve command-line demos, backend API calls, evaluation scripts, and later AI wording.

## Slide 5: Implemented Demo

The current implemented demo path is sample data into the review engine.

The command is:

```bash
python3 scripts/run_sample_review.py
```

That script loads `data/sample/sample_week.json`, passes it into `review_engine.rules.analyze_week`, and prints a structured JSON review.

This is not the final backend path yet. It does not store records in SQLite. It proves the analysis logic using repeatable sample data.

## Slide 6: Demo Output

The sample review output includes wins, insights, risk flags, next steps, evidence, and generated text.

For example, the sample week detects a win that Theseus backend received 4 hours. It also shows that the Build Theseus MVP goal received 5 hours of goal-linked work. It flags that internship preparation received 0 goal-linked minutes, and it recommends protecting one small restart block.

This is the behavior we want from Theseus: it recognizes progress, uses evidence, and gives a restrained next step instead of broad motivational advice.

## Slide 7: Project Board View

The GitHub Project board is being used to track both engineering tasks and course deliverables.

The completed Sprint 0 tasks include repository setup, architecture documentation, the data model, API contract, and the first review engine demo.

The open presentation tasks are this slide deck, the speaker script, and architecture or roadmap visuals.

The next sprint tasks are implementation-focused: SQLite schema, repository layer, CRUD APIs, sample data loader, and a persisted weekly review path.

## Slide 8: Roadmap

The roadmap is staged so the project remains feasible.

Sprint 0 established scope and architecture. Sprint 1 connects the sample review path to SQLite and FastAPI persistence. Sprint 2 hardens the rule-based review output and adds more sample weeks. Sprint 3 builds the frontend input and review result pages. After that, we can add AI wording, evaluation, and demo polish for the midterm checkpoint.

The key point is that deterministic checks come before the LLM layer. We want AI to help with wording after the evidence package is prepared, not invent analysis from raw data.

## Slide 9: Closing

The main message for Progress Report 1 is that the project is now implementation-ready.

Sprint 0 is complete, the MVP scope is stable, the architecture is documented, and the sample review demo works. Sprint 1 starts with backend persistence, so the next milestone is moving from `sample_week.json -> review_engine` to `sample_week.json -> SQLite -> review_engine -> stored weekly_review`.

That gives us a concrete path from planning to a working midterm prototype.
