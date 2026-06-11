# Theseus: Weekly AI Review for Goal-Time Alignment

Theseus is an AI-assisted weekly execution review system for students and knowledge workers who manage multiple goals at the same time. It compares long-term goals, weekly plans, actual time logs, activity energy-impact labels, and optional reflection notes. It then generates a supportive weekly review with realistic next-week adjustments.

The MVP is intentionally narrow. Theseus is not a full autonomous planner, not a calendar replacement, and not a mental health tool. It is the missing review layer between what a user intended to do and where their time actually went.

## Current Project Stage

- Proposal submitted: 2026-06-09
- Progress Report 1: 2026-06-13
- Midterm implementation checkpoint: 2026-07-18
- Final defense and report: 2026-08-01

## MVP Scope

The MVP supports:

- Goal and project setup
- Weekly plan input
- Time log input
- Activity energy-impact labels: `consuming`, `neutral`, `restore`, `destroy`
- Optional daily reflection notes
- Weekly review generation
- Evidence-backed findings
- Positive review format: `win`, `insight`, `next_step`
- Dormancy, overload, slack, and plan-vs-actual checks
- Review quality evaluation with sample weeks and user feedback

The MVP does not support:

- Automatic calendar rewriting
- Wearable device dependency
- Fully autonomous actions
- Full multi-agent orchestration
- Mental health diagnosis

## Repository Structure

```text
theseus-weekly-review/
  README.md
  docs/
    00_project_charter.md
    01_product_requirements.md
    02_system_architecture.md
    03_data_model.md
    04_api_contract.md
    05_review_engine_design.md
    06_agile_delivery_plan.md
    07_product_backlog.md
    08_progress_report_1.md
    09_decision_log.md
    10_github_workflow.md
  backend/
    app/
      main.py
      schemas.py
    requirements.txt
  review_engine/
    README.md
    __init__.py
    rules.py
  frontend/
    README.md
  data/
    sample/
      sample_week.json
  evaluation/
    review_quality_rubric.md
```

## Architecture Summary

```text
Frontend
  Goal setup, weekly plan, time logs, review report

FastAPI Backend
  Validation, persistence, API contracts, review orchestration

SQLite Database
  Goals, projects, weekly plans, time logs, reflections, weekly reviews

Review Engine
  Deterministic checks + structured AI generation

Evaluation Layer
  Sample weeks, review quality rubric, user feedback records
```

See [System Architecture](docs/02_system_architecture.md) for the full design.

## Development Priorities

1. Build a clean backend schema and sample-data loader.
2. Implement deterministic review checks without LLM dependency.
3. Add structured LLM review generation after the checks are stable.
4. Build frontend input and review pages.
5. Validate generated reviews using the quality rubric.

## Quick Start

Run the sample rule-based review:

```bash
python3 scripts/run_sample_review.py
```

Expected output:

- `wins`
- `insights`
- `risk_flags`
- `next_steps`
- `evidence`
- `generated_text`

Start the backend after installing dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload
```

## GitHub Setup

This workspace is initialized as a local Git repository. On Windows-mounted WSL paths, Git may require a safe-directory override:

```bash
git config --global --add safe.directory /mnt/d/DouglasLearning/6-AppliedResearchProject/theseus-weekly-review
```

After creating the GitHub remote:

```bash
git remote add origin https://github.com/dongzhang2077/theseus-weekly-review.git
git branch -M main
git add .
git commit -m "chore: initialize theseus project workspace"
git push -u origin main
```

## Team Responsibilities

| Area | Owner |
|---|---|
| Backend, database, review engine, integration | Dong Zhang |
| Frontend, report layout, dashboard, benchmark material | Zhi Kang |
| Research, evaluation, final report, presentation | Both |
