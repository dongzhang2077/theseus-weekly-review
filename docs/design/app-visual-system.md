# Theseus App Visual System

This document defines the visual constraints for the app-first Theseus experience. It converts `docs/design/style-reference.md` into implementation-oriented visual tokens and rules.

Related documents:

- `docs/design/style-reference.md`
- `docs/design/app-ux-spec.md`
- `docs/design/app-screen-wireframes.md`
- `docs/design/app-component-contract.md`

## 1. Visual Direction

Name:

```text
Warm Stationery App
```

Intent:

- Bright weekly-review companion.
- Calm, organized, lightly personal.
- Mobile-first and app-like.
- Structured before decorative.
- Positive around progress, gentle around risks.

The app may borrow paper, tape, desk, or hand-drawn cues from the style reference, but decoration must not compete with the main task.

## 2. Visual Non-Goals

Do not create:

- Dark command-center dashboard.
- Desktop-first web dashboard.
- Marketing landing page.
- Purple-blue gradient UI.
- Glassmorphism.
- Large soft gradient blobs.
- Heavy shadows.
- Large rounded card stacks.
- Neon palette.
- Full pixel-game UI.
- Decorative scrapbook layout with low information density.
- Generic AI illustration style.
- Emoji-based iconography.

## 3. Color Tokens

Use warm neutrals and muted accents. These values are starting tokens for prototype and implementation; minor tuning is allowed if contrast remains sufficient.

### Neutral

```text
--color-canvas: #FAF8F2
--color-paper: #FFFDF8
--color-surface: #FFFFFF
--color-surface-soft: #F6F2EA
--color-border: #E7DED0
--color-border-strong: #D5C8B6
--color-text: #20231F
--color-text-muted: #6D7168
--color-text-subtle: #969B91
```

### Accent

```text
--color-green: #6F8F6B
--color-green-soft: #E7F0E3
--color-blue: #6F8FAF
--color-blue-soft: #E6EDF5
--color-amber: #C18A3A
--color-amber-soft: #F5E8D0
--color-red: #B96358
--color-red-soft: #F2DEDA
--color-pink: #D7A4A2
--color-pink-soft: #F4E2E1
--color-cream: #F6E8BD
```

### Status Mapping

```text
normal: green
attention: amber
severe: red
evidence/support: blue
priority/suggestion: pink or cream
no-data: neutral muted
```

Rules:

- Use red only for severe risk.
- Use amber for ordinary attention.
- Use green for progress, active, selected, and healthy states.
- Use blue for evidence and signal explanation.
- Do not use color as the only state indicator in Level 2 or Level 3.
- Do not overuse one accent across the whole screen.

## 4. Typography Tokens

Use a clean system sans-serif stack:

