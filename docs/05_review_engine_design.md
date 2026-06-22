# Review Engine Design

## 1. Purpose

The review engine turns raw weekly evidence into a structured weekly review. It should not simply ask an LLM for advice. The engine first computes facts and risk signals, then uses AI only to produce clear and supportive wording.

## 2. Inputs

Required:

- Active goals
- Projects linked to goals
- Weekly plan items
- Actual time logs
- Activity energy-impact labels

Optional:

- Daily reflections
- Project deadlines
- User feedback from previous reviews

## 3. Outputs

The review engine returns:

- Wins
- Insights
- Risk flags
- Next steps
- Evidence package
- Human-readable weekly review text

Each major claim should have evidence.

### Sprint 2 Evidence Contract

The evidence package is versioned with:

```json
{
  "schema_version": "sprint2.review_evidence.v1"
}
```

Stable sections:

- `summary`: planned total, actual total, and counts of goals, projects, logs, and reflections.
- `goals`: each goal with priority, active status, actual minutes, linked project IDs, and project-level actual-minute breakdown.
- `projects`: each project with goal link, stage/status, planned minutes, actual minutes, difference, and inactive days.
- `plan`: week dates, planned capacity, slack target, planned total, planned slack minutes, and item count.
- `activity`: all four activity-type totals plus total logged minutes and unlinked minutes.
- `reflections`: reflection count and counts for small wins, mood notes, and free notes.

Sprint 1 compatibility keys such as `actual_total_minutes`, `planned_by_project`,
`actual_by_project`, `actual_by_goal`, and `activity_mix` remain present while
front-end and demo code move to the structured sections.

## 4. Deterministic Checks

### Goal-Time Alignment

Question:

Did the user's actual project time support the highest-priority goals?

Signals:

- Minutes per goal
- Minutes per project
- Goal priority
- Projects with zero meaningful time

Example finding:

```json
{
  "type": "alignment_gap",
  "severity": "medium",
  "message": "The internship goal received 0 minutes this week.",
  "evidence": {
    "goal": "Internship search",
    "actual_minutes": 0
  }
}
```

### Plan-vs-Actual Gap

Question:

How different was the actual week from the planned week?

Signals:

- Planned minutes by project
- Actual minutes by project
- Difference and percentage difference
- Unplanned time categories that displaced planned work

### Activity Energy-Impact Mix

Question:

Was the week dominated by consuming, neutral, restore, or destroy activities?

Signals:

- Total minutes by activity type
- Ratio of `restore` to `consuming`
- Excessive `destroy` time

### Dormancy Risk

Question:

Did an active project receive no meaningful attention?

Signals:

- Last activity date
- Weekly actual minutes
- Project stage
- Whether the project was intentionally dormant

Default thresholds:

- 0 minutes this week on an active project: warning
- 14+ days inactive: medium risk
- 21+ days inactive: wake-up risk

### Capacity and Slack Risk

Question:

Did the week leave enough buffer?

Signals:

- Planned capacity minutes
- Sum of planned minutes
- Slack target percent
- Actual consuming minutes

Default heuristic:

- Keep around 20% unassigned capacity.
- Treat this as guidance, not a hard rule.

## 5. AI Generation Layer

The LLM receives a structured evidence package, not raw unsorted data.

Prompt responsibilities:

- Use supportive language.
- Start with wins.
- Explain insights with evidence.
- Give only 1-3 realistic next steps.
- Avoid blame, diagnosis, and motivational cliches.
- Preserve user control.

Expected structure:

```json
{
  "wins": [],
  "insights": [],
  "risk_flags": [],
  "next_steps": [],
  "generated_text": ""
}
```

## 6. LangGraph Direction

The MVP can start with a linear rule pipeline. LangGraph should be introduced when the workflow needs durable state, review revisions, or human-in-the-loop approval.

Target LangGraph nodes:

```text
LoadContext
  -> ValidateWeek
  -> BuildEvidence
  -> AnalyzeAlignment
  -> AnalyzePlanGap
  -> AnalyzeEnergyMix
  -> DetectRisks
  -> GenerateReviewDraft
  -> UserApproval
  -> StoreReview
```

## 7. Quality Rules

A generated review is unacceptable if:

- It invents facts not present in the evidence.
- It gives more than three major next steps.
- It frames the user as lazy or failing.
- It ignores completed work and recovery activities.
- It gives medical, psychological, or mental health diagnosis.
