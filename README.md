# Theseus: Weekly AI Review for Goal-Time Alignment

Theseus is a local-first personal planning and weekly review assistant for
students and knowledge workers balancing study, work, projects, and recovery.
It connects plans with persisted time evidence, explains where the week went,
and proposes bounded next actions without silently changing the user's plan.

This repository is the final course-delivery snapshot from Team **Zisyphuz**
(Dong Zhang and Zhi Kang). The reproducible submission is tagged
`course-final-2026-08-03`; continued development should start from a fork or a
new branch instead of changing that tag.

## Final Course Scope

The delivered system includes:

- local accounts with user-scoped SQLite data;
- goals, projects, tasks, weekly plans, Activities, FocusSessions, and TimeLogs;
- a mobile-first React workspace with Today, Insights, and Plan navigation;
- Day project-distribution donut, Week daily bars, and Month activity heatmap;
- a focused time tracker with parallel running Activities and correctable
  persisted history;
- deterministic weekly review signals with links back to exact evidence;
- capacity-aware weekly planning and reversible proposal execution;
- a bounded Assistant gateway and deterministic “what should I do next?” flow;
- an optional OpenClaw adapter used from Telegram for context queries and the
  proposal, approval, execution, and Undo workflow;
- scoped channel pairing, trusted inbound-message references, replay
  protection, explicit approval, and an auditable action ledger.

The course snapshot does **not** include native in-app voice, Google Calendar
sync, cloud synchronization, wearable integration, or autonomous background
changes. Telegram voice transcription and conversational model access belong
to the external Telegram/OpenClaw runtime. LangGraph is not part of the active
application workflow in this snapshot.

## Architecture

```text
React mobile web app ─┐
                      ├─> FastAPI services ─> SQLite repositories
Telegram + OpenClaw ──┘          │
                                 ├─> framework-independent review_engine
                                 └─> proposal/action audit trail
```

- The React app and Telegram are interfaces to the same account-scoped API;
  Telegram is not a second database.
- FastAPI handles authentication, validation, and orchestration. Domain rules
  remain outside route handlers, and SQL remains inside repositories.
- SQLite is the course-MVP source of truth. Foreign keys are enabled on every
  connection.
- Core review and next-action decisions remain deterministic. Optional model
  output is bounded by structured evidence and does not receive database
  access.

Detailed references:

- [System architecture](docs/02_system_architecture.md)
- [Data model](docs/03_data_model.md)
- [API contract](docs/04_api_contract.md)
- [Product backlog](docs/07_product_backlog.md)
- [Architectural runway](docs/11_architectural_runway.md)
- [Final defense demo runbook](docs/18_final_defense_demo_runbook.md)

## Repository Layout

```text
backend/                       FastAPI routes, services, SQLite repositories
review_engine/                 framework-independent review rules
frontend/app/                  production React + TypeScript mobile web app
integrations/openclaw-theseus/ native OpenClaw plugin and contract tests
data/sample/                   sanitized deterministic fixtures
evaluation/                    review-quality evaluation assets
scripts/                       setup, import, review, and verification tools
docs/                          product, architecture, contract, and runbooks
slides/                        tracked presentation source material
```

Local databases, credentials, `.env` files, raw personal exports, and
`node_modules` are intentionally excluded from version control and from the
course ZIP. Generated frontend bundles are not versioned; the course ZIP adds
one clean, verified production build under `frontend/app/dist/`.

## Prerequisites

- Python 3.12
- Node.js 22.22.3 or later in the supported OpenClaw ranges
- npm

The React app can run on older supported Node releases, but using Node 22.22.3+
for the whole repository avoids a separate OpenClaw runtime.

## Install

