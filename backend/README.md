# Backend

The backend is responsible for validation, persistence, and review orchestration.

## Planned Stack

- FastAPI
- Pydantic
- SQLite
- Review engine imported from `review_engine`

## MVP Endpoints

- `GET /health`
- `POST /reviews/weekly/analyze`
- `POST /reviews/weekly/generate`
- CRUD endpoints for goals, projects, weekly plans, and time logs

The first implementation can run the review engine directly from a JSON payload before the database layer is finished.

## Local Development

From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements-dev.txt
uvicorn backend.app.main:app --reload
```

The default local database is `data/local/theseus.db`. Override it with `THESEUS_DB_PATH`.
The local frontend demo origin is allowed by default. Override browser origins with
`THESEUS_CORS_ORIGINS`, using a comma-separated list.

Generate a review from an initialized and populated database with:

```bash
python3 scripts/run_persisted_review.py \
  --database data/local/theseus.db \
  --week-start 2026-06-08 \
  --week-end 2026-06-14
```
