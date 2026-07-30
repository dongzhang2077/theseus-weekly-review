# Theseus Daily Workspace v2 Wireframes

- Status: product-owner review required
- Story: STORY-040
- Wireframe date: 2026-07-30
- Product owner: Dong Zhang
- Scope: information architecture only; no released UI behavior is claimed

## 1. Purpose

This is the first acceptance artifact for the visual-first UI phase. It turns
the accepted product direction into mobile and desktop wireframes before an
HTML prototype or React implementation begins.

If accepted, this document supersedes the older four-tab Level 1 layout in
`app-ux-spec.md` and `app-screen-wireframes.md`. Existing Focus, TimeLog,
Review, Signal, Proposal, Plan, and Undo behavior remains protected.

The required delivery sequence is:

```text
This wireframe
  -> product-owner acceptance
  -> responsive HTML prototype
  -> screenshot and interaction acceptance
  -> React implementation
```

## 2. Design Question

The new Level 1 experience must answer three questions without a paragraph:

1. What am I doing now?
2. Where did my time go?
3. What needs attention or adjustment?

Everything else is detail, evidence, editing, or account management.

## 3. Proposed Information Architecture

### Primary destinations

```text
Today | Insights | Plan
```

- `Today` owns current Focus, daily capture, time distribution, history, and
  Day/Week/Month time views.
- `Insights` combines the Level 1 presentation of Review and Signals. It does
  not merge their domain records or deterministic rules.
- `Plan` owns next-week capacity, blocks, Tasks, proposals, approval feedback,
  and Undo.

Account, integrations, preferences, and history controls remain utilities, not
primary destinations. A future assistant is an overlay invoked from the shell,
not a fourth tab. No assistant control appears until it has working behavior.

### Default entry

Authenticated startup opens `Today`. A deep link may still open Insights,
Plan, or a detail record.

Reason: `Today` contains the recurring daily action. Weekly Review remains
available without defining the startup experience for every day of the week.

### Maximum depth

```text
Level 1 destination -> Level 2 focused view -> Level 3 record/evidence editor
```

No flow may require a fourth content level. Full-screen detail surfaces remain
opaque and preserve an obvious Back or Close action.

## 4. Shared Responsive Shell

### Mobile shell

```text
+--------------------------------------+
| current date / week         account  |
|--------------------------------------|
|                                      |
|            active content            |
|                                      |
|--------------------------------------|
|    [today]     [insights]     [plan] |
+--------------------------------------+
```

- Bottom navigation is icon-first with accessible names and selected state.
- The current destination is not communicated by color alone.
- Account is a compact utility action.
- No persistent sample badge, explanation banner, or assistant placeholder
  consumes Level 1 space.

### Desktop shell

```text
+------+---------------------------------------------------------------+
|      | current date / week                              account      |
|  T   |---------------------------------------------------------------|
|  I   |                                                               |
|  P   |                       workspace                               |
|      |                                                               |
|      |                                                               |
+------+---------------------------------------------------------------+
```

- A narrow left rail replaces bottom navigation at desktop width.
- The workspace uses available width; it is not forced into a centered 430px
  phone simulation.
- Content remains bounded to readable columns and does not become an admin
  dashboard.
- The desktop view rearranges the same hierarchy; it does not add unrelated
  metrics.

## 5. Today

### 5.1 Mobile Day view

```text
+--------------------------------------+
| Thu, Jul 30                  account |
| [ Day ]   Week    Month              |
|--------------------------------------|
| CURRENT                              |
| Backend schema             18:42  [■]|
| Theseus · Focus                       |
|--------------------------------------|
|                 4h 35m               |
|                ╭──────╮              |
|              ╭─╯      ╰─╮            |
|             │   total    │            |
|              ╰─╮      ╭─╯            |
|                ╰──────╯              |
|  ■ Theseus       2h 10m   47%         |
|  ▨ Coursework    1h 25m   31%         |
|  · Recovery      1h 00m   22%         |
|--------------------------------------|
|  timeline                         >  |
|  09  [Theseus]  11 [Course] 14 [Walk]|
|--------------------------------------|
|       [today]  [insights]  [plan]    |
+--------------------------------------+
```

