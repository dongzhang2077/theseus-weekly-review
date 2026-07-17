# Midterm Demo Runbook

Checkpoint: 2026-07-15

Demo date: 2026-07-18

Primary owner: Zhi Kang
Integration and review owners: both teammates

## 1. Demo Goal

In five minutes, show that one local user can retain evidence-backed weekly
review data, inspect the most important signal, and approve a reversible
next-week plan adjustment. The path must work without an external model key.

Dependencies:

- local-user ownership and restart persistence;
- deterministic review evidence and the local supportive template;
- Review, Signals, Focus, and Plan app surfaces;
- sanitized sample data under `data/sample/`.

Demo evidence:

```text
Local profile -> persisted review -> inspectable signal
-> before/after Plan diff -> Apply -> reload -> Undo
```

## 2. Prepare a Clean Demo Database

From the repository root, run:

```bash
.venv/bin/python scripts/prepare_midterm_demo.py
```

The command creates a new SQLite file under `/tmp`, creates one `Theseus Demo`
profile, imports the sanitized sample week, and stores supportive wording with
`template-supportive-v1`. It does not read an `.env`, require a provider key, or
load a personal database.

Copy the printed `database` and `user_id` values. Start the backend in terminal
A, replacing the example database path:

```bash
THESEUS_DB_PATH=/tmp/theseus-midterm-demo-EXAMPLE.db \
  .venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Start the frontend in terminal B:

```bash
VITE_THESEUS_API_BASE_URL=http://127.0.0.1:8000 \
  npm --prefix frontend/app run dev
```

Open `http://127.0.0.1:5173`. Leave `THESEUS_REVIEW_WRITER`,
`OPENAI_API_KEY`, and `OPENCODE_GO_API_KEY` unset for the primary demo.

## 3. Two-Minute Preflight

Use the `user_id` printed by the preparation command:

```bash
curl -s http://127.0.0.1:8000/health
curl -s http://127.0.0.1:8000/users
curl -s -X POST http://127.0.0.1:8000/reviews/weekly/generate \
  -H 'Content-Type: application/json' \
  -H 'X-Theseus-User-Id: 1' \
  -d '{"week_start":"2026-06-08","week_end":"2026-06-14","mode":"supportive_text"}'
```

Pass conditions:

- health returns `status: ok`;
- `Theseus Demo` is listed;
- the review returns `model_name: template-supportive-v1`;
- the browser opens the local-profile chooser without console-visible failure;
- selecting `Theseus Demo` loads Review without a `Sample data` badge.

## 4. Rehearsed Five-Minute Flow

| Time | Action | Claim supported |
|---|---|---|
| 0:00-0:25 | State the problem: weekly evidence exists, but turning it into one realistic adjustment is still manual. | Narrow product scope. |
| 0:25-0:55 | On Local profile, create `Rehearsal User`; show its honest no-review state, then switch to `Theseus Demo`. | Local user creation, isolation, and explicit ownership. |
| 0:55-1:45 | On Review, show the week, the win-first summary, the attention state, and one evidence detail. | Evidence first; supportive wording second. |
| 1:45-2:30 | Open Signals; inspect the dormant priority signal and its matching evidence. | Severity is evidence-derived, not decorative. |
| 2:30-3:45 | Open Plan from the recommendation; show week balance and the project/planned/slack before-and-after diff, then Apply. | One bounded, user-approved next-week adjustment. |
| 3:45-4:20 | Reload, return to Plan, and show that the target plan remains. Use Undo and show the restored state. | SQLite persistence, restart continuity, and reversibility. |
| 4:20-5:00 | Return to Review and state the limitations and gated agent roadmap. | Truthful architecture and feasible next phase. |

Do not spend demo time on broad Goal/Project CRUD, provider configuration,
LangGraph, OpenClaw, or model-training claims.

## 5. Failure and Recording Plan

### Provider failure

If a configured external writer fails, `/reviews/weekly/generate` returns 502
for `supportive_text`. The frontend retries `deterministic_first` and visibly
labels the result `Rule-based review`. Continue with the same evidence and Plan
flow; do not hide the fallback.

