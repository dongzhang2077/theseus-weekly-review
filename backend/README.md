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
- CRUD endpoints for goals, projects, weekly plans, and time logs

The first implementation can run the review engine directly from a JSON payload before the database layer is finished.

## Local Development

From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload
```

