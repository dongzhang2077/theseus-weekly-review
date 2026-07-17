# Theseus App Component Contract

This document defines the UI component contract for the app-first Theseus experience. It turns the UX and wireframe specs into stable reusable components before any HTML prototype or production frontend work.

Read in this order:

1. `docs/design/app-ux-spec.md`
2. `docs/design/app-screen-wireframes.md`
3. `docs/design/app-component-contract.md`
4. `docs/design/app-visual-system.md`
5. `docs/design/style-reference.md`
6. `docs/design/frontend-design-governance.md`

This document does not define colors, typography, or decoration. Visual styling lives in `docs/design/app-visual-system.md` and `docs/design/style-reference.md`.

## 1. Global Component Rules

- Components must support mobile app layouts first.
- Primary navigation always pairs its icon with a one-word visible label.
- Other Level 1 entries are icon-first; add a compact visible label whenever
  the action is primary or its icon is ambiguous.
- Every icon-only control must have an accessible name.
- Do not use emoji.
- Do not use traditional forms on the Track Level 1 screen.
- Do not create page-specific one-off controls when an existing component can handle the need.
- Do not nest cards inside cards.
- Do not put full tables, long paragraphs, or complete lists on Level 1 screens.

## 2. App Shell

Purpose:

- Provides the phone-sized app frame, content area, and persistent bottom navigation.

Used in:

- Review.
- Signals.
- Focus.
- Plan.

Level allowed:

- Level 1 only.

Content rules:

- One compact top region.
- One primary content region.
- One persistent bottom navigation.
- Bottom navigation stays visible on Level 1.
- Sheets or detail views may cover the app shell but must preserve an obvious close or back affordance.

States:

- Normal.
- Loading.
- Error.

Do not:

- Add desktop side navigation.
- Add a marketing header.
- Add dense utility toolbars.

## 3. Compact Header

Purpose:

- Shows current screen context without taking dashboard-like space.

Used in:

- Review week selector.
- Signals title.
- Track today view.
- Plan week selector.

Level allowed:

- Level 1.
- Optional on Level 2 if the sheet is full screen.

Content rules:

- Review header uses previous-week arrow, centered date range, next-week arrow.
- Plan header uses the target week range.
- Signals and Track may use icon-first title treatment.
- Header actions are state-specific, not permanent.

States:

- Current period.
- Disabled previous/next when unavailable.
- Stale data mark, only when needed.

Interactions:

- Week arrows change week.
- Header does not open unrelated settings.

Do not:

- Show permanent refresh on Review Level 1.
- Add explanatory screen subtitles.
- Add multiple utility icons by default.

## 4. Bottom Navigation

Purpose:

- Lets the user switch among the four app tasks.

Used in:

- All Level 1 screens.

Level allowed:

- Level 1 only.

Entries:

- Review.
- Signals.
- Track.
- Plan.

Content rules:

- Icon plus a one-word visible label.
- Selected item has a clear selected state.
- Each item has an accessible name.

States:

- Default.
- Selected.
- Disabled, only if a screen is unavailable.

Do not:

- Add Settings as a fifth primary tab.
- Use text-heavy labels by default.
- Use emoji or decorative icons.

## 5. Icon Entry

Purpose:

- Represents a tappable Level 1 entry point.

Used in:

- Review chapter icons.
- Plan action entries.
- Track project and activity type entries.

Level allowed:

- Level 1.
- Level 2 picker grids.

Content rules:

- One icon.
- Optional status dot or small state mark when it cannot be mistaken for
  computed evidence.
- Optional compact fallback label only after review.
- Minimum comfortable touch target.
- Accessible name is required.

States:

- Default.
- Selected.
- Attention.
- Disabled.
- Loading.

Interactions:

- Opens Level 2 section, picker, or sheet.

Do not:

- Add explanatory copy below the icon.
- Add numeric badges by default.
- Turn icon entries into dashboard cards.

## 6. Status Character Slot

Purpose:

- Gives Review and Track a quick visual state without text-heavy feedback.

Used in:

- Review Level 1.
- Track Level 1, if useful.

Level allowed:

- Level 1.

Content rules:

- One character or symbolic illustration.
- Expresses state: steady, needs attention, tired, restart, waiting, active timer.
- Tapping may open a speech bubble or state sheet.
- Character is feedback, not decoration.

States:

- Steady.
- Needs attention.
- Recovery needed.
- Waiting.
- Loading.
- Error.

