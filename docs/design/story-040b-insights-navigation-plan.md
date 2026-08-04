# STORY-040B Insights Navigation Delivery Plan

Status: In Progress

Owner: Dong

Branch: `feature/040b-insights-navigation-convergence`

Date: 2026-07-30 PDT

## Dependency

This slice implements the accepted STORY-040 portrait-first information
architecture on top of the accepted STORY-041 Today surface. It reuses the
existing persisted weekly-review and signal view models; it does not change an
API, database, review rule, Plan mutation, Assistant, Calendar, or voice
contract.

## Delivery Boundary

- Replace the four Review / Signals / Today / Plan destinations with Today /
  Insights / Plan and retain Today as the default.
- Map legacy `?tab=review` and `?tab=signals` links to Insights.
- Merge only Review and Signals Level 1: week status, one priority, Wins, Other
  issues, Steady checks, and Weekly review.
- Preserve separate Review finding and Signal source/evidence drill-downs and
  route their existing bounded actions to Plan.
- Preserve historical week controls and distinguish no evidence from an
  ungenerated review.

Plan visual refinement is a later independently verifiable slice.

## Acceptance And Verification

- No priority appears again in Other issues.
- Every displayed Review or Signal item opens its own existing evidence.
- Future weeks cannot be selected and a historical week can reset directly to
  the account-local current week.
- Empty, loading, error, and detail-navigation behavior remains actionable and
  accessible.
- Run:
  - `npm test -- --run src/features/insights/InsightsScreen.test.tsx src/shared/navigation/tabs.test.ts src/shared/shell/AppShell.test.tsx`
  - `npm test -- --run`
  - `npm run typecheck`
  - `npm run build`
  - `git diff --check`
- Capture sanitized 320px and 390px portrait evidence before acceptance.

## Implementation Evidence

- Focused navigation and Insights verification: 13 tests passed.
- Full frontend regression: 174 tests passed across 30 files.
- TypeScript and the production build passed.
- Sanitized evidence:
  - `docs/demo/screenshots/insights-320.png`
  - `docs/demo/screenshots/insights-390.png`
  - `docs/demo/screenshots/insights-other-390.png`
- The reusable Windows/WSL capture helper
  `frontend/app/scripts/capture-cdp.ps1` applies an exact CSS viewport through a
  localhost-only Chrome DevTools session; it does not expose a remote endpoint.
