# Theseus Daily Workspace v2 Wireframes

- Status: product-owner review required
- Story: STORY-040
- Wireframe date: 2026-07-30
- Revision: conditional-review findings incorporated; re-acceptance required
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

### Now and selected-period boundary

`Current Focus` and the visualized period are independent contexts:

- `Now` always represents live Focus state at the current instant;
- changing Day, Week, or Month never rewinds, hides, or substitutes live Focus;
- the selected period affects charts, totals, history, and evidence only;
- every date boundary uses the authenticated account timezone;
- Day, Week, and Month each provide Previous and Next controls;
- Next is disabled at the account-local current day, current week, or current
  month because Today visualizes recorded evidence, not future planning;
- a `Today` reset appears only when the selected period is historical;
- changing range preserves the active Project/Energy distribution dimension;
- returning to Today restores the account-local current Day while preserving
  live Focus state.

Insights keeps its independent Monday-to-Sunday selector, disables Next on the
current week, and exposes `This week` only while browsing history. Plan keeps
its target week selector and may browse future weeks because future intent
belongs to Plan.

### Parallel Focus boundary

The existing ability to run multiple Activities concurrently is protected.

Foreground selection order:

1. the running Activity explicitly selected by the user;
2. otherwise, the most recently started running Activity;
3. otherwise, the user's selected idle Activity;
4. otherwise, the deterministic current recommendation;
5. otherwise, no foreground Activity.

Rules:

- the Current Focus row and its Start/End control operate only the foreground
  Activity;
- switching the foreground Activity never ends another running Activity;
- when two or more Activities run, a compact `N running` control appears beside
  `Now` and opens the running-Activities sheet;
- the sheet shows every running Activity, its uninterrupted run duration, and
  an independent End control;
- ending one Activity leaves every other running Activity unchanged;
- when no foreground Activity exists, Start opens the Activity picker before
  any FocusSession is created;
- the Activity picker indicates running rows and permits selecting an idle or
  running Activity as the foreground row;