Interactions:

- Review: tap opens short second-person speech bubble.
- Track: tap may open current session controls if needed.

Do not:

- Use emoji.
- Use generic stock-like AI illustration.
- Place long text inside the character area.
- Let the character compete with controls.

## 7. Status Dot And Mark

Purpose:

- Reinforces a compact written state.

Used in:

- Review state mark.
- Signals status marks paired with status text.
- Plan balance state.
- Project/status rows.

Level allowed:

- Level 1.
- Level 2.
- Level 3.

Content rules:

- Green: normal.
- Amber: attention.
- Red: severe risk only.
- Gray: no data or unavailable.
- Color must never be the only signal; pair it with compact status text.

States:

- Normal.
- Attention.
- Severe.
- No data.

Do not:

- Use harsh red for ordinary attention.
- Use too many competing colors.
- Add pulsing animation by default.

## 8. Speech Bubble

Purpose:

- Provides a short human-readable Review reaction after the user taps the status character.

Used in:

- Review Level 2.

Level allowed:

- Level 2 only.

Content rules:

- Second-person voice.
- One sentence or two short lines.
- Summarizes the week, not the full review.

States:

- Normal.
- Loading.
- Error fallback.

Do not:

- Put the full generated review in the bubble.
- Add multiple paragraphs.
- Use motivational filler.

## 9. Section Sheet

Purpose:

- Opens a Level 2 chapter, short list, or picker without creating deep navigation.

Used in:

- Wins chapter.
- Risks chapter.
- Full Review chapter.
- Signal chapters.
- Today logs.
- Plan focus, restart, slack, and projects sections.

Level allowed:

- Level 2.

Content rules:

- Compact heading or icon.
- Short list, picker, or review chapter content.
- Optional single primary action.
- Close or back affordance.

States:

- Loading.
- Empty.
- Error.
- Normal.

Interactions:

- Tapping a list row opens Level 3 detail.
- Close returns to the parent Level 1 screen.

Do not:

- Add nested cards.
- Open another Level 2 sheet from inside the sheet.
- Add long introduction text.

## 10. Detail Sheet

Purpose:

- Shows concrete evidence, reason, raw log, or editable adjustment within the maximum depth rule.

Used in:

- Risk detail.
- Win detail.
- Signal detail.
- Log detail.
- Plan detail.

Level allowed:

- Level 3.

Content rules:

- Title.
- Compact status.
- One short reason, if needed.
- Three to five evidence or setting rows.
- Optional single related action.
- Close or back affordance.

States:

- Normal.
- Loading.
- Error.
- Saved.

Do not:

- Add more than five evidence rows by default.
- Add nested detail screens.
- Turn detail sheets into dense reports.

## 11. Picker Sheet

Purpose:

- Lets the user choose project, activity type, stage, target, or planned block without a traditional form.

Used in:

- Track project selection.
- Track activity type selection.
- Plan project stage.
- Plan weekly target or minimum.

Level allowed:

- Level 2 or Level 3.

Content rules:

- Compact heading.
- Icon grid, chip list, or stepper.
- Current selection mark.
- Close or cancel affordance.

States:

- Default.
- Selected.
- Empty.
- Disabled.

Do not:

- Use full form select layout on Track Level 1.
- Add helper text unless the picker is blocked.
- Require a save button for simple selection unless the flow needs confirmation.

## 12. Timer Display

Purpose:

- Makes current time capture obvious and low friction.

Used in:

- Track Level 1.

Level allowed:

- Level 1.

Content rules:

- One large active timer.
- One timer state symbol or character.
- Current project icon.
- Current activity type icon.
- One primary control.
- Compact today-total indicator.

States:

- Idle.
- Running.
- Paused.
- Saving.
- Error.

Interactions:

- Play starts or opens required picker sequence.
- Pause pauses the timer.
- Stop opens save confirmation.
- Project and type icons open pickers.

Do not:

- Use start-time, end-time, or duration input fields on Level 1.
- Add a submit button on Level 1.
- Show the full daily log list on Level 1.

## 13. Save Confirmation Sheet

Purpose:

- Confirms a stopped timer session without a traditional form.

Used in:

- Track after stop.

Level allowed:

- Level 2.

Content rules:

- Duration.
- Project chip.
- Activity type chip.
- Optional note row.
- Save action.
- Discard action.

States:

- Ready.
- Saving.
- Saved.
- Error.

Do not:

