# Personalization Evaluation Protocol

- Protocol version: `v1`
- Status: frozen STORY-028C candidate
- Frozen: 2026-07-30 PDT
- Scope: local, offline usefulness baseline only

## 1. Decision Boundary

This protocol does not authorize a learned ranker. It defines when Theseus has
enough consented evidence to calculate a reproducible usefulness baseline and
records why ranking evaluation remains blocked.

The Assistant's `5`-Outcome threshold means only that an aggregate is readable.
It is not a training or release threshold.

## 2. Eligible Observations

An observation is eligible only when:

- it belongs to the selected account;
- the Outcome's current `personalization_consent` is enabled;
- usefulness is rated from 1 through 5; and
- it remains linked to its canonical Proposal.

Withdrawing consent removes the Outcome from the next snapshot without
deleting or rewriting the ledger record. Unrated and unconsented Outcomes are
counted only as exclusions.

The v1 evaluator reads only:

- Proposal type;
- Outcome usefulness;
- Outcome creation order; and
- the account ownership boundary.

Proposal titles, rationale, evidence text, before/after content, and Outcome
notes are excluded. The CLI emits aggregates only and does not write the
database or an evaluation dataset.

## 3. Readiness And Split

The first usefulness comparison requires:

- at least 30 eligible Outcomes;
- a chronological holdout containing the later of 10 Outcomes or 20% of the
  eligible observations; and
- all remaining earlier observations as training data.

Chronological order is `(created_at, id)`. Random splitting is prohibited
because it can leak later behavior into an earlier prediction.

## 4. Frozen Baseline

Baseline method:

```text
proposal_type_mean_with_global_fallback
```

For each holdout Outcome:

1. use the training mean for its Proposal type when that type has at least
   three training Outcomes;
2. otherwise use the global training mean; and
3. clamp neither labels nor predictions outside the existing 1-5 scale because
   a mean of valid ratings is already bounded.

The primary metric is mean absolute error on holdout usefulness. The snapshot
also reports the global training mean and counts type-specific versus fallback
predictions.

Completion and result distributions remain diagnostics. They are not v1
optimization targets because context, execution opportunity, and selection
bias are not controlled.

## 5. Candidate Comparison

A later candidate method must:

- be trained only on the chronological training partition;
- produce one 1-5 usefulness prediction for every holdout Outcome;
- use the same eligible records and exclusions;
- report mean absolute error beside this frozen baseline; and
- retain neutral ordering when evidence is insufficient.

Matching or beating baseline error is necessary but not sufficient for
release. Confidence, provenance, correction, expiry, deletion, and a browser
explanation remain mandatory.

## 6. Ranking No-Go

The current ledger records the Proposal that was shown and its later Outcome.
It does not record the complete candidate set, display position, or which
alternatives were available at that moment. Therefore it cannot distinguish a
ranking effect from selection and exposure bias.

Every v1 snapshot must return:

```text
ranking_evaluation_supported = false
ranking_blocker = candidate_set_exposure_not_recorded
```

No ranking claim is allowed until a separately reviewed, consented
candidate-exposure contract exists. This protocol does not authorize that
schema.

## 7. Reproducible Command

```bash
.venv/bin/python scripts/evaluate_personalization_baseline.py \
  --database data/local/theseus.db \
  --user-id <account-id>
```

The command opens SQLite in read-only, query-only mode, requires the current
Theseus schema, verifies the account, and prints an aggregate JSON snapshot.
Do not commit its output when it was generated from a personal database.

## 8. Change Control

Changing eligibility, thresholds, split order, baseline, metric, or release
gate requires a new protocol version and a documented reason before examining
new holdout results.
