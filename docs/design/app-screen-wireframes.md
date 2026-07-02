# Theseus App Screen Wireframes

This document extends `docs/design/app-ux-spec.md` with screen-level UX structure. It is the input for the app-sized HTML prototype and later frontend implementation.

It is not a visual style document. Visual style lives in `docs/design/style-reference.md`.
Reusable component rules live in `docs/design/app-component-contract.md`.

## 1. Global Screen Rules

### Level 1 Icon Rule

Level 1 entry points are icon-only by default.

Rules:

- Use stable, familiar icons before adding visible text.
- Do not add default text labels to Level 1 entry icons.
- If manual review or user testing shows that an icon is unclear, add a compact fallback label.
- Fallback labels may be 1 to 2 words only.
- Fallback labels name the entry point; they do not explain it.
- Every icon-only control must have an accessible name.
- Do not use emoji.

Example:

```text
Allowed fallback: Signals
Not allowed: See why your review was generated
```

### Level 1 Region Order

Each primary tab should use this general mobile order:

```text
Compact header
Primary state area
Primary icon entries
Optional compact indicator
Bottom navigation
```

The order may change only when the primary user task requires it. Do not use dashboard cards as the default structure.

### Detail Access Rule

Any specific evidence, raw log, note, project setting, or adjustment must be reachable within two taps from its parent tab.

Allowed depth:

```text
Level 1 -> Level 2 -> Level 3
```

Disallowed depth:

```text
Level 1 -> Level 2 -> Level 3 -> Level 4
```

## 2. Shared Content Templates

### Section Sheet Template

Use for Level 2 chapters, pickers, and short lists.

Content order:

```text
Icon or compact heading
Short list or picker grid
Optional single primary action
Close or back affordance
```

Constraints:

- No long introduction paragraph.
- No nested cards.
- No full-width data table.
- Keep rows short and tappable.

### Detail Sheet Template

Use for Level 3 evidence, risk, signal, log, or plan detail.

Content order:

```text
Title
Compact status
One short reason, if needed
3 to 5 evidence rows
Optional single related action
Close or back affordance
```

Constraints:

- Do not exceed 5 evidence rows by default.
- If more evidence exists, summarize first and defer raw data to a later dedicated flow.
- Related action is optional and must be singular.

### Picker Template

Use for project, activity type, stage, target, or plan-block selection.

Content order:

```text
Compact heading
Icon grid or chip list
Current selection mark
Cancel or close affordance
```

Constraints:

- Do not use select-form layouts on Track Level 1.
- Do not add helper text unless the picker is blocked.

### Save Confirmation Sheet Template

Use after stopping a timer.

Content order:

```text
Duration
Project chip
Activity type chip
Optional note row
Save action
Discard action
```

Constraints:

- Project and activity type are editable through chips or pickers.
- Note is hidden behind a note row.
- Do not show a traditional form.

## 3. Review Screen Wireframe

### Level 1 Information Budget

Allowed:

- 1 date range.
- 2 week navigation arrows.
- 1 status character.
- 1 small status mark.
- 3 chapter icons: wins, risks, full review.
- 1 bottom navigation.

Default not allowed:

- Visible text labels under chapter icons.
- Permanent refresh action.
- Short status sentence.
- Numeric badges.
- Evidence shortcut.
- Next shortcut.
- Full review text.
- Lists or tables.

Fallbacks:

- If the status character is unclear during manual review, allow one compact status phrase of 8 English words or fewer.
- If a chapter icon is unclear, allow a 1 to 2 word fallback label.

### Level 1 Region Order

```text
<        Jun 8 - Jun 14        >

        [status character]
        [small status mark]

    [wins icon]   [risks icon]   [full review icon]

[bottom nav icons]
```

### Level 2 Sections

Status character:

- Opens speech bubble.
- Speech bubble uses second person.
- One short sentence or two short lines maximum.

Wins icon:

- Opens Wins chapter.
- Short wins list.

