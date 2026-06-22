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

Activity mix uses the four stable types: `consuming`, `neutral`, `restore`,
and `destroy`. The deterministic checks call out meaningful recovery support
when restore time reaches at least 25% of consuming time, and raise a
`destroy_pattern` risk when destroy time is at least 120 minutes and 25% of
logged time.

## Sprint 2 Evidence Contract

`analyze_week` returns `evidence.schema_version` with the value
`sprint2.review_evidence.v1`. The stable evidence sections are:

- `summary`: planned minutes, actual minutes, and input record counts.
- `goals`: goal ID, title, priority, active status, actual minutes, linked project IDs, and project-level actual-minute breakdown.
- `projects`: project ID/title, goal link, stage/status, planned minutes, actual minutes, drift, and inactivity age.
- `plan`: week dates, planned capacity, slack target, planned total, planned slack, required slack, slack status, project drift rows, and unplanned project-linked time.
- `activity`: activity-type minutes with all four types plus total and unlinked minutes.
- `reflections`: reflection count and counts for small wins, mood notes, and free notes.
- `dormancy`: active non-dormant projects with weekly minimums, actual minutes, last activity date, inactive days, and risk level.

The Sprint 1 flat keys such as `actual_total_minutes`, `planned_by_project`,
`actual_by_project`, `actual_by_goal`, and `activity_mix` remain available for
backward compatibility.
