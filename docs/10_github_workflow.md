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
- Known limitations are noted.

## 5. Issue Labels

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

## 6. Board Columns

Suggested GitHub Project columns:

```text
Backlog -> Ready -> In Progress -> Review -> Done
```

## 7. Initial GitHub Setup Commands

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