Risks icon:

- Opens Risks chapter.
- Short risks list.
- Sort severe risk before mild risk.

Full review icon:

- Opens Full Review chapter.
- Review narrative is allowed here.
- Suggested adjustment appears at the end.

### Level 3 Details

Win detail:

```text
Title
Why it matters
Evidence rows
```

Risk detail:

```text
Risk title
Compact severity
One short reason
Evidence rows:
- Planned
- Logged
- Inactive days, if relevant
- Weekly minimum or target, if relevant
Optional action: Plan adjustment
```

### State Design

Loading:

- Show status character placeholder and muted chapter icons.

Empty:

- Show calm empty state.
- Primary action: go to Track.

No review yet:

- Show status character in waiting state.
- Primary action: generate review.
- Generate action is state-specific, not permanent.

Stale review:

- Show a small stale mark.
- Refresh/regenerate action may appear in Level 2 or detail, not as a permanent header action.

Error:

- Say what failed in one short sentence.
- Primary action: retry.

## 4. Signals Screen Wireframe

### Level 1 Information Budget

Allowed:

- 1 compact title or icon header.
- 1 central signal symbol.
- 4 signal icons.
- Up to 4 status dots.
- 1 bottom navigation.

Default not allowed:

- Visible labels under signal icons.
- Raw numbers.
- Evidence rows.
- Tables.
- Raw logs.
- Review narrative.

Fallbacks:

- If a signal icon is unclear during manual review, allow a 1 to 2 word fallback label.

### Level 1 Region Order

```text
        [central signal symbol]

    [plan icon]     [stage icon]
    [goal icon]     [energy icon]

[bottom nav icons]
```

### Signal Priority Rule

When multiple signals have attention states:

- Red signals outrank amber signals.
- Amber signals outrank green and gray signals.
- If multiple red signals exist, prioritize: Stage, Plan, Goal, Energy.
- If multiple amber signals exist, prioritize: Stage, Plan, Goal, Energy.
- Only the highest-priority signal may receive expanded visual emphasis on Level 1.
- Other signals remain compact icons with status dots.

### Level 2 Sections

Plan signal:

- Show compact plan drift rows.
- Sort largest drift first.

Stage signal:

- Show compact project health rows.
- Sort wake-up and drift before maintenance and healthy.

Goal signal:

- Show compact goal support rows.
- Sort unsupported high-priority goals first.

Energy signal:

- Show compact activity balance rows.
- Sort visible risk or support patterns first.

### Level 3 Details

Signal detail:

```text
Signal title
Compact status
One short reason
Evidence rows:
- Planned, if relevant
- Logged, if relevant
- Difference, if relevant
- Inactive days, if relevant
- Stage threshold or activity mix, if relevant
Optional action: open related Plan detail
```

### State Design

Loading:

- Show central signal symbol placeholder and disabled signal icons.

Empty:

- Show no-signal state.
- Primary action: go to Track.

No data:

- Indicate that more records are needed.
- Do not show fake signals.

Error:

- Show one short error.
- Primary action: retry.

## 5. Track Screen Wireframe

### Level 1 Information Budget

Allowed:

- 1 Today header.
- 1 timer state symbol or character.
- 1 active timer.
- 1 current project icon.
- 1 current activity type icon.
- 1 primary control: play, pause, or stop.
- 1 compact today-total indicator.
- 1 bottom navigation.

Default not allowed:

- Traditional form.
- Label/input stack.
- Submit button.
- Full log list.
- Textarea.
- Start-time input.
- End-time input.
- Duration input.

### Level 1 Region Order

```text
Today

        [timer state symbol]
        00:42:15

    [project icon]   [activity type icon]

             [play / pause / stop icon]

        [today total indicator]

[bottom nav icons]
```

### Default Tracking Flow

Timer startup:

