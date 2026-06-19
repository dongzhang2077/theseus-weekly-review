---
name: api-contract-review
description: Review or implement Theseus FastAPI behavior against the documented API and data model, with findings on route shape, validation, status codes, persistence, and tests. Use when adding or reviewing endpoints, changing Pydantic schemas, debugging API regressions, checking frontend-backend compatibility, or preparing a pull request that affects the HTTP contract.
---

# API Contract Review

Treat `docs/04_api_contract.md` as the intended external contract and executable tests as evidence of actual behavior.

## Gather Evidence

1. Read `docs/04_api_contract.md`, `docs/03_data_model.md`, and the relevant backlog story.
2. Inspect `backend/app/main.py`, `backend/app/schemas.py`, route modules, repositories, and API tests.
3. For changed code, inspect the diff and identify every affected request, response, and error path.
4. Use current FastAPI or Pydantic documentation only when local behavior or version semantics are uncertain.

## Check Each Endpoint

- HTTP method and path match the contract.
- Request fields, defaults, enum values, and nullability match the data model.
- Response shape is explicit and stable rather than an untyped internal row.
- Create endpoints return an appropriate success status and persisted identifier.
- List endpoints return deterministic, documented ordering where it matters.
- Invalid input and missing foreign keys produce controlled 4xx responses.
- Routes delegate SQL to repositories and review logic to services or `review_engine`.
- OpenAPI output does not expose misleading or incomplete schemas.

## Verify Behavior

Exercise success and failure cases with focused tests. For persistence-backed routes, use a temporary database and prove that a subsequent read returns the stored representation.

For weekly review generation, verify:

```text
week selector -> persisted context -> review_engine -> stored weekly_review -> API response
```

Run `python3 scripts/run_sample_review.py` after changes that can affect review semantics.

## Report Or Fix

For a review request, lead with findings ordered by severity and include file/line references, impact, and missing tests. State clearly when no issue is found.

For an implementation request, make the smallest contract-consistent change, update tests, and update `docs/04_api_contract.md` only when the accepted public behavior changes.
