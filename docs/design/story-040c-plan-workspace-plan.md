# STORY-040C Plan Workspace Delivery Plan

Status: In Progress

Owner: Dong

Branch: `feature/040c-plan-workspace-convergence`

Date: 2026-07-30 PDT

## Dependency

This slice follows the accepted STORY-040 portrait Plan contract and is stacked
on the completed Today and Insights navigation work. Existing WeeklyPlan,
Task, proposal, persistence, conflict, and Undo contracts remain authoritative.

## Delivery Boundary

- Add an account-local target-week selector with Previous, Next, date input,
  and conditional Next week reset.
- Replace the Level 1 balance report with a compact capacity visual.
- Keep one concise adjustment at Level 1; keep reason and full before/after
  evidence in the existing detail.
- Combine Plan blocks and Tasks into one compact collection.
- Preserve load, empty, write, conflict, verified save, and Undo behavior while
  adding missing-capacity and cross-week safety guards.

No API, database, plan-generation rule, Assistant, Calendar, or voice behavior
changes in this slice.

## Verification

- `npm test -- --run src/features/plan/PlanScreen.test.tsx src/features/plan/planModel.test.ts src/shared/shell/AppShell.test.tsx`
- `npm test -- --run`
- `npm run typecheck`
- `npm run build`
- `git diff --check`
- sanitized 320px and 390px portrait captures of Plan Level 1 plus at least one
  protected state.

## Implementation Evidence

- Focused Plan, model, and shell verification: 25 tests passed.
- Full frontend regression: 179 tests passed across 30 files.
- TypeScript and the production build passed.
- Sanitized evidence:
  - `docs/demo/screenshots/plan-workspace-320.png`
  - `docs/demo/screenshots/plan-workspace-390.png`
  - `docs/demo/screenshots/plan-capacity-missing-390.png`
- The localhost-only Chrome capture helper now waits for the first Vite
  transform before taking the exact-viewport screenshot.
