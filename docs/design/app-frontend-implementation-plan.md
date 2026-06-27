# App Frontend Implementation Plan

Status: active implementation baseline.

This plan converts the accepted app-first prototype into the real frontend implementation. The prototype remains the visual and interaction reference; the React app becomes the maintainable code path.

## Sprint Goal

Build a mobile-first Theseus app shell that can demonstrate the weekly review loop:

Review -> Signals -> Track -> Plan

The implementation should preserve the accepted low-noise UX, icon-first controls, stationery visual direction, and inspectable evidence flow.

## Architecture

Frontend app root:

```text
frontend/app/
  src/
    shared/
      components/      reusable sheet, detail, icon button, state surfaces
      icons/           app icon primitives
      navigation/      tab definitions and bottom nav
      shell/           phone/app shell
    features/
      review/          review cover and review drill-down
      signals/         signal priority model and evidence details
      track/           activity timer model and tracking UI
      plan/            next-week plan model and adjustment UI
    styles/            shared visual system
```

Keep data decisions in feature models first, then connect UI to backend APIs. Avoid writing review rules, timer rules, or planning rules directly inside click handlers when they can be tested as pure functions.

## Task Split

### Task 1

Owner: Dong

Depends on: accepted app prototype

Files/modules: `frontend/app/src/shared`, `frontend/app/src/styles`, app package config

Acceptance criteria:

- React/Vite app runs as a mobile-first app surface.
- Shared shell, bottom navigation, icon button, sheet, and detail panel exist.
- Buttons remain icon-first; visible action text is one word where needed.

Verification:

- `npm run typecheck`
- `npm test -- --run`
- `npm run build`

Demo evidence:

- App opens to Review and switches across all four tabs.

### Task 2

Owner: Dong

Depends on: Task 1

Files/modules: `features/review`, `features/signals`

Acceptance criteria:

- Review L1 follows the locked prototype hierarchy.
- Signals priority is data-driven by severity and fixed signal priority order.
- Signals evidence rows are buttons and detail content stays compact.

Verification:

- `npm test -- --run`
- Manual keyboard check for signal rows and detail close/back.

Demo evidence:

- Highest-priority signal controls the central Signals visual.

### Task 3

Owner: Dong

Depends on: Task 1

Files/modules: `features/track`

Acceptance criteria:

- Track remains a low-friction activity toggle surface.
- Multi-running is preserved.
- L1 timer focuses the active activity by current product rule.
- Activity detail is discoverable without relying only on long press.
- Stopping an activity accumulates the session without a save confirmation step.

Verification:

- `npm test -- --run`
- Manual timer start/stop/today-total check.

Demo evidence:

- Activity session starts from `00:00:00`; today totals accumulate.

### Task 4

Owner: Dong

Depends on: Task 1

Files/modules: `features/plan`

Acceptance criteria:

- Plan supports suggestion available/applied/dismissed states.
- Focus and slack details can be saved.
- Empty or incomplete plan paths lead to focused planning surfaces.

Verification:

- `npm test -- --run`
- Manual apply/dismiss/save check.

Demo evidence:

- Review suggestion can become a next-week plan adjustment.

### Task 5

Owner: Zhi Kang or Dong

Depends on: Tasks 1-4

Files/modules: screenshots, demo script, presentation notes

Acceptance criteria:

- Mobile screenshots cover the four tabs.
- Demo path is documented.
- Known limitations are listed.

Verification:

- Manual demo rehearsal.

Demo evidence:

- One consistent app-flow recording or screenshot set.

## Human Review Points

Human review should happen at these gates:

1. After Review and Signals are implemented: confirm the first-glance hierarchy still matches the accepted prototype.
2. After Track is implemented: confirm timer and activity-toggle behavior feels clear enough for demo.
3. After Plan is implemented: confirm suggestion-to-plan flow is understandable.
4. Before PR merge: run the app on the mobile-sized viewport and check screenshots against `docs/design/style-reference.md`.

## Quality Gates

Required before a frontend PR is ready:

- `npm run typecheck`
- `npm test -- --run`
- `npm run build`
- No emoji in UI.
- Icon-only controls have accessible names.
- Main screens avoid explanatory paragraphs.
- Generated build output and local dependencies stay uncommitted.

## Current Limitations

- Backend API integration is not connected yet.
- Character art and stationery assets are represented in code/CSS first; final asset migration can happen after component behavior is stable.
- The prototype zip/static HTML remains the visual reference until React parity is reviewed.
