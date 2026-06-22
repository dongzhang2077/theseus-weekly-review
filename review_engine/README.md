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

## Sprint 2 Evidence Contract

`analyze_week` returns `evidence.schema_version` with the value
`sprint2.review_evidence.v1`. The stable evidence sections are:

- `summary`: planned minutes, actual minutes, and input record counts.
- `goals`: goal ID, title, priority, active status, actual minutes, and linked project IDs.
- `projects`: project ID/title, goal link, stage/status, planned minutes, actual minutes, drift, and inactivity age.
- `plan`: week dates, planned capacity, slack target, planned total, and planned slack.
- `activity`: activity-type minutes with all four types plus total and unlinked minutes.
- `reflections`: reflection count and counts for small wins, mood notes, and free notes.

The Sprint 1 flat keys such as `actual_total_minutes`, `planned_by_project`,
`actual_by_project`, `actual_by_goal`, and `activity_mix` remain available for
backward compatibility.