Information budget:

- one current Focus row with timer and Start/End control;
- one period selector;
- one donut with total in its center;
- at most five visible distribution segments;
- one compact timeline preview;
- no review narrative, recommendation paragraph, or complete log list.

Interactions:

- current Focus row opens Activity detail;
- Start/End remains the accepted exactly-once Focus action;
- donut segment opens filtered Today records;
- donut center or timeline row opens complete Today history;
- `Project` is the default distribution dimension;
- a compact Level 2 segmented control may switch `Project` and `Energy`.

The donut is not shown when total time is zero. A single segment remains a
truthful full ring, but its accessible summary states that only one category is
recorded.

### 5.2 Mobile Week view

```text
+--------------------------------------+
| Jun 8 - Jun 14               account |
|   Day   [ Week ]   Month             |
|--------------------------------------|
|  24h 40m                             |
|  6h |             ▧                  |
|  4h |    ▧        ▧   ▧              |
|  2h | ▧  ▧   ▧    ▧   ▧   ▧         |
|     +-----------------------------    |
|       M  T   W    T   F   S   S      |
|  ■ Project  ▨ Study  · Recovery      |
|--------------------------------------|
|  Plan / actual                       |
|  Theseus       6h planned   5h actual|
|  Coursework    4h planned   6h actual|
|--------------------------------------|
|       [today]  [insights]  [plan]    |
+--------------------------------------+
```

- Seven days use stacked vertical bars, never a seven-cell heatmap.
- Each day exposes exact total and segment values by focus, tap, or an
  accessible data summary.
- The chart uses one active dimension at a time. It does not stack Projects
  and Energy semantics together.
- Plan/actual rows are limited to the most material deltas; complete comparison
  is Level 2.

### 5.3 Mobile Month view

```text
+--------------------------------------+
| July 2026                    account |
|   Day     Week   [ Month ]           |
|--------------------------------------|
|  M  T  W  T  F  S  S                 |
|        ·  ░  ▒  ░  ·                 |
|  ▒  ▓  ░  ·  ▒  ·  ·                 |
|  ░  ▒  ▓  ▒  ░  ·  ·                 |
|  ▒  ▒  ░  ▓  ▒  ░  ·                 |
|--------------------------------------|
|  18 active days       3h 12m average |
|  Selected: Jul 28                 >  |
|--------------------------------------|
|       [today]  [insights]  [plan]    |
+--------------------------------------+
```

- Month uses a calendar heatmap only when the requested range contains enough
  dates to make a pattern meaningful.
- Intensity represents one written measure, initially recorded duration.
- A legend, text summary, keyboard navigation, and selected-day detail are
  required. Color is not the only indicator; cells also use a bounded intensity
  pattern or written value in the accessible view.
- Month is allowed to ship after Day and Week. Its placeholder must not imply
  unavailable data has been analyzed.

### 5.4 Desktop Today

```text
+------+---------------------------------------------------------------+
|      | Thu, Jul 30                                      account      |
| [T]  | Day  Week  Month                                             |
|  I   |---------------------------------------------------------------|
|  P   | CURRENT                 | TIME DISTRIBUTION                   |
|      | Backend schema   18:42  |        4h 35m                       |
|      | [Start / End]           |       (donut)                       |
|      |-------------------------|-------------------------------------|
|      | TODAY TIMELINE          | SEVEN-DAY CONTEXT                   |
|      | ordered session bands   | compact stacked bars               |
|      |                         |                                     |
+------+---------------------------------------------------------------+
```

Desktop may show the current Day distribution and compact seven-day context
together. Both remain connected to the same records and range selector.

## 6. Insights

Review and Signals merge only at Level 1. The source review, finding, signal,
threshold, evidence, and proposal IDs remain distinct and inspectable.

### 6.1 Mobile Level 1