- every Start and End retains the accepted idempotent, exactly-once service
  boundary.

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
| Today                        account |
| [ Day ]   Week    Month              |
|--------------------------------------|
| NOW                       [2 running]|
| Backend schema             18:42  [■]|
| Theseus · Focus                     >|
|--------------------------------------|
| < Thu, Jul 30 >                      |
| TIME BY PROJECT              [data]  |
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
|  TODAY TIMELINE                   >  |
|  09  [Theseus]  11 [Course] 14 [Walk]|
|--------------------------------------|
|       [today]  [insights]  [plan]    |
+--------------------------------------+
```

Information budget:

- one Now region with foreground Focus, timer, Start/End, and an optional
  running-count entry;
- one period selector;
- one selected-date control with Previous and Next;
- one donut with total in its center;
- at most five visible distribution segments;
- one compact timeline preview;
- no review narrative, recommendation paragraph, or complete log list.

Interactions:

- current Focus row opens Activity detail;
- Start/End affects only the foreground Activity and remains exactly once;
- `N running` opens the running-Activities sheet and is omitted below two;
- if no foreground Activity exists, Start opens the Activity picker;
- Previous and Next change only the selected Day;
- Next is disabled on the account-local current Day;
- a visible `Today` reset replaces the right-side spacer whenever a historical
  Day is selected;
- donut segment opens filtered Today records;
- donut center or timeline row opens complete Today history;
- `[data]` opens a Level 2 accessible list of every segment and exact value;
- `Project` is the default distribution dimension;
- a compact Level 2 segmented control may switch `Project` and `Energy`.

The donut is not shown when total time is zero. A single segment remains a
truthful full ring, but its accessible summary states that only one category is
recorded.

### 5.2 Mobile Week view

```text
+--------------------------------------+
| Today                        account |
|   Day   [ Week ]   Month             |
|--------------------------------------|
| NOW                       [2 running]|
| Backend schema             18:42  [■]|
|--------------------------------------|
| < Jun 8 - Jun 14 >           [Today]|
| RECORDED TIME BY DAY          [data] |
| Total 24h 40m                        |
|  6h |             ▧                  |
|  4h |    ▧        ▧   ▧              |
|  2h | ▧  ▧   ▧    ▧   ▧   ▧         |
|     +-----------------------------    |
|       M  T   W    T   F   S   S      |
|  ■ Theseus  ▨ Coursework  · Recovery|
|--------------------------------------|
|  Plan / actual                       |
|  Theseus       6h planned   5h actual|
|  Coursework    4h planned   6h actual|
|--------------------------------------|
|       [today]  [insights]  [plan]    |
+--------------------------------------+
```

- Seven days use stacked vertical bars, never a seven-cell heatmap.
- Previous and Next change only the selected Monday-to-Sunday week. Next is
  disabled on the account-local current week; `Today` appears only on a
  historical week.
- future dates inside the current week are marked unavailable, excluded from
  totals, and never rendered as zero-duration evidence;
- Each day exposes exact total and segment values by focus, tap, or an
  accessible data summary.
- `[data]` opens the seven-row accessible data list, including each day's total
  and segment values.
- The chart uses one active dimension at a time. It does not stack Projects
  and Energy semantics together.
- Plan/actual rows are limited to the most material deltas; complete comparison
  is Level 2.

### 5.3 Mobile Month view

```text
+--------------------------------------+
| Today                        account |
|   Day     Week   [ Month ]           |
|--------------------------------------|
| NOW                       [2 running]|
| Backend schema             18:42  [■]|
|--------------------------------------|
| < July 2026 >                [Today]|
| RECORDED TIME INTENSITY       [data]|
|  M  T  W  T  F  S  S                 |
|        ·  ░  ▒  ░  ·                 |
|  ▒  ▓  ░  ·  ▒  ·  ·                 |
|  ░  ▒  ▓  ▒  ░  ·  ·                 |
|  ▒  ▒  ░  ▓  ▒  ░  ·                 |
|  None ·   Low ░   Med ▒   High ▓     |
|--------------------------------------|
|  18 active days       3h 12m average |
|  Selected: Jul 28                 >  |
|--------------------------------------|
|       [today]  [insights]  [plan]    |
+--------------------------------------+
```

- Month uses a calendar heatmap only when the requested range contains enough
  dates to make a pattern meaningful.
- Previous and Next change only the selected calendar month. Next is disabled
  on the account-local current month; `Today` appears only on a historical
  month.
- future dates inside the current month are marked unavailable and excluded
  from intensity, active-day, and average calculations;
- Intensity represents one written measure, initially recorded duration.
- The visible None/Low/Medium/High legend, exact total summary, keyboard
  navigation, selected-day detail, and `[data]` list are required. Color is not
  the only indicator; cells also use a bounded intensity pattern or written
  value in the accessible view.
- Month is allowed to ship after Day and Week. Its placeholder must not imply
  unavailable data has been analyzed.

### 5.4 Desktop Today

```text
+------+---------------------------------------------------------------+
|      | Today                                             account      |
| [T]  | Day  Week  Month           < Thu, Jul 30 >                    |
|  I   |---------------------------------------------------------------|
|  P   | NOW          2 running | TIME BY PROJECT              [data] |
|      | Backend schema   18:42 |        4h 35m                       |
|      | [Start / End]          |       (donut + legend)              |
|      |-------------------------|-------------------------------------|
|      | TODAY TIMELINE          | SEVEN-DAY CONTEXT                   |
|      | ordered session bands   | compact stacked bars               |
|      |                         |                                     |
+------+---------------------------------------------------------------+
```

Desktop may show the current Day distribution and compact seven-day context
together. Both remain connected to the same records and range selector.

### 5.5 Running Activities sheet

```text
+--------------------------------------+
| <              Running              |
|--------------------------------------|
| Backend schema               18:42 [■]|
| Coursework reading           07:15 [■]|
|--------------------------------------|
| Choose another Activity           [+]|
+--------------------------------------+
```

- opening the sheet does not pause any timer;
- selecting a row makes it the foreground Activity and returns to Today;
- each End control affects only its row;
- a failed End keeps the row and its unsaved state available for Retry;
- when the last running Activity ends, the foreground falls back to the
  selected idle Activity or deterministic recommendation;
- all icon controls have Activity-specific accessible names.

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

### 8.1 Today states

Loading time evidence:

```text
Current Focus remains visible when already known.
Chart region: stable skeleton with no old sample values.
Controls requiring current records: disabled with accessible state.
```

No foreground Activity:

```text
NOW
Choose an Activity                     [Start]

Start opens the Activity picker. No session is created before selection.
```

Zero recorded time:

```text
Today
[Start focus]
No time recorded

Do not render an empty donut or zero-height seven-day chart.
```

Sparse time evidence:

```text
Recorded 25m
One visible segment
"More days are needed for a monthly pattern" only inside Month view.
```

Chart load error:

```text
Focus Start/End remains usable.
Time summary could not load        [Retry]
Do not replace operational Focus with a full-screen chart error.
```

Saved or corrected history:

```text
Update chart and exact totals immediately.
Show one compact confirmation with Undo when supported.
Mark overlapping Review stale through existing behavior.
```

Focus load error:

```text
NOW
Focus state could not load             [Retry]

Do not offer Start until running state is known; prevent duplicate sessions.
Previously loaded time charts may remain visible with a last-updated mark.
```

### 8.2 Insights states

Loading:

```text
< Jun 8 - Jun 14 >
[status/count skeleton]
[priority skeleton]

Previous confirmed content is not shown as current data.
```

No TimeLogs and no Review:

```text
No week evidence
[Open Today]

