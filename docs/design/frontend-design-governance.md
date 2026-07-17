# Theseus Frontend Design Governance

Status: accepted demo baseline, 2026-07-17 PDT.

This document records the product owner's frontend direction for the July 18
demo and later iterations. When an older frontend document conflicts with this
decision, this document takes precedence until the older document is updated.

## 1. Product Experience

The working loop is:

```text
notice a problem -> turn it into an action -> focus -> record evidence
-> review the week -> adjust the next plan
```

Each Level 1 screen must make its part of that loop obvious. It must not become
an independent analytics page. A user should be able to understand the current
state, its reason, and the next useful action without decoding decorative UI.

## 2. Accepted Visual Direction

The visual direction is **Warm Stationery / Desk Pad**:

- one quiet, warm work surface;
- hierarchy created by type, spacing, hairline dividers, and a small semantic
  color set;
- task and evidence before decoration;
- no nested card stacks, oversized timer or hero illustration;
- stationery and character art reserved for onboarding, meaningful empty or
  completion states, and review covers;
- no decorative motion on operational screens.

Focus and Plan are operational screens. Their default state must stay flatter
and quieter than an onboarding or celebration screen.

## 3. Navigation And Interaction

- Primary navigation uses a familiar icon plus a one-word visible label:
  `Review`, `Signals`, `Focus`, and `Plan`.
- Compact utility actions may remain icon-only when they have an accessible
  name and a familiar symbol.
- Every recommendation states why it is relevant now.
- Recommendation controls distinguish `Next`, `Delay`, `Skip`, and `Choose`.
- Timer state distinguishes start, pause/resume, end, and result capture.
- A Plan block can hand off directly to Focus without creating a second task
  model.
- Demo-only behavior must say that it is sample or view-local behavior. It must
  not imply server persistence.

## 4. Frontend Architecture

Tailwind CSS v4 is the default styling path for new and migrated screens.

- Vite owns the Tailwind integration through `@tailwindcss/vite`.
- Semantic design tokens live in `frontend/app/src/styles/tailwind.css` under
  the `desk-*` namespace.
- Screens use semantic utilities rather than page-specific hex values or a new
  page stylesheet.
- Shared behavior remains in typed React components and domain models. Styling
  utilities do not replace component boundaries or state tests.
- `global.css` is legacy compatibility code. Do not add new Focus or Plan rules
  to it. Remove legacy selectors only after every consumer has migrated and the
  affected screens have visual regression evidence.
- Do not import the teammate prototype's large CSS bundle. Ideas may be
  reimplemented only when they fit this architecture and have a clear product
  purpose.
- Respect `prefers-reduced-motion`. Any later motion must be brief, optional,
  and communicate a state transition.

Tailwind prevents uncontrolled page-style proliferation, but it does not make
large components maintainable by itself. Extract a component when it owns an
independent state flow, is reused, or makes a screen hard to test in isolation.

## 5. AI-Assisted Design Workflow

- Kimi K3 is the primary proposal model for visual hierarchy and interaction
  critique.
- GPT-5.6 Sol Max is the challenger and engineering integrator selected by the
  product owner.
- The product owner remains the design authority. Model output is a proposal,
  not an acceptance decision.
- Prefer a constrained brief and screenshot review before asking a model to
  edit code. Do not let a stalled model block the delivery path.
- Keep OpenCode Go credentials only in the ignored root `.env`. Never attach
  credentials, personal exports, or local databases to a model request.

## 6. Demo Gate

Before the July 18 demo, a frontend change is accepted only when:

- the primary flow works without relying on animation;
- Focus and Plan fit the accepted visual hierarchy at mobile and desktop
  widths;
- controls have accessible names and visible selected/disabled states;
- UI state is truthful in sample, loading, empty, error, and saved cases;
- focused interaction tests, the full frontend suite, TypeScript, and the
  production build pass;
- screenshots show no clipping or horizontal overflow.

Production authentication, cloud sync, calendar automation, LangGraph,
OpenClaw, and learned personalization remain post-demo work. The frontend may
prepare clean seams for them, but must not simulate those capabilities.