From the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements-dev.txt
npm --prefix frontend/app ci
npm --prefix integrations/openclaw-theseus ci
```

Do not put API keys or pairing tokens in tracked files. If optional providers
are configured, keep their secrets in the backend process environment or a
Git-ignored local `.env`.

## Run the Sanitized Demo

Create a disposable database containing one month of ordinary college-student
data:

```bash
.venv/bin/python scripts/prepare_midterm_demo.py \
  --database /tmp/theseus-final-course.db \
  --sample data/sample/college_student_month.json \
  --user-name "Final Defense Student" \
  --login-email final-defense@example.com
```

The command prints the path to a permission-restricted credentials file; it
does not print the generated password. Keep both that file and the database
outside the submission.

Start the API:

```bash
THESEUS_DB_PATH=/tmp/theseus-final-course.db \
  .venv/bin/python -m uvicorn backend.app.main:app \
    --host 127.0.0.1 --port 8000
```

In a second terminal, start the app:

```bash
VITE_THESEUS_API_BASE_URL=http://127.0.0.1:8000 \
  npm --prefix frontend/app run dev -- --host 127.0.0.1
```

Open <http://127.0.0.1:5173>. The API health endpoint is
<http://127.0.0.1:8000/health>.

When the repository is on a Windows-mounted WSL path such as `/mnt/d`, Vite
can occasionally miss a filesystem event. Restart Vite and hard-refresh the
browser if a verified source change appears stale.

## Verification

Run the backend and domain tests:

```bash
PYTHONDONTWRITEBYTECODE=1 \
  .venv/bin/python -m pytest -p no:cacheprovider -q
```

Run the required sample review and Python compilation check:

```bash
.venv/bin/python scripts/run_sample_review.py
.venv/bin/python -m compileall backend review_engine scripts
```

Run the frontend tests and production build:

```bash
npm --prefix frontend/app test
npm --prefix frontend/app run build
```

Run the OpenClaw plugin tests and secret-free end-to-end workflow:

```bash
npm --prefix integrations/openclaw-theseus test

THESEUS_NODE=/path/to/supported/node \
  .venv/bin/python scripts/run_openclaw_adapter_e2e.py
```

The end-to-end script creates a temporary database and credential, starts a
temporary API, verifies context read, next action, proposal, approval,
execution, and Undo, then removes its temporary state.

## Final Verified Baseline

The course freeze candidate was verified on 2026-08-03 with:

- backend/domain tests: **253 passed**;
- frontend tests: **181 passed**;
- OpenClaw plugin tests: **27 passed**;
- frontend TypeScript check and production build: passed;
- sample review and Python compilation: passed;
- secret-free OpenClaw end-to-end workflow: passed.

Two FastAPI/Starlette deprecation warnings remain in invalid-window validation
tests; they do not change runtime behavior or test results.

## Security and Privacy Boundaries

- Personal records stay in the selected local SQLite database by default.
- Browser access uses short-lived Bearer tokens and rotating HttpOnly refresh
  cookies with CSRF protection.
- OpenClaw receives a scoped integration credential, never browser refresh
  credentials or direct SQLite access.
- External writes require the configured channel and sender, a short-lived
  trusted message reference, the matching scope, and an explicit proposal
  lifecycle.
- Executed plan changes can be verified and undone through persisted records.
- Sample fixtures are synthetic and sanitized; no real personal database or
  raw export belongs in Git or the submission archive.

## Team Responsibilities

| Area | Owner |
|---|---|
| Backend, database, review engine, integration | Dong Zhang |
| Frontend, report layout, dashboard, benchmark material | Zhi Kang |
| Research, evaluation, final report, presentation | Both |

## Course Submission and Continuation

The source submission is `Zisyphuz_Code.zip`, generated from tracked files at
the final tag plus the verified `frontend/app/dist/` production build. It
intentionally excludes Git history, local runtime data, credentials, dependency
directories, and untracked personal presentation files.

For later development:

1. fork the repository or branch from `course-final-2026-08-03`;
2. keep the course tag unchanged as the reproducible baseline;
3. install dependencies locally instead of committing them;
4. continue with app-native assistant/voice, read-only calendar context, and
   optional cloud capabilities only behind explicit privacy controls.
