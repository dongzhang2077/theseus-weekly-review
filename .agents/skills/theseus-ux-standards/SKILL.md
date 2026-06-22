---
name: theseus-ux-standards
description: Theseus project UX standards for frontend design, implementation, or review. Use when Codex designs, builds, refactors, or reviews Theseus UI screens, UX flows, navigation, layout, frontend copy, buttons, empty/loading/error states, dashboard/review workspaces, responsive behavior, or visual polish. Enforces low-noise UX, icon-first controls, no emoji, accessible interactions, concise task-focused copy, and separation between stable UX rules and replaceable UI style references.
---

# Theseus UX Standards

Use this skill to keep Theseus screens useful, quiet, and human. UX rules are stable; visual style is replaceable.

## Source Standards

Treat these public standards as the baseline:

- NN/g usability heuristics: system status, user control, consistency, recognition over recall, and aesthetic minimalist design.
- GOV.UK content design: write only what helps the user complete the task, use clear language, and avoid needless explanation.
- WCAG 2.2 AA intent: make controls perceivable, operable, understandable, keyboard reachable, and screen-reader nameable.

## Product Shape

Design Theseus as a weekly review workspace, not a landing page.

- Make the first screen actionable: week selector, review summary, risks, evidence, and next steps.
- Prefer a dashboard/workbench layout over marketing sections.
- Preserve the main task flow: select week -> inspect review -> expand evidence -> choose next action.
- Keep review logic visible enough to trust: every insight or risk should have inspectable evidence.
- Use calm, structured density. Theseus is a personal evidence tool, not a promotional site.

## UX And Style Separation

Do not bake a specific visual theme into this skill.

- If `docs/design/style-reference.md` exists, follow it for visual style only.
- If the user provides screenshots, websites, or mood references, extract a replaceable style pack: color, typography, spacing, radius, shadow, density, chart style, and motion.
- Keep UX behavior stable even when style changes.
- Do not use style references to justify unclear flows, excessive copy, inaccessible contrast, or decorative clutter.

## Text Policy

Use less visible text than a typical generated UI.

- Do not write feature explanations on the main screen.
- Do not add "This page helps you...", "Here you can...", onboarding paragraphs, or component descriptions.
- Keep body copy rare. Prefer labels, data, states, and actions.
- Use one short sentence only when the user needs context to make a decision.
- Put deeper explanation in tooltips, popovers, details panels, or evidence drawers.
- Empty states may contain only a short title, one short sentence, and one primary action.
- Error states must say what happened and how to recover. Do not expose raw stack traces.
- Generated review text may be natural language; chrome, controls, and navigation should stay terse.

## Buttons And Controls

Visible button text is prohibited by default.

- Use simple, familiar icons for buttons. Prefer the app's existing icon library; otherwise use lucide icons.
- Provide an invisible accessible name for every icon-only button, preferably with `aria-label`.
- Do not add visible labels, helper text, or always-on explanations to icon buttons.
- Use `title` or a tooltip only when the icon is ambiguous, uncommon, destructive, or hidden behind a dense toolbar.
- Keep tooltip copy short and functional. It should name the action, not explain the feature.
- Use visible text only when a control would otherwise be ambiguous, destructive, legally meaningful, or part of a form submit where clarity matters more than density.
- If visible button text is necessary, use 1-3 words and a direct verb phrase.
- Do not use emoji as icons, badges, status markers, placeholders, illustrations, bullets, or empty-state decoration.
- Use segmented controls for modes, toggles or checkboxes for binary settings, sliders/steppers/inputs for numbers, menus for option sets, tabs for views, and drawers/modals only for focused secondary tasks.

## Layout Rules

Design for scanning and repeated use.

- Use clear page regions: navigation, week/context controls, review summary, evidence, actions.
- Avoid cards inside cards.
- Use cards only for repeated entities, modals, and genuinely framed tools.
- Keep dense data readable with consistent spacing, alignment, and stable dimensions.
- Do not create oversized hero sections unless the user explicitly asks for a landing page.
- Do not fill the UI with decorative gradients, orbs, blobs, stock-like illustrations, or generic AI visuals.
- Keep text from overlapping or overflowing at mobile and desktop widths.
- Prefer real content and realistic sample data over placeholder marketing text.

## Interaction Rules

Make state and next action obvious.

- Show loading, empty, error, success, and disabled states for every async or data-dependent surface.
- Give immediate feedback after saves, review generation, imports, and destructive actions.
- Support cancel/close/back affordances for drawers, modals, and multi-step interactions.
- Preserve keyboard navigation and visible focus states.
- Keep destructive actions separated, confirmed, and reversible when practical.
- Make the next useful action visible after every state change.

## Accessibility Minimum

Icon-first UI still needs accessible names.

- Every interactive icon must have an accessible label.
- All controls must be reachable by keyboard.
- Focus order must match visual order.
- Color must not be the only indicator of risk, state, or selection.
- Text and important non-text UI must maintain sufficient contrast.
- Hit targets must be comfortably clickable on mobile.
- Tooltips must not be the only place where required information exists.

## Review Checklist

Before finishing frontend work, inspect the UI against this checklist:

- No emoji appear anywhere in the UI.
- Buttons are icon-only unless an exception is justified.
- Icon-only controls have accessible labels; tooltips are used only where ambiguity remains.
- Main screens contain no feature-description paragraphs.
- The primary workflow is visible without reading instructions.
- Loading, empty, error, disabled, and success states exist where needed.
- Text does not overlap, overflow, or force layout jumps.
- Desktop and mobile layouts are both usable.
- Visual style follows the current style reference if one exists.
- The result feels like a human-built work tool, not an AI-generated demo page.