```text
+--------------------------------------+
| <        Jun 8 - Jun 14        >     |
|--------------------------------------|
| NEEDS ATTENTION                      |
| 2 wins                         1 risk|
|--------------------------------------|
| PRIORITY                             |
| Resume project            Dormant  > |
| 0m actual / 60m planned              |
| [Adjust]                             |
|--------------------------------------|
| Wins                              2 >|
| Other issues                       1 >|
| Steady checks                      3 >|
| Weekly review                        >|
|--------------------------------------|
|       [today]  [insights]  [plan]    |
+--------------------------------------+
```

Rules:

- remove the oversized Review character from the operational Level 1 layout;
- meaningful character art remains available for empty, completion, onboarding,
  or a compact review detail state;
- show one priority issue, one measured value, and one action;
- do not repeat the priority issue in `Other issues`;
- `Weekly review` opens the bounded narrative at Level 2;
- wins, risks, and steady checks expose counts before lists;
- no decorative rhythm dots or unlabeled computed status marks.

### 6.2 Insight depth

```text
Level 1 Insights
  -> Level 2 signal/review summary
       -> Level 3 evidence record

Level 1 priority action
  -> Level 2 Plan proposal preview
       -> approved existing Plan execution path
```

Evidence remains reachable within two taps. The Plan action is not repeated on
the read-only evidence page.

### 6.3 Desktop Insights

```text
+------+---------------------------------------------------------------+
|      | < Jun 8 - Jun 14 >                                           |
|  T   |---------------------------------------------------------------|
| [I]  | STATUS + COUNTS          | PRIORITY + ACTION                   |
|  P   |--------------------------|------------------------------------|
|      | Wins                     | Other issues                        |
|      | Weekly review            | Steady checks                       |
+------+---------------------------------------------------------------+
```

The priority remains first in reading and keyboard order even when it occupies
the right desktop column visually.

## 7. Plan

### 7.1 Mobile Level 1

```text
+--------------------------------------+
| Jun 15 - Jun 21                  [+] |
|--------------------------------------|
| 12h planned       18h capacity       |
| ████████████░░░░░░  6h slack         |
|--------------------------------------|
| ADJUSTMENT                           |
| Protect one restart block         > |
| +1h Resume project                   |
| [Apply]                              |
|--------------------------------------|
| Plan blocks                  3 · 12h >|
| Tasks                       4 active >|
|--------------------------------------|
|       [today]  [insights]  [plan]    |
+--------------------------------------+
```

Rules:

- keep the compact capacity visual rather than adding a dense chart;
- proposal reason and complete before/after evidence remain Level 2;
- preserve Apply, conflict, verification, saved, and Undo states;
- do not add time-distribution charts to Plan;
- a plan block continues to hand off to Today Focus.

### 7.2 Desktop Plan

```text
+------+---------------------------------------------------------------+
|      | Jun 15 - Jun 21                                      edit     |
|  T   |---------------------------------------------------------------|
|  I   | LOAD + SLACK             | SUGGESTED ADJUSTMENT               |
| [P]  | planned/capacity bar     | before -> after + Apply            |
|      |--------------------------|------------------------------------|
|      | PLAN BLOCKS              | TASKS                              |
|      | compact ordered rows     | compact active rows                |
+------+---------------------------------------------------------------+
```

## 8. State Wireframes

### Loading

```text
Current Focus remains visible when already known.
Chart region: stable skeleton with no old sample values.
Controls requiring current records: disabled with accessible state.
```

### Zero data

```text
Today
[Start focus]
No time recorded

Do not render an empty donut or zero-height seven-day chart.
```

### Sparse data

```text
Recorded 25m
One visible segment
"More days are needed for a monthly pattern" only inside Month view.
```

### Chart load error

```text
Focus Start/End remains usable.
Time summary could not load        [Retry]
Do not replace operational Focus with a full-screen chart error.
```

### Saved or corrected history

```text
Update chart and exact totals immediately.
Show one compact confirmation with Undo when supported.
Mark overlapping Review stale through existing behavior.
```

## 9. Chart Semantics and Evidence

### Donut

- question: what share of recorded time belongs to each Project or Energy
  type in the selected period;
- default: Project;
- center: exact total recorded duration;
- segments: two to five visible, ordered by duration;
- negligible segments may become `Other` only when tapping `Other` reveals its
  members;
