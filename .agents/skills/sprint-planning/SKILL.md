---
name: sprint-planning
description: Turn Theseus backlog and delivery documents into an executable sprint plan with owners, dependencies, acceptance criteria, and verification. Use when planning or replanning a sprint, splitting stories into tasks, assigning work, auditing sprint scope, or preparing GitHub issues and project-board updates.
---

# Sprint Planning

Create a sprint plan that can be executed and demonstrated, not a list of broad intentions.

## Establish Ground Truth

1. Read `docs/06_agile_delivery_plan.md`, `docs/07_product_backlog.md`, and `docs/10_github_workflow.md`.
2. Inspect the current date, branch status, recent commits, and relevant implementation files.
3. Use GitHub MCP, when available, to read open issues, pull requests, and project-board state.
4. Identify discrepancies between planned dates, repository state, and board state. Surface them; do not silently rewrite history.

## Build The Sprint

1. State one measurable sprint goal.
2. Select only stories required for that goal and confirm each is ready.
3. Split stories into tasks that one owner can complete and verify independently.
4. Order tasks by dependency. Lock shared interfaces before parallel implementation.
5. Assign file ownership to minimize merge conflicts.
6. Reserve integration, review, and demo time inside the sprint.

Use this task shape:

```text
Task:
Owner:
Depends on:
Files/modules:
Acceptance criteria:
Verification:
Demo evidence:
```

## Apply Project Constraints

- Keep Sprint 1 focused on SQLite persistence, repositories, sample loading, CRUD APIs, and stored review orchestration.
- Do not add production auth, cloud sync, frontend implementation, or LLM generation unless the sprint goal explicitly requires it.
- Distinguish new sprint work from pre-existing code adapted from an author-owned prototype.
- Never schedule private datasets or local databases as repository deliverables.

## Update GitHub Safely

- Default to reading GitHub state and presenting the proposed changes.
- Create or update issues and project fields only when the user explicitly asks for those write actions.
- Keep issue titles outcome-oriented and include acceptance criteria and verification in the body.

## Report

Return the sprint goal, selected tasks in dependency order, owner workload, critical path, risks, and the exact demo that closes the sprint.
