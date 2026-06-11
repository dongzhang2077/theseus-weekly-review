# Product Requirements Document

## 1. Product Summary

Theseus is a weekly execution review system. It helps users compare what they planned, what they actually did, and whether their time supported their long-term goals.

## 2. Target Users

Primary users:

- Students with academic deadlines and personal goals
- Early-career workers managing learning, job search, and side projects
- Users who already track or can manually enter time logs

These users often need clarity more than a stricter schedule. The product should help them make one realistic adjustment, not create a larger task burden.

## 3. User Problems

| Problem | Product Response |
|---|---|
| The user planned important work but spent time elsewhere. | Compare planned work with actual logs. |
| A long-term goal received no meaningful time. | Detect dormancy risk. |
| Admin and small tasks expanded unexpectedly. | Show displacement and plan-vs-actual drift. |
| Recovery work is ignored by normal productivity tools. | Recognize useful `restore` activities. |
| Feedback can feel discouraging. | Use positive and constructive review language. |

## 4. Core User Stories

### US-01 Goal Setup

As a user, I want to enter up to three active long-term goals so that the review can judge whether my week supported my priorities.

Acceptance criteria:

- A goal has a title, description, priority, and active status.
- The system can list active goals.
- A project can link to a goal.

### US-02 Weekly Plan

As a user, I want to create a weekly plan with planned tasks and target hours so that Theseus can compare intention against reality.

Acceptance criteria:

- A weekly plan has a week start and week end.
- A planned item can link to a project.
- A planned item can include estimated minutes.

### US-03 Time Log

As a user, I want to log actual activities with duration and activity type so that Theseus can analyze my execution.

Acceptance criteria:

- A time log includes date, start time, end time, duration, activity name, and optional project.
- Activity type must be one of `consuming`, `neutral`, `restore`, or `destroy`.
- The user can correct an AI-suggested activity type.

### US-04 Weekly Review

As a user, I want a weekly review that explains what happened and what to adjust next week.

Acceptance criteria:

- The review includes wins, insights, risk flags, and next steps.
- Each major claim is backed by time-log or plan evidence.
- The review avoids blaming language.
- The next steps are limited and realistic.

### US-05 Evaluation

As a project team, we want to evaluate generated reviews so that we can report MVP quality in the final defense.

Acceptance criteria:

- Each sample review is rated using the rubric.
- The team records factual accuracy, usefulness, positivity, realism, and slack protection.
- 2-3 classmates provide limited feedback.

## 5. Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | Create, list, and update goals | P0 |
| FR-02 | Create, list, and update projects | P0 |
| FR-03 | Create a weekly plan | P0 |
| FR-04 | Create time logs | P0 |
| FR-05 | Label activities by energy-impact type | P0 |
| FR-06 | Run deterministic weekly analysis | P0 |
| FR-07 | Generate weekly review output | P0 |
| FR-08 | Store weekly review results | P1 |
| FR-09 | Show a simple dashboard | P1 |
| FR-10 | Collect user feedback on review quality | P1 |
| FR-11 | AI-suggest activity labels | P2 |
| FR-12 | Conversational extension through OpenClaw | P3 |

## 6. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Explainability | Review claims must be traceable to input evidence. |
| Safety | The system must not provide mental health diagnosis. |
| Privacy | MVP should be local-first with SQLite. |
| Maintainability | Review checks should be separated from API and UI code. |
| Portability | Schema should be compatible with future PostgreSQL migration. |
| Usability | The user should enter a weekly log without complex setup. |

## 7. Out of Scope

- Automatic calendar rewriting
- Wearable integration
- Full multi-user account system
- Production-grade authentication
- Complete mobile app
- Long-term behavior-change proof

