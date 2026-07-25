# Theseus Progress Report 2 Speaker Script

Target length: about 5 minutes, including a short live demo.

Presentation date: July 18, 2026

## Before presenting: version boundary

The visual demo shown in this deck comes from the teammate UI branch
`feature/ui-product-update-2026-07-16`. It demonstrates the local-profile,
Review, Signals, Focus, and Plan interaction flow.

The current `main` branch has since added formal local registration, JWT
sessions, and user-data isolation. Cloud authentication, cloud backup, and
multi-device synchronization are still outside the MVP. Do not describe the
teammate branch's disabled Login and Sync controls as working cloud features.

## Slide 1 — Title

Good morning. We are Team Zisyphuz: Dong Zhang and Zhi Kang.

Theseus is a local-first weekly review application. It compares goals and plans
with actual time, explains the most important gap, and turns that evidence into
one realistic action. Our principle is evidence first, supportive advice
second.

## Slide 2 — Project update

Since Progress Report 1, we have moved from architecture to a working MVP. It
now has local persistence, evidence-backed Review, actionable Signals, Focus
recording, and a reversible Plan workflow. Sprint 5 engineering is complete;
live rehearsal, final QA, and reporting are active. The completed loop is local
data, evidence, action, persistence, and Undo.

## Slide 3 — Sprint timeline

The formal milestone dates have not changed. Sprints 0 to 3 delivered the
foundation, SQLite APIs, deterministic review engine, and React frontend.
Sprints 4 and 5 connected evidence, supportive wording, ownership, and the
user flow. We deliberately deferred cloud sync and autonomous agents so we
could verify one trustworthy loop. Final evaluation and reporting are next.

## Slide 4 — Techniques learned and applied

We applied four layers: FastAPI and SQLite for typed APIs and persistence; a
framework-independent engine for alignment, drift, dormancy, energy, and risk;
React and TypeScript for the mobile interface; and automated Python and
frontend tests for verification. This checkpoint recorded 91 Python tests and
automated frontend coverage; the later authentication work added further
backend coverage on `main`. AI supported planning, design, coding, and review,
while the team verified the claims, screenshots, and results.

## Slide 5 — Local ownership

This is the local-first starting point: users can begin on one device and keep
their review data locally. Today's visual demo uses our stable local-profile
flow. The integration branch has since added formal local registration, JWT
sessions, and data isolation. Cloud backup and synchronization are not
implemented. Keeping that boundary clear was one of our main product
challenges.

## Slide 6 — Review evidence

Review answers: what mattered this week? It separates wins from risks, and each
detail shows planned and logged values, the affected project, and source data.
This protects trust: deterministic evidence remains the source of truth, while
AI may only improve the wording of already-computed findings.

## Slide 7 — Signals

Signals turns a finding into an action. Here, a dormant restart project is the
priority, with its reason, severity, evidence, and recovery action. This
replaced an earlier decorative dashboard. The goal is not more status cards;
it is a short path from understanding a problem to acting on it.

## Slide 8 — Plan and Focus action loop

Plan shows capacity, planned time, slack, and one suggested adjustment. The
user can apply, reload, and undo the change, or send a block directly to Focus.
Focus records duration, result, and an optional note as evidence for the next
review. A key challenge was moving timer state above the screen so navigation
would not reset an active session.

## Slide 9 — Live demo

Now we will show the working MVP:

1. Open Review and inspect one evidence-backed Risk.
2. In Signals, show its reason and recovery action.
3. In Focus, show the selected activity and timer.
4. In Plan, show capacity, slack, and the suggested adjustment.
5. Apply, reload, and Undo if time allows.

During the demo, say:

> This is the complete course-MVP loop: local evidence becomes an explainable
> review, the review becomes a bounded action, and the action remains
> persistent and reversible.

If the live backend is unavailable, use the sanitized sample mode and state
that clearly. Do not spend demo time on disabled cloud login, model-provider
configuration, LangGraph, or OpenClaw.

## Slide 10 — Closing

Theseus has moved from architecture to a working local-first review product.
Its strongest result is the complete loop from evidence to a reversible action.
Next, we will evaluate it with users, improve plan-versus-actual comparison and
evidence correction, and finish the report. Agent automation remains future
work after the data and approval contracts are stable.

Thank you. We are happy to answer questions.

## Short answers for likely questions

### Is this a full AI life assistant already?

No. The current product is an evidence-backed weekly-review MVP. Agent
orchestration and external execution are future work behind explicit approval,
audit, verification, and Undo gates.

### What does AI do today?

The deterministic engine calculates the facts. An optional AI writer can make
the review language more supportive, but it cannot change the evidence.

### Is user data in the cloud?

No. The demonstrated system is local-first. Formal local registration and JWT
isolation exist on the integration branch, but cloud backup and synchronization
are not implemented.

### What was the hardest implementation problem?

The hardest part was connecting multiple screens into one reliable data loop:
user ownership, timer continuity, evidence provenance, contextual planning,
persistence, and reversible changes.

### What is next before the final presentation?

We will run user evaluation, improve plan-versus-actual comparison and evidence
correction, rehearse the complete persisted demo, and finish the final report
and AI-usage appendix.
