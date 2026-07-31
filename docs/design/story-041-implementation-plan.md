# STORY-041 Evidence-Backed Time Visualizations

- Status: Ready; implementation started
- Owner: Dong Zhang
- Branch: `feature/041-evidence-backed-time-visualizations`
- Stacked base: STORY-040 commit `606de15`
- Planning date: 2026-07-30 PDT

## Sprint Goal

Render one authenticated Today/Week time surface whose Project totals, daily
bars, and evidence drawers reconcile exactly with persisted, non-deleted
TimeLogs. The slice closes only when the same source records explain every
visible total and the protected Focus/Tracker flow still has one Start/End
control.

## Scope Boundary

Included:

- pure Project/day/week aggregation from authenticated TimeLog reads;
- accepted Project donut and Monday-to-Sunday stacked bars;
- exact record IDs and record-level evidence detail;
- populated, sparse, empty, loading, and error behavior for the time surface;
- accessible summaries, names, keyboard operation, and mobile targets;
- preservation of the accepted Current Focus and full-screen Tracker path.

Excluded:

- Month heatmap until the density and threshold gate is accepted;
- Review/Signals Level 1 convergence and Plan visual refinement;
- backend schema or endpoint changes;
- Assistant, OpenClaw, Calendar, voice, onboarding, and model calls;
- main merge or PR creation before product-owner browser acceptance.

## Existing Contract Decision

The existing authenticated `GET /time-logs` contract already accepts
`date_from` and `date_to`, excludes soft-deleted rows by default, and returns
stable Project and Activity snapshots plus exact `duration_seconds`. STORY-041
uses that contract and `AuthClient.fetch`; it does not introduce a chart API or
duplicate aggregation in FastAPI routes.

Chart totals use persisted TimeLogs only. Open FocusSession time remains visible
in `Now` but is not mixed into persisted chart totals, preventing a completed
session from being counted once as Focus and again as a TimeLog.

## Tasks

### Task A — Lock the aggregation model

Owner: Dong Zhang

Depends on: accepted STORY-040; existing `ApiTimeLogRead` and `PlanProject`

Files/modules:

- `frontend/app/src/features/today/timeAggregation.ts`
- `frontend/app/src/features/today/timeAggregation.test.ts`

Acceptance criteria:

- non-deleted records inside an inclusive ISO-date range are counted once;
- `duration_seconds` is authoritative and positive durations only are counted;
- Project buckets retain Project identity, exact seconds, percentage, and all
  contributing TimeLog IDs;
- null Project links remain an inspectable `Unassigned` bucket;
- unknown Project IDs remain distinct and are never guessed into another
  Project;
- seven ordered local dates are produced for Monday through Sunday;
- dates after the supplied account-local Today are `unavailable`, contain no
  sample values, and do not affect totals;
- display grouping such as `Other` retains every underlying Project and record
  ID for evidence inspection;
- ordering and rounding are deterministic and do not alter exact totals.

Verification:

```bash
cd frontend/app
npm test -- --run src/features/today/timeAggregation.test.ts
```

Demo evidence: focused tests print one exact Day total, one current Week with
future dates excluded, and one grouped bucket whose source IDs remain complete.

### Task B — Add independent chart and evidence components

Owner: Dong Zhang

Depends on: Task A

Files/modules:

- `frontend/app/src/features/today/TimeDonut.tsx`
- `frontend/app/src/features/today/WeekBars.tsx`
- `frontend/app/src/features/today/TimeEvidenceSheet.tsx`
- focused component tests beside those files

Acceptance criteria:

- SVG marks are decorative and never hide interactive descendants behind
  `role="img"`;
- one accessible summary states the exact total and segment/day values;
- legend and day controls open the matching source records;
- controls remain at least 44px in their primary 390px portrait target;
- color is reinforced by labels, values, order, and accessible names;
- zero and sparse inputs render truthful states instead of persuasive charts.

Verification:

```bash
cd frontend/app
npm test -- --run src/features/today
```

Demo evidence: populated, sparse, empty, and keyboard-open evidence states.

### Task C — Restore the React Today surface

Owner: Dong Zhang

Depends on: Tasks A-B

Files/modules:

- `frontend/app/src/features/today/TodayScreen.tsx`
- bounded changes in `frontend/app/src/App.tsx`
- bounded reuse/refactor in `frontend/app/src/features/track/`
- navigation integration only to the degree required by the accepted Today
  slice

Acceptance criteria:

- Current Focus remains independent of the selected chart date or week;
- Day and Week own Previous, Next, and conditional Today reset behavior using
  the account timezone;
- the accepted donut and seven-day bars use authenticated persisted records;
- tapping Current Focus opens the protected full-screen Tracker;
- Tracker timer text is read-only and exactly one explicit Start/End control
  mutates Focus;
- multiple running Activities remain visible and independently endable;
- Activity names wrap and no 320px horizontal overflow is introduced.

Verification:

```bash
cd frontend/app
npm test -- --run src/features/today src/features/track
```

Demo evidence: 390px Day, Week, evidence detail, Running Activities, and
Tracker captures plus a 320px Day overflow capture.

### Task D — Integration and release gate

Owner: Dong Zhang

Depends on: Tasks A-C

Files/modules: frontend tests, screenshots, backlog checkpoints, demo notes

Acceptance criteria:

- focused and full frontend tests pass;
- TypeScript and production build pass;
- Chromium keyboard, drawer Back/Escape, accessible-name, 320px, 390px, and
  centered desktop-QA checks pass;
- screenshots reconcile visually with the accepted HTML references;
- known navigation or later-slice gaps are explicit and do not masquerade as
  completed STORY-040 behavior.

Verification:

```bash
cd frontend/app
npm test -- --run
npm run typecheck
npm run build
git diff --check
```

Demo evidence: one authenticated persisted TimeLog set drives Day, Week, and
the exact evidence records without a fixture-only fallback claim.

## Critical Path And Risks

Critical path:

```text
TimeLog aggregation -> accessible chart components -> Today integration
-> protected Focus regression -> browser/screenshots -> product-owner review
```

Risks:

- Current React Focus has duplicate Start/End hit areas. Today integration must
  remove them rather than carrying this defect into the accepted hierarchy.
- Existing navigation still reflects the historical four-tab shell. This
  branch must not claim the full three-destination convergence until the later
  Insights and Plan slices are implemented and accepted.
- Project metadata can be missing while a TimeLog remains valid. The UI must
  show an inspectable unknown/unassigned source, never invent a title.
- Account timezone defines Today and week boundaries. Browser-local defaults
  may be used only before an authenticated timezone is available.
