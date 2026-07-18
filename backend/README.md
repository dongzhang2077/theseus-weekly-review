# Backend

The backend is responsible for validation, persistence, and review orchestration.

## Planned Stack

- FastAPI
- Pydantic
- SQLite
- Review engine imported from `review_engine`

## MVP Endpoints

- `GET /health`
- account registration, login, refresh, profile/password/email
  management, logout, and deletion under `/auth`
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

Personal endpoints require the short-lived Bearer access JWT returned by
`/auth/register`, `/auth/login`, or `/auth/refresh`. The refresh JWT is a
rotating HttpOnly cookie and refresh also requires the matching
`X-CSRF-Token`. When `THESEUS_JWT_SECRET` is not set, the backend generates a
permission-restricted key beside the SQLite database; both are Git-ignored.
`THESEUS_COOKIE_SECURE=true` is required when serving the app over HTTPS.

`supportive_text` review generation uses the local evidence-bound writer by
default. To use the OpenAI Responses API adapter, set:

```bash
export THESEUS_REVIEW_WRITER=openai
export OPENAI_API_KEY=your_api_key
export THESEUS_OPENAI_MODEL=gpt-5.5  # Optional.
```

Do not commit API keys or `.env` files.

OpenCode Go is also supported through its OpenAI-compatible Chat Completions
endpoint:

```bash
export THESEUS_REVIEW_WRITER=opencode_go
export OPENCODE_GO_API_KEY=your_api_key
export OPENCODE_GO_MODEL=deepseek-v4-pro  # Optional.
```

Override `OPENCODE_GO_ENDPOINT` only when testing against another compatible
endpoint.

Generate a review from an initialized and populated database with:

```bash
python3 scripts/run_persisted_review.py \
  --database data/local/theseus.db \
  --user-id 1 \
  --week-start 2026-06-08 \
  --week-end 2026-06-14
```

After configuring a provider, append `--mode supportive_text` to use it. The
result should preserve the deterministic evidence fields and store the selected
provider in `model_name`.