- segment value: duration and percentage;
- source: non-deleted authenticated TimeLogs plus clearly identified running
  Focus time for Today only;
- never double count a completed FocusSession and its TimeLog.

### Seven-day stacked bars

- question: how did recorded duration and its composition change by day;
- one bar per account-local date;
- one active dimension at a time;
- exact values available without relying on pointer hover;
- running time belongs only to the account-local current day;
- cross-midnight completed records use existing split TimeLogs.

### Month heatmap

- question: on which dates was recorded activity present and how intense was
  it;
- default measure: total recorded duration;
- no category comparison inside each cell;
- exact date and value available by keyboard and tap;
- display a sparse-data state instead of implying a stable pattern.

### Plan versus actual

- question: which Project allocations materially diverged from the plan;
- use paired or variance bars only in Week detail;
- show planned, actual, and signed delta in text;
- do not convert threshold or severity into decorative color.

## 10. View-Model Boundary

The first implementation should derive chart view models from existing
authenticated records through pure, tested functions. It should not calculate
time semantics inside SVG event handlers or page components.

Indicative UI-only shapes:

```text
PeriodSummary
  range
  totalSeconds
  distribution[] -> key, label, seconds, percent, recordIds
  days[] -> localDate, totalSeconds, segments[]
  provenance -> persisted count, running count, source status
```

Rules:

- raw Activity name and normalized Activity type remain distinct;
- every aggregate retains record IDs for drill-down;
- timezone and date range are explicit inputs;
- deleted TimeLogs are excluded;
- chart rounding never changes exact totals;
- if loading all TimeLogs becomes unbounded, define a ranged API contract in a
  separate backend story rather than hiding the issue in frontend code.

## 11. Accessibility and Interaction

- Every chart has a visible title, exact total, and accessible text summary.
- Each segment, bar, or day is keyboard reachable when it opens detail.
- Pointer hover is optional enhancement, never the only value access path.
- Color is paired with label, order, pattern, or written status.
- Hit targets remain comfortable on mobile.
- Focus order follows the reading and action order.
- Range and distribution modes use segmented controls with visible selected
  state.
- Reduced-motion users receive no animated chart sweep; state transitions may
  use a short fade only.
- Charts use SVG or semantic HTML with a parallel data summary; an inaccessible
  canvas-only implementation is not accepted.

## 12. Implementation Boundaries

Protected behavior:

- local authentication and account isolation;
- exactly-once Focus Start/End and cross-midnight TimeLogs;
- correctable Today history and Undo;
- deterministic Review and Signal rules;
- Proposal preview, approval, verified execution, and Undo;
- loading, empty, error, conflict, saved, and stale states.

Maintainability rules:

- do not add chart or new workspace rules to legacy `global.css`;
- use semantic `desk-*` Tailwind tokens;
- create independent time-aggregation, chart, range-selector, and evidence
  components with focused tests;
- do not add the new modes directly to the existing 1,300-line Track screen or
  1,100-line Plan screen;
- preserve one data owner for selected range and TimeLog inputs;
- no API, schema, AI provider, Calendar, or OpenClaw change belongs to this UI
  story.

## 13. Wireframe Acceptance Checklist

Product-owner acceptance is required before HTML work. Confirm:

- `Today / Insights / Plan` is the correct primary navigation;
- authenticated startup should open Today;
- Focus remains the first action on Today;
- Project is the correct default donut dimension;
- Day, Week, and Month belong in one time workspace;
- the mobile Day view is not too dense;
- Review and Signals should merge at Level 1 only;
- the Review character can leave the operational Level 1 screen;
- desktop should use adaptive workspace width rather than a 430px simulation;
- no future assistant control should appear until it works;
- Day and Week may ship before Month;
- the proposed visual hierarchy is ready for responsive HTML prototyping.

## 14. Verification for This Artifact

```bash
git diff --check
```

Manual review:

- compare every visual with the question it answers;
- trace every aggregate to its record-level destination;
- confirm all protected actions and states still have a place;
- inspect mobile and desktop reading order;
- confirm there is no Level 4 flow, decorative metric, fake data, or inactive
  assistant control.
