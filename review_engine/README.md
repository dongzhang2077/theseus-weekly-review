# Review Engine

The review engine should stay independent from the web framework. It receives structured weekly data and returns structured findings.

## MVP Strategy

1. Run deterministic analysis first.
2. Produce a structured evidence package.
3. Add LLM wording later using the evidence package.

This makes the first prototype testable without an API key.

## Checks

- Goal-time alignment
- Plan-vs-actual gap
- Activity energy-impact mix
- Dormancy risk
- Slack risk
- Positive progress detection