- If last project exists, preselect it.
- If last activity type exists, preselect it.
- If project is missing, tapping play opens project picker first.
- If activity type is missing, tapping play opens activity type picker after project selection.
- Timer starts only after required context is selected.

While running:

- Primary control becomes pause or stop based on chosen interaction model.
- Project and activity type remain tappable chips/icons.
- Changing project or activity type opens picker, not a form.

Stopping:

- Show save confirmation sheet.
- Project and activity type can be changed through chips.
- Note is optional and hidden behind note row.
- Save and discard are the only actions.

### Level 2 Sections

Project icon:

- Project picker.

Activity type icon:

- Activity type picker.

Today-total indicator:

- Today logs sheet.

Current timer:

- Current session controls, if needed.

### Level 3 Details

Log detail:

```text
Activity title
Time range
Duration
Project chip
Activity type chip
Note row
Delete action, if needed
```

### State Design

Idle:

- Show ready timer.
- Primary action: play.

Running:

- Show active timer.
- Primary action: pause or stop.

Paused:

- Show paused timer.
- Primary actions: resume and stop.

No logs today:

- Keep timer start path dominant.
- Do not show "No data available".

Save success:

- Show compact confirmation.
- Return to idle timer.

Error:

- Show one short error.
- Preserve unsaved timer context when possible.

## 6. Plan Screen Wireframe

### Level 1 Information Budget

Allowed:

- 1 week range.
- 1 week balance visual.
- 1 primary suggested adjustment, if it exists.
- 3 to 4 compact action entries.
- 1 bottom navigation.

Default not allowed:

- Full task list.
- Planned-items table.
- Project-management dashboard.
- Goal/project CRUD surface.
- Capacity form.
- Weekly minimum or target fields.
- Long explanation.

### Level 1 Region Order

```text
Jun 15 - Jun 21

        [week balance visual]

        [suggested adjustment, if exists]

    [focus icon]   [restart icon or replacement]
    [slack icon]   [projects icon]

[bottom nav icons]
```

### Suggestion Priority And Deduplication

- If a review suggestion exists, it becomes the primary Level 1 action.
- If the suggestion is a restart action, it replaces the restart entry.
- Do not show both "apply suggestion" and "restart" for the same project.
- If no suggestion exists, show focus, restart, slack, and projects entries.
- Suggested adjustment must connect back to the Full Review source.

### Level 2 Sections

Suggested adjustment:

- Show proposed change.
- Show target project or plan block.
- Allow apply or dismiss.

Focus:

- Show next-week focus.
- Include target block or target hours only if needed.

Restart:

- Show project that needs restart.
- Include suggested restart block.

Slack:

- Show planned load, capacity, and buffer status.

Projects:

- Show compact project list with stage status.

### Level 3 Details

Plan detail:

```text
Project or plan item title
Compact status
One short reason
Editable rows:
- Stage
- Weekly minimum
- Weekly target
- Planned block
Optional action: save adjustment
```

Use pickers, chips, steppers, and sheets. Do not use a traditional form unless the exception is reviewed.

### State Design

Loading:

- Show week balance placeholder and disabled entries.

Empty:

- Show quick-plan state.
- Primary action: create first plan block.

Suggestion available:

- Show suggestion as primary action.

Saved:

- Show compact confirmation.

Error:

- Show one short error.
- Preserve unsaved adjustment if possible.

## 7. Prototype Acceptance Checklist

Before converting the app UX into production frontend code, the HTML prototype must pass this checklist:

- Each main screen follows the Level 1 information budget.
- Level 1 entry points are icon-only by default.
- No Level 1 screen uses a table, full list, or long paragraph.
- No Track screen uses a traditional form.
- Any detail is reachable within two taps from its parent tab.
- Signals applies the priority rule when multiple signals need attention.
- Plan deduplicates review suggestion and restart entry.
- Track includes startup, running, paused, stop, and save states.
- Each screen has loading, empty/no-data, error, and success states where relevant.
- Compact visible labels appear only as reviewed fallbacks.