No Signal rows, counts, or generated narrative are shown.
```

TimeLogs exist but no Review has been generated:

```text
Review not created
[Generate]

Generate is the only primary action; Today remains available in navigation.
```

Review exists and no attention Signal exists:

```text
STEADY
2 wins                           0 risks
[Weekly review]           [3 checks steady]
```

Stale Review after a TimeLog correction:

```text
REVIEW OUT OF DATE
Recorded time changed                 [Regenerate]
[View previous]
```

- stale findings are not presented as current Signals;
- `View previous` opens the prior Review with a persistent `Out of date` mark;
- successful regeneration replaces the stale state and refreshes Insights.

Load or generation error:

```text
Insights could not load                  [Retry]
[Last verified]  only when a confirmed prior Review exists
```

The last verified Review remains explicitly dated and cannot be mistaken for
the selected current week.

### 8.3 Plan states

Loading:

```text
Jun 15 - Jun 21
[load/slack skeleton]
[plan rows disabled]
```

No WeeklyPlan:

```text
No plan yet                              [New]
Tasks remain available                       >
```

Capacity missing:

```text
Capacity needed                 [Set capacity]
Existing blocks remain inspectable but balance and Apply stay disabled.
```

Proposal applying:

```text
ADJUSTMENT
Protect one restart block
Before 11h -> After 12h             Applying
```

- preserve the complete diff;
- disable duplicate Apply, Edit, and week navigation while the write is in
  flight;
- keep Plan blocks and Tasks readable.

Conflict:

```text
Plan changed elsewhere                    [Reload]
Your proposal remains inspectable but cannot be applied to stale state.
```

Verified save:

```text
Plan saved and verified                     [Undo]
12h planned · 6h slack
```

Undo in progress:

```text
Restoring previous plan
Current verified Plan remains visible; duplicate Undo is disabled.
```

Undo success:

```text
Previous plan restored
The balance, blocks, and proposal state refresh immediately.
```

Undo failure:

```text
Plan could not be restored                  [Retry]
The last verified saved Plan remains current and visible.
```

General Plan load or save error:

```text
Plan could not load or save                 [Retry]
Preserve any unsaved local draft when safe; never label it persisted.
```

## 9. Chart Semantics and Evidence

### Donut

- question: what share of recorded time belongs to each Project or Energy
  type in the selected period;
- visible title: `Time by project` or `Time by energy`;
- default: Project;
- center: exact total recorded duration;
- segments: two to five visible, ordered by duration;
- negligible segments may become `Other` only when tapping `Other` reveals its
  members;
- segment value: duration and percentage;
- source: non-deleted authenticated TimeLogs plus clearly identified running
  Focus time for Today only;
- never double count a completed FocusSession and its TimeLog;
- visible legend: segment label, exact duration, and percentage;
- data entry: an icon control named `View time distribution data` opens the
  same ordered values as a semantic list.

### Seven-day stacked bars

- question: how did recorded duration and its composition change by day;
- visible title: `Recorded time by day`;
- visible total: exact selected-week duration;
- one bar per account-local date;
- one active dimension at a time;
- exact values available without relying on pointer hover;
- running time belongs only to the account-local current day;
- cross-midnight completed records use existing split TimeLogs;
- visible legend: the active Project or Energy segments;
- data entry: an icon control named `View daily recorded time data` opens a
  seven-row semantic list with totals and segment values.

### Month heatmap

- question: on which dates was recorded activity present and how intense was
  it;
- visible title: `Recorded time intensity`;
- default measure: total recorded duration;
- no category comparison inside each cell;
- exact date and value available by keyboard and tap;
- display a sparse-data state instead of implying a stable pattern;
- visible legend: `None`, `Low`, `Medium`, and `High`, backed by documented
  duration thresholds rather than relative color alone;
- data entry: an icon control named `View monthly recorded time data` opens a
  date-ordered semantic list.

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
- The visible `[data]` marker in the wireframes represents an icon-only control
  with an accessible name; the HTML prototype must use the existing icon system
  and may add a short tooltip, but required values also remain in the semantic
  list.
- Each chart is a named `figure` whose caption is its visible title. A concise
  screen-reader summary states period, total, largest segment or day, and
  whether running time is included.
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
- Current Focus remains live and independent from the selected historical
  period;
- Day, Week, and Month each have Previous, Next, conditional Today reset,
  future-period limit, and account-timezone behavior;
- foreground selection and the `N running` sheet fully protect concurrent
  FocusSessions;
- Insights explicitly covers no Review, no Signal, stale, loading, generation
  error, and retry behavior;
- Plan explicitly covers no plan, missing capacity, applying, conflict,
  verified, Undo success, Undo failure, and retry behavior;
- every chart wireframe shows its visible title, exact total, legend, and data
  summary entry;
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
