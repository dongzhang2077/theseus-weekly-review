# Progress Report 1

Date: 2026-06-13

Recommended length: 5 minutes

## 1. Current Status

The written proposal was submitted on 2026-06-09. After submission, the team refined the implementation direction and narrowed the project into a concrete MVP.

Theseus is now defined as a weekly AI review layer. It does not replace calendars, task managers, or time trackers. It compares goals, weekly plans, actual time logs, and activity energy-impact labels, then generates a supportive weekly review.

## 2. Scope Refinement

Pre-proposal exploration included a broader personal productivity concept. For the course project, the team narrowed the scope to the proposal baseline:

- Goal-time alignment
- Plan-vs-actual review
- Activity energy-impact labels
- Dormancy and overload detection
- Positive weekly review
- Realistic next-week adjustment

This keeps the project feasible for the July and August course deadlines.

## 3. Prior Design References

The team has prior design references from early exploration:

- time-log data requirements
- SQLite schema ideas
- project lifecycle concepts
- activity energy-impact model
- evidence-first review logic
- mobile capture and sync architecture ideas

The Theseus implementation will be developed in the course repository using these references as design input.

## 4. Architecture Direction

The MVP architecture has five layers:

1. Frontend for goals, plans, logs, and review display.
2. FastAPI backend for validation and orchestration.
3. SQLite database for local MVP storage.
4. Review engine for deterministic checks and AI review generation.
5. Evaluation layer for sample weeks and review quality scoring.

## 5. Immediate Next Steps

Before the midterm checkpoint, the team will:

- Build the backend schema and sample data loader.
- Implement deterministic review checks first.
- Add AI generation after evidence checks are stable.
- Build frontend input pages and a weekly review page.
- Evaluate output using sample weeks and classmate feedback.

## 6. Demo Message

The key progress message:

> We have moved from proposal to implementation planning. The MVP is now scoped, the architecture is defined, the team responsibilities are clear, and the next sprint will build the backend data foundation and rule-based weekly review.