```text
font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Use tabular numerals for timer, duration, planned time, actual time, and deltas.

Recommended mobile scale:

```text
--font-caption: 12px / 16px
--font-body: 14px / 20px
--font-body-strong: 15px / 22px
--font-section: 16px / 24px
--font-title: 20px / 28px
--font-timer: 44px / 52px
```

Rules:

- Do not use oversized hero typography.
- Do not use handwritten fonts for core data.
- Character art can feel hand-drawn, but UI text must remain readable.
- Letter spacing should be normal.

## 5. Spacing Tokens

Use an 8px rhythm with smaller internal adjustments only when needed.

```text
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 20px
--space-6: 24px
--space-8: 32px
```

Recommended mobile layout:

```text
screen side padding: 20px
top header height: 44px to 52px
bottom navigation height: 64px to 72px
Level 1 icon entry gap: 16px to 24px
sheet top padding: 20px
```

Rules:

- Use spacing to create calm hierarchy.
- Do not spread content so far apart that it feels like a landing page.
- Keep tap targets comfortable on mobile.

## 6. Radius Tokens

Use restrained radius.

```text
--radius-small: 4px
--radius-medium: 8px
--radius-round: 999px
```

Rules:

- App surfaces and repeated items use 8px or less.
- Circular icon buttons and dots may use full radius.
- Do not use large 16px to 28px card rounding.

## 7. Shadow And Border Tokens

Prefer thin borders and very low shadows.

```text
--border-default: 1px solid var(--color-border)
--shadow-soft: 0 6px 18px rgba(76, 62, 38, 0.08)
--shadow-sheet: 0 -8px 28px rgba(76, 62, 38, 0.10)
```

Rules:

- Border first, shadow second.
- No floating heavy cards.
- No glow effects.
- No glass blur surfaces.

## 8. Surface Rules

Canvas:

- Warm off-white.
- May include very subtle paper texture in prototype.

Primary surface:

- Paper white.
- Thin border.
- Low or no shadow.

Sheets:

- Paper white.
- Top or full-screen app sheet.
- Low sheet shadow.
- Clear close or back affordance.

Rows:

- Thin dividers.
- Compact vertical rhythm.
- No nested card look.

## 9. Icon Style

Use simple line icons.

Recommended characteristics:

- 20px to 24px icon size for navigation and entries.
- 1.75px to 2px stroke.
- Rounded line caps when available.
- Minimal filled shapes.
- Consistent stroke weight across screens.

Suggested semantic icon set:

```text
Review: book-open or journal
Signals: pulse, radar, or activity
Track: timer, play, pause, stop
Plan: calendar, route, or checklist
Wins: check, leaf, or upward mark
Risks: alert triangle or alert circle
Full review: open book or document
Plan signal: calendar or route
Stage signal: layers, sprout, or project node
Goal signal: target
Energy signal: leaf, battery, or pulse
```

Rules:

- Do not use emoji.
- Do not use highly detailed illustrations as icons.
- Do not mix filled cartoon icons with line icons.
- Level 1 icons are icon-only by default.
- Icons must be stable enough to understand in manual review.

## 10. Status Character Style

Purpose:

- Expresses the main Review or Track state quickly.

Style:

- Simple hand-drawn character or symbolic companion.
- Warm, minimal, and readable.
- Line-based with muted accent fills.
- Expressive face or posture is allowed.
- No speech text by default; speech bubble appears only after tap.

Allowed state variants:

- Steady.
- Needs attention.
- Recovery needed.
- Restart needed.
- Waiting.
- Timer active.

Rules:

- Character is a state component, not decorative filler.
- Do not use emoji faces.
- Do not use generic AI stock character art.
- Do not use dark, glossy, 3D, or game-like character style.
- Character must not obscure controls.

## 11. Decoration Rules

Allowed:

- Sparse tape marks.
- Paper grain.
- Small botanical edge mark.
- Tiny stationery cue near screen edges.

Rules:

- Decoration must stay outside dense information areas.
- Decoration cannot sit behind text.
- Decoration cannot repeat on every component.
- Decoration cannot be the main content.

Do not use:

- Large decorative illustrations behind UI.
- Gradient blobs.
- Bokeh.
- Stock-like background images.
- Emoji.

## 12. Component Visual Rules

Bottom navigation:

- Fixed bottom area.
- Warm paper surface.
- Thin top border.
- Icon-only by default.
- Selected state uses muted green mark, underline, or soft filled circle.

Icon entry:

- Round or compact target.
- No text label by default.
- Optional tiny status dot.
- No dashboard-card frame by default.

Section sheet:

- Paper surface.
- Low shadow.
- Thin dividers.
- Compact heading.

Detail sheet:

- Paper surface.
- Clear title and status.
- Evidence rows use dividers, not cards.

Timer:

- Large tabular timer.
- Single dominant control.
- Project and type controls are compact icons or chips.

Week balance:

- Simple ring, bar, or balance mark.
- No complex chart.

## 13. Motion Rules

Allowed:

- Small fade.
- Bottom sheet slide.
- Selected nav movement.
- Subtle timer state transition.

Timing:

```text
fast: 120ms
normal: 180ms
sheet: 220ms
```

Do not use:

- Bounce effects.
- Large page-flip animation.
- Continuous decorative motion.
- Animated gradient backgrounds.

## 14. Mobile Prototype Target

Design for mobile first.

Prototype target viewports:

```text
390 x 844
375 x 812
430 x 932
```

Rules:

- No horizontal app dashboard layout.
- No content overflow at narrow widths.
- Bottom navigation must remain reachable.
- Sheets must fit small mobile heights.
- Text inside buttons or chips must not overflow.

## 15. Visual Acceptance Checklist

Before approving an HTML prototype or frontend implementation:

- The app reads as a warm stationery mobile app, not a web dashboard.
- Level 1 screens are not text-heavy.
- Icon entries do not look like dashboard cards.
- Colors are warm, light, and low saturation.
- Red appears only for severe states.
- Borders are thin and shadows are low.
- No gradient blobs, glassmorphism, neon colors, or dark dashboard styling.
- No emoji anywhere in the UI.
- Character art is stateful and not generic decoration.
- Bottom navigation is icon-first and clearly selected.
- Sheets, details, rows, and pickers share consistent visual treatment.
- Mobile viewports do not overflow or overlap.
