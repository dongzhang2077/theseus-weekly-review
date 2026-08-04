# Final Defense Demo Runbook

## Freeze Point And Demo Data

The accepted STORY-043 checkpoint remains tag `story043-accepted`. The final
course-delivery snapshot, including defense polish and regression fixes, is tag
`course-final-2026-08-03` on `release/final-defense-candidate`. Keep that tag
immutable; continued development should start from a fork or a new branch.

`data/sample/college_student_month.json` is a deterministic, sanitized persona:
a college student balancing a summer course, research paper, part-time cafe
work, and health routines. It contains no real personal records, credentials,
institution names, or local databases.

Verify the fixture:

```bash
python3 scripts/generate_final_defense_fixture.py --check
```

Prepare a disposable database and stored review:

```bash
.venv/bin/python scripts/prepare_midterm_demo.py \
  --database /tmp/theseus-final-defense.db \
  --sample data/sample/college_student_month.json \
  --user-name "Final Defense Student" \
  --login-email final-defense@example.com
```

The command prints the credentials-file path, never the password. Neither the
database nor credentials file belongs in Git or the submission ZIP.

For Telegram/OpenClaw, first back up the ignored local database, then load the
fixture into the user that owns the active pairing:

```bash
.venv/bin/python scripts/load_sample_data.py \
  --database data/local/theseus.db \
  --user-id USER_ID \
  --sample data/sample/college_student_month.json

.venv/bin/python scripts/run_persisted_review.py \
  --database data/local/theseus.db \
  --user-id USER_ID \
  --week-start 2026-07-27 \
  --week-end 2026-08-02
```

The importer is transactional and idempotent. It replaces the selected user's
TimeLogs only inside the fixture range, plus matching fixture-owned records.

## Startup And Preflight

Terminal 1:

```bash
THESEUS_DB_PATH=data/local/theseus.db \
  .venv/bin/python -m uvicorn backend.app.main:app \
    --host 127.0.0.1 --port 8000
```

Terminal 2:

```bash
VITE_THESEUS_API_BASE_URL=http://127.0.0.1:8000 \
  npm --prefix frontend/app run dev -- --host 127.0.0.1
```

Before presenting:

1. Confirm `/health`, login, and default Today.
2. Confirm Day, Week, and July Month show persisted records.
3. Open a donut segment, week day, and heatmap day; confirm exact evidence.
4. Confirm Insights has the July 27–August 2 stored review.
5. Confirm Plan has four ordinary-life items.
6. Send a harmless Telegram context question for the paired account.
7. Disable notifications and keep representative screenshots ready.

## Twelve-Minute Flow

### 0:00–1:00 — Overview

Theseus is a local-first weekly review and planning assistant. It turns
persisted time, plan, and reflection evidence into understandable patterns and
bounded next actions. Cloud AI receives only minimal context when the user
initiates an assistant conversation.

### 1:00–2:00 — Features

Introduce Today, Insights, and Plan; evidence drawers; durable Focus/TimeLog
records; deterministic review; and reversible assistant actions.

### 2:00–6:00 — App Demo

1. Today / Day: current focus and ordinary daily records.
2. Today / Week: variation across class, shifts, recovery, and study.
3. Today / Month: low, medium, and high intensity; open an exact day.
4. Project donut: course, research, job, and routine distribution.
5. Tracker: fast capture remains available.
6. Insights: connect a signal to persisted evidence.
7. Plan: show the full-life weekly plan.

### 6:00–10:00 — Telegram/OpenClaw Demo

Use short prompts and wait for each response:

1. `What should I focus on next, and why?`
2. `Summarize my recorded time this week using Theseus evidence.`
3. `Draft a plan adjustment for next week. Do not execute it.`
4. Inspect and approve the proposal in Theseus, then ask Telegram to execute.
5. Refresh Plan to show persistence; demonstrate Undo only if time permits.

State the boundary: Telegram can query context and invoke the scoped
proposal/decision/execute/undo workflow. It cannot make arbitrary silent
changes.

### 10:00–12:00 — Challenges And Solutions

- Evidence trust: chart selections retain exact TimeLog IDs; external writes
  require a trusted inbound message reference and scoped pairing.
- Reliable actions: proposal, decision, execution, verification, and Undo are
  separate persisted records, so retries and failures remain inspectable.

Close with local-first privacy and the deferred roadmap: UI polish, app-native
text assistant, opt-in voice, onboarding, then calendar read integration.

## Teammate UI Feedback

Ask reviewers to use 390×844 and their normal phone width, and report the
screen, device/browser, exact steps, screenshot, and whether it blocks the
demo. Specifically check:

- Day/Week/Month legibility and evidence correctness;
- long-name wrapping and touch targets;
- Tracker Start/End clarity and running-activity visibility;
- Insights stale/error clarity;
- Plan proposal/conflict/verified/Undo clarity;
- copy that could become a chart, icon, or shorter label.

Do not share tokens, credentials, databases, or real personal data. Put
accepted feedback in a separate scoped issue; avoid broad last-minute rewrites.

## Fallbacks

- If Telegram/model access fails, use screenshots and explain the persisted
  proposal ledger.
- If the frontend cannot reach the API, verify port 8000 and the Vite API URL.
- If hot reload is stale on `/mnt/d`, restart Vite and hard refresh.
- Never change databases or regenerate credentials during the presentation.
