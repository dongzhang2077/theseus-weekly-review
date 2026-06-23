# Sprint 3 Demo QA Note

## Demo Scope

Sample week:

```text
Jun 8 - Jun 14, 2026
```

Local frontend:

```text
http://127.0.0.1:5173
```

Local backend:

```text
http://127.0.0.1:8000
```

Demo screens:

- Review dashboard
- Plan vs log workspace
- Goals and projects setup
- Settings connection panel

## QA Checklist

- Desktop and mobile layouts use the same app shell and navigation structure.
- Tables collapse to compact row cards at phone width where dense columns would overflow.
- Main demo surfaces include loading, empty, error, success, or fixture fallback states.
- Buttons remain icon-first with accessible labels and titles.
- UI files were scanned for emoji.
- Sample review generation still works against the FastAPI backend.
- Goal create/list and project create/list were verified against the FastAPI backend.

## Verification Commands

```bash
node --check frontend/api.js
node --check frontend/app.js
GIT_CONFIG_GLOBAL=/dev/null git diff --check
PYTHONPATH=/home/dong/.cache/theseus-test-deps PYTHONDONTWRITEBYTECODE=1 python3 scripts/run_sample_review.py
PYTHONPATH=/home/dong/.cache/theseus-test-deps PYTHONDONTWRITEBYTECODE=1 python3 -m pytest -p no:cacheprovider -q tests/api/test_reviews.py tests/services/test_review_service.py
```

HTTP smoke checks:

```bash
curl -I http://127.0.0.1:5173/
curl -I http://127.0.0.1:5173/app.js
curl -I http://127.0.0.1:5173/styles.css
curl -s http://127.0.0.1:8000/health
curl -s -X POST http://127.0.0.1:8000/reviews/weekly/generate -H 'Content-Type: application/json' -d '{"week_start":"2026-06-08","week_end":"2026-06-14","mode":"deterministic_first"}'
```

Goal/project API checks:

```bash
curl -s -X POST http://127.0.0.1:8000/goals -H 'Content-Type: application/json' -d '{"title":"Demo review habit","description":"Track whether weekly review stays visible.","priority":2,"active_status":true}'
curl -s -X POST http://127.0.0.1:8000/projects -H 'Content-Type: application/json' -d '{"goal_id":1,"title":"Demo project setup","stage":"sprint","status":"active","weekly_target_minutes":120,"weekly_min_minutes":0}'
curl -s http://127.0.0.1:8000/goals
curl -s http://127.0.0.1:8000/projects
```

## Screenshot Status

Desktop and mobile screenshots still need manual capture. The current execution
environment does not provide Chromium, Chrome, or Playwright, so automated
screenshot capture was not available during this pass.
