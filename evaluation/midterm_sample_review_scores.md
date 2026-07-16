# Midterm Sample Review Scores

Checkpoint: 2026-07-15

These are internal engineering scores against
[`review_quality_rubric.md`](review_quality_rubric.md), not external user
validation. Each dimension is scored from 1 to 5.

| Sanitized scenario | Factual | Goal relevance | Positive recognition | Actionability | Restraint | Slack protection | Risk detection | Total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `sample_week.json` | 5 | 5 | 5 | 4 | 5 | 5 | 5 | 34/35 |
| `aligned_restore_week.json` | 5 | 5 | 5 | 4 | 5 | 5 | 5 | 34/35 |
| `overloaded_drift_week.json` | 5 | 5 | 4 | 4 | 5 | 5 | 4 | 32/35 |

Average: 33.3/35.

## Evidence Notes

- The base week reports 11 planned hours, 7.5 logged hours, one aligned primary
  goal, frontend drift, and a 30-day wake-up risk.
- The aligned week reports 8 planned and logged hours, 3 restore hours, healthy
  slack, no risk flags, and one restrained repeat recommendation.
- The overloaded week reports the complete 16 planned hours, 5 logged hours,
  zero planned slack, drift, destroy activity, and dormancy evidence. A July 15
  regression fix ensures its unlinked 4-hour plan item is included in total
  planned time and the `tight` slack state.

The main weakness is specificity: deterministic next steps are bounded and
safe, but still generic. The overloaded scenario also expresses overload
through `slack_risk` rather than a distinct `overload_risk` finding. These are
appropriate final-evaluation follow-ups rather than 2026-07-18 blockers.

Reproduce the three outputs with:

```bash
.venv/bin/python scripts/run_sample_review.py
.venv/bin/python scripts/run_sample_review.py \
  --sample data/sample/scenarios/aligned_restore_week.json
.venv/bin/python scripts/run_sample_review.py \
  --sample data/sample/scenarios/overloaded_drift_week.json
```

Two to three classmate reviews remain required before these scores can be
treated as product evaluation evidence.