- Show textarea by default.
- Show many editable fields at once.
- Hide discard behind secondary menus.

## 14. Today Total Indicator

Purpose:

- Gives a compact sense of today's recorded time and opens Today Logs.

Used in:

- Track Level 1.

Level allowed:

- Level 1.

Content rules:

- One compact visual or short value.
- Tapping opens Today Logs section sheet.

States:

- Zero.
- Has logs.
- Loading.

Do not:

- Show the full log list.
- Show weekly analytics.

## 15. Week Balance Visual

Purpose:

- Shows whether the next week looks balanced without a full plan table.

Used in:

- Plan Level 1.

Level allowed:

- Level 1.

Content rules:

- Compact data surface rather than a dense chart.
- Written balance status.
- Planned load, capacity, and slack.
- A subtle progress line or status mark may reinforce the written state.

States:

- Balanced.
- Tight.
- Empty.
- Unknown.

Interactions:

- Tapping opens Slack or capacity section.

Do not:

- Use a dense chart.
- Show capacity input on Level 1.
- Use red unless load is severe.

## 16. Suggested Adjustment Block

Purpose:

- Turns Review feedback into a concrete Plan action.

Used in:

- Plan Level 1 when suggestion exists.
- Full Review Level 2 at the end.

Level allowed:

- Level 1 on Plan.
- Level 2 on Full Review.

Content rules:

- One suggested action only.
- Target project or plan block.
- Signed time change on Level 1.
- Project time, total planned time, and slack before and after on Level 2.
- Apply or dismiss at Level 2; Undo is available after a successful Apply.
- If the suggestion is a restart action, it replaces the restart entry on Plan Level 1.

States:

- Available.
- Applied.
- Dismissed.
- Saving.
- Conflict.
- Error.
- Restored.

Do not:

- Show both restart and apply suggestion for the same project.
- Offer multiple suggestions at Level 1.
- Add long rationale text.

## 17. Signal Summary And Evidence Row

Purpose:

- Shows either a Level 1 signal summary or a compact Level 2 interpreted
  evidence item.

Used in:

- Signals chapters.
- Signals Level 1 summary.
- Review risk chapter when linking evidence.

Level allowed:

- Level 1 for the four stable summaries.
- Level 2 for supporting evidence.

Content rules:

- Signal identity or evidence subject.
- Compact written status.
- Optional single value.
- Level 1 order is always Plan, Stage, Goal, Energy.
- Tapping a summary opens its evidence chapter; tapping evidence opens detail.

States:

- Normal.
- Attention.
- Severe.
- No data.

Do not:

- Show raw JSON.
- Show all possible metrics.
- Use table layout on mobile.

## 18. Project Status Row

Purpose:

- Shows a project or plan item compactly without exposing full settings.

Used in:

- Plan projects section.
- Signals stage section.
- Review risk detail.

Level allowed:

- Level 2.
- Level 3.

Content rules:

- Project mark or color cue.
- Project title.
- Compact stage or status.
- Optional small value.

States:

- Healthy.
- Maintenance.
- Drift.
- Wake-up.
- Dormant.
- Overheated.

Do not:

- Show all project fields at once.
- Put editable form fields in the row.

## 19. State Surface

Purpose:

- Provides short loading, empty, no-data, error, and saved feedback.

Used in:

- All screens and sheets.

Level allowed:

- Level 1.
- Level 2.
- Level 3.

Content rules:

- One compact state symbol.
- One short sentence only when necessary.
- One primary action, if useful.

Screen-specific empty actions:

- Review empty: go to Track.
- Signals empty: go to Track.
- Track empty: start timer.
- Plan empty: create first plan block.

Do not:

- Use "No data available" as the final copy.
- Add onboarding paragraphs.
- Expose raw stack traces.

## 20. Component Acceptance Checklist

Before implementation or HTML prototype approval:

- Level 1 screens use the allowed component budget.
- Primary navigation uses icon-plus-label entries; other Level 1 actions expose
  visible text when the action is primary or ambiguous.
- Every icon-only control has an accessible name.
- Section and detail sheets do not create Level 4 navigation.
- Track does not use traditional forms.
- Timer end opens explicit outcome and result capture.
- Plan suggestion is deduplicated with restart.
- Signals shows one evidence-ranked priority signal, then Plan, Stage, Goal,
  and Energy in stable order.
- Empty and error states use short, screen-specific copy.
- No component uses emoji.
