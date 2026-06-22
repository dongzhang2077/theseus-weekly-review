# GitHub Workflow

## 1. Repository Strategy

This repository should become the single source of truth for implementation work.

Recommended remote name:

```text
theseus-weekly-review
```

Recommended default branch:

```text
main
```

## 2. Branch Naming

Use short branches tied to issues:

```text
feature/003-sqlite-schema
feature/006-alignment-check
feature/014-review-page
docs/progress-report-1
fix/review-duration-bug
```

## 3. Commit Style

Use clear commits:

```text
docs: define mvp architecture
feat: add weekly plan schema
feat: implement goal-time alignment check
test: add sample overloaded week
fix: correct slack risk calculation
```

## 4. Pull Request Checklist

Before merging:

- The PR has a clear purpose.
- The issue or story is linked.
- Acceptance criteria are met.
- Sample data still works.
- Documentation is updated if behavior changed.
- A relevant skill review was run and summarized in the PR.
- Known limitations are noted.

## 5. Review Gate

Every PR should include one focused review pass before merge. Choose the review
surface based on what changed, then record findings and verification commands in
the PR.

Use these default review routes:

- API, schemas, endpoints, or frontend-backend compatibility: `api-contract-review`.
- Persistence, repositories, SQLite schema, sample loading, or stored reviews: `sqlite-persistence`.
- Sprint scope, issue split, project board, or delivery plan changes: `sprint-planning`.
- Frontend UI, UX flow, copy, controls, responsive behavior, or visual polish: `theseus-ux-standards`.
- Review-engine-only changes with no API behavior change: run focused review-engine tests and summarize evidence contract impact.

Review output should include:

- Blocking findings, or a clear statement that none were found.
- Non-blocking follow-up notes.
- Commands run and their results.
- Any remaining risk or skipped verification.

For frontend PRs, also include desktop and mobile screenshots or a written note
explaining why screenshots were not applicable. Check that the UI has no emoji,
uses icon-first controls, avoids visible button text by default, and follows
`docs/design/style-reference.md` when that file exists.

## 6. Issue Labels

Recommended labels:

- `type:story`
- `type:task`
- `type:bug`
- `type:docs`
- `area:backend`
- `area:frontend`
- `area:review-engine`
- `area:evaluation`
- `priority:p0`
- `priority:p1`
- `priority:p2`

## 7. Board Columns

Suggested GitHub Project columns:

```text
Backlog -> Ready -> In Progress -> Review -> Done
```

Project board:

```text
https://github.com/users/dongzhang2077/projects/3
```

The project includes a `Workflow Status` single-select field with:

```text
Backlog
Ready
In Progress
Review
Done
```

GitHub Projects may open in table view by default. In the web UI, create or switch to a Board view and group by `Workflow Status` to see these as workflow columns.

## 8. Initial GitHub Setup Commands

If Git reports dubious ownership on the Windows-mounted workspace, add this once:

```bash
git config --global --add safe.directory /mnt/d/DouglasLearning/6-AppliedResearchProject/theseus-weekly-review
```

Run these after creating the remote repository on GitHub:

```bash
git remote add origin https://github.com/<owner>/theseus-weekly-review.git
git branch -M main
git add .
git commit -m "chore: initialize theseus project workspace"
git push -u origin main
```

Do not commit API keys, local databases, raw private data, or `.env` files.
