# Theseus Style Reference

## Primary Direction

Name: Warm Stationery Workspace

Reference image:

- `frontend/ui_reference/ui_reference1.png`

This is the primary visual direction for the Theseus frontend. Use it as a style reference, not as a fixed layout template.

The accepted implementation and governance rules are recorded in
`docs/design/frontend-design-governance.md`. Its 2026-07-17 decisions take
precedence over older icon-only or decoration-heavy guidance.

## Intent

The UI should feel like a bright weekly-review desk: calm, organized, lightly personal, and usable for repeated planning and reflection. It should avoid dark, heavy, game-like, or marketing-page presentation.

## Visual Principles

- Use warm off-white backgrounds with subtle paper-like softness.
- Keep surfaces light, quiet, and spacious without becoming sparse.
- Use thin borders and low shadows instead of heavy cards.
- Make the app feel structured first and decorative second.
- Use soft color accents for meaning, not decoration.
- Keep the interface positive and readable, especially around risks.

## Layout Pattern

Desktop:

- Narrow icon navigation on the left.
- Top week selector and compact utility actions.
- Main workspace with review, plan/log, goals, or evidence views.
- Use large, stable content panels with internal dividers.
- Prefer dense but readable tables for plan/log/evidence data.

Mobile:

- Bottom navigation with icons and short visible labels.
- Compact week selector in the top bar.
- Stack review sections into small panels.
- Collapse tables into abbreviated rows or summary cards.
- Keep the first screen focused on wins, risks, evidence, and next action.

## Color System

Use low-saturation accents on warm neutral surfaces.

- Background: warm white or paper white.
- Borders: soft beige/gray.
- Primary accent: muted green for active, progress, selected navigation, and next actions.
- Evidence accent: muted blue.
- Risk accent: muted amber, never harsh red unless the state is severe.
- Priority accent: soft pink, cream, or pale yellow.
- Text: near-black for primary content, gray for secondary metadata.

Avoid:

- Dark mode as the primary style.
- Neon colors.
- Purple-blue gradient themes.
- Large colorful backgrounds.
- Overusing one color family across the entire interface.

## Components

- Primary navigation items use an icon and a one-word visible label with a clear selected state.
- Familiar utility controls may be icon-only when they have accessible names.
- Primary and ambiguous actions use concise visible labels.
- Tables should use thin row dividers, compact labels, and clear numeric alignment.
- Status chips should be small, soft, and color-coded.
- Review sections should use light section dividers and compact headers.
- Evidence rows should prioritize project, planned, actual, delta, and note.
- Progress indicators should be subtle rings, bars, or small status marks.

## Decoration

Decoration is allowed only as a light stationery cue.

- Use tape, paper texture, grid texture, or botanical marks sparingly.
- Keep decoration at edges or corners, outside dense data areas.
- Do not place decoration behind text.
- Do not repeat tape or plants on every panel.
- Do not use emoji as decoration.
- Do not use generic AI illustrations.

## Typography

- Use a clean sans-serif for the product UI.
- Keep headings compact and work-surface appropriate.
- Use tabular numerals for hours, totals, and deltas when available.
- Avoid oversized hero typography.
- Avoid handwritten fonts for core data; they can reduce readability.

## Interaction Feel

- Transitions should be subtle: small fades, drawer slides, or selected-state movement.
- Avoid playful bounce effects.
- Keep toolbar actions compact and predictable.
- Make selected week, selected nav item, and changed data visually obvious.

## Hard Constraints

- No emoji in the UI.
- Do not hide the meaning of primary or ambiguous actions behind icons.
- Do not add explanatory product copy to main screens.
- Do not turn this into a landing page.
- Do not let decoration compete with review evidence.
- Do not reduce accessibility for the sake of visual style.

## Good Fit For Theseus Screens

- Weekly review summary.
- Plan vs actual comparison.
- Evidence table.
- Goal and project list.
- Activity mix and risk review.
- Sprint/demo dashboard.

## Poor Fit

- Full pixel-game UI.
- Dark command-center dashboard.
- Marketing hero page.
- Decorative scrapbook layout with low information density.
- Heavy glassmorphism or colorful gradient app shell.
