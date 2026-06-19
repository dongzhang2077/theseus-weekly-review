---
name: sqlite-persistence
description: Implement and verify the Theseus SQLite persistence path, including schema, connections, repositories, sample loading, review orchestration, and persistence tests. Use for Sprint 1 database work, repository changes, JSON-to-SQLite loading, stored weekly reviews, database debugging, or reviews of persistence-related pull requests.
---

# SQLite Persistence

Build the persisted review path while preserving the existing framework-independent review engine.

## Read The Contract

Read these files before editing:

- `docs/03_data_model.md`
- `docs/04_api_contract.md`
- `docs/07_product_backlog.md` stories 003-005
- `docs/11_architectural_runway.md`
- `backend/app/schemas.py`
- `review_engine/rules.py`
- `data/sample/sample_week.json`

## Implement In Layers

1. Compare the requested behavior with the documented entities and current Pydantic schemas.
2. Add or update SQLite schema and connection management under `backend/app/db/`.
3. Enable `PRAGMA foreign_keys = ON` for every connection. Use constraints and indexes that enforce documented invariants.
4. Put parameterized SQL and row mapping in repository modules. Do not place SQL in FastAPI routes.
5. Make the sample loader transactional and deterministic. Re-running it must not silently duplicate the fixture.
6. Build a service that reads a weekly context from repositories, calls `review_engine.rules.analyze_week`, and stores the structured result.
7. Keep database records and API models separate where their representations differ.

Prefer the standard-library `sqlite3` module unless the repository has explicitly adopted another persistence library.

## Preserve Boundaries

- Do not copy the LifeOs database or personal exports into this repository.
- When adapting author-owned prototype code, record the source and adaptation in the issue or PR and add Theseus-specific tests.
- Normalize legacy `consume` values to Theseus `consuming` at an adapter boundary.
- Defer auth, server sync, PostgreSQL, and mobile-local schema work.

## Verify

Use a temporary database for automated tests. Cover:

- schema creation from an empty file;
- foreign-key and enum/check constraints;
- create/list repository behavior;
- rollback on invalid sample input;
- idempotent sample loading;
- database-loaded context matching the sample JSON semantics;
- generated review persisted with evidence and structured findings.

Run the focused tests, then:

```bash
python3 scripts/run_sample_review.py
python3 -m compileall backend review_engine scripts
```

Report any verification that could not be run.