### Backend failure

Restart terminal A. If local recovery would take too long, start the frontend
without `VITE_THESEUS_API_BASE_URL` and use the sanitized `Sample data` path.
State clearly that this is the visual fallback, not persistence proof.

### Fallback recording checklist

- record at 1920x1080 or the native presentation resolution;
- capture the local-profile chooser, Review, Signals, Plan diff, Apply, reload,
  and Undo;
- keep the browser address bar or a short opening slate visible so the local
  app source is clear;
- stop notifications and hide terminals containing environment values;
- target 4:30-5:00 and verify audio before the course checkpoint;
- store the recording outside Git if it contains presenter or machine details.

The actual recording remains a human-operated delivery gate.

## 6. Screenshot Evidence

All committed screenshots use the sanitized, explicit `Sample data` mode.

| Surface | Mobile | Desktop composition |
|---|---|---|
| Review | [review-mobile.png](demo/screenshots/review-mobile.png) | [review-desktop.png](demo/screenshots/review-desktop.png) |
| Signals | [signals-mobile.png](demo/screenshots/signals-mobile.png) | Mobile is the primary surface. |
| Focus | [track-mobile.png](demo/screenshots/track-mobile.png) | Mobile is the primary surface; `track` remains the internal module name. |
| Plan | [plan-mobile.png](demo/screenshots/plan-mobile.png) | [plan-desktop.png](demo/screenshots/plan-desktop.png) |

Visual review was repeated on 2026-07-17 after the Focus and Plan Tailwind
recovery. The refreshed 500x932 mobile and 1440x1000 desktop evidence has no
horizontal clipping, overlapping utility badges, emoji, missing accessible
labels, or cross-screen style break. A 500x844 short-viewport check also keeps
all three Plan actions visible. Focus and Plan use the same warm paper surface,
restrained borders, semantic colors, and icon-plus-label navigation.

## 7. Known Limitations

- `X-Theseus-User-Id` is a local ownership scope, not authentication.
- The rehearsed fixture uses June 8-14 evidence so every run is deterministic.
- Calendar automation, cloud sync, wearable integration, LangGraph, OpenClaw,
  and learned personalization are outside this checkpoint.
- External writers change wording only; deterministic evidence remains the
  source of truth.
- Review feedback collection is documented but does not yet have a persisted
  API/UI implementation.
- `global.css` remains as compatibility styling for screens not yet migrated.
  STORY-029 adds no new Focus or Plan selectors there; removal is deferred until
  each remaining consumer has screenshot and interaction coverage.
- `npm audit --omit=dev` reports zero production vulnerabilities. The legacy
  Vite 5/esbuild development toolchain reports five development-only findings;
  the automated fix requires a breaking Vite 8 upgrade, so that upgrade is
  deferred until after the demo and the dev server remains bound to
  `127.0.0.1`.
- GitHub Issue #63 is completed, PR #64 is squash-merged to `main` as
  `306061c`, and the project board is `Done`.

## 8. Review and Release Gates

Engineering review on 2026-07-15:

- API contract: no blocking implementation finding after correcting the
  generate-request example;
- SQLite persistence: no blocking finding; foreign keys, atomic Plan replace,
  user isolation, sample import, and restart persistence are covered;
- UX: no blocking first-level layout finding in the captured surfaces;
- review engine: fixed an inconsistency where unlinked planned items were
  omitted from total planned time and slack evidence.

Release status:

- PR #64 was squash-merged to `main` as `306061c` on 2026-07-15 PDT;
- the project owner explicitly approved direct merge and waived the separate
  teammate-review gate for this checkpoint;
- Issue #63 is closed as completed and its project-board status is `Done`.

Still requires human completion:

- one live five-minute rehearsal and one fallback recording are completed.

Full verification commands:

```bash
.venv/bin/python scripts/run_sample_review.py
.venv/bin/python -m compileall backend review_engine scripts
.venv/bin/python -m pytest -q
npm --prefix frontend/app test
npm --prefix frontend/app run build
git diff --check
```
