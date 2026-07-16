# Theseus App UX Spec

This document defines the app-first UX structure for the Theseus demo and later frontend implementation. It is intentionally about information architecture and interaction flow, not visual styling or code.

Related visual direction lives in `docs/design/style-reference.md`.
Screen-level wireframe details live in `docs/design/app-screen-wireframes.md`.
Component-level constraints live in `docs/design/app-component-contract.md`.
App visual tokens and style rules live in `docs/design/app-visual-system.md`.

## 1. Demo Position

The app experience is the primary demo surface. The existing wide web dashboard layout must not be used as the main presentation surface.

Theseus should feel like a personal weekly-review app with time evidence, not a horizontal admin dashboard.

## 2. Core User

The core user is a person balancing study, project work, job search, and recovery. They do not want a dense analytics dashboard. They want to know:

- How did this week go?
- What needs attention?
- Why did the app reach that conclusion?
- How can I capture time with low effort?
- What should change next week?

## 3. Core Product Model

The app has four conceptual tabs:

- Review: this week's feedback.
- Signals: why the app reached that feedback.
- Track: raw behavior capture and time tracking.
- Plan: next-week adjustment.

Bottom navigation should use icons. Visible tab text is not required in the final app UI, but each icon must have an accessible name.

Level 1 entry points are icon-only by default. Compact visible labels are a fallback after manual review or user testing shows that an icon is unclear. If a fallback label is added, it may only name the entry point; it must not explain the feature.

## 4. Information Layering

Every screen must separate glance information from detail information.

### Level 1: Glance

The first screen state. It should show only direction, state, and main entry points.

Rules:

- Use icon-first entry points.
- Avoid visible explanatory copy.
- Avoid long generated review text.
- Avoid complete tables and full lists.
- Show at most 4 to 6 primary information blocks.
- Prefer status symbols, small marks, and compact values.

### Level 2: Section

Opened after one tap. It shows a chapter, section, or picker.

Allowed content:

- Short lists.
- Compact labels.
- Section-level summaries.
- Pickers and bottom sheets.

### Level 3: Detail

Opened after two taps at most. It can show specific evidence, reasons, raw records, notes, or editing controls.

Rules:

- No flow may go deeper than Level 3.
- Any specific evidence, note, project setting, or log detail must be reachable within two taps from its parent tab.
- If a flow appears to need more levels, merge intermediate steps or use a bottom sheet.

## 5. Global Navigation

Primary navigation:

```text
Review | Signals | Track | Plan
```

Implementation note: final UI should use icons for these entries. Text labels may be hidden visually but must remain available to assistive technology.

Global top bars should be compact. Do not add permanent utility actions unless they are needed for the current state.

## 6. Review Screen

### Purpose

Review is the app's weekly cover page. It should give the user a quick emotional and practical read of the week, then let them open review chapters.

It is not a report body, dashboard, evidence table, or plan editor.

### User Questions

- How did this week go?
- Is there anything I should pay attention to?
- What is the short story of this week?
- Where can I open the review chapters?

### Level 1 Glance Content

Header:

```text
<        Jun 8 - Jun 14        >
```

- Left arrow: previous week.
- Right arrow: next week.
- Center: date range only.
- Do not show a permanent refresh action.

Main state:

- A hand-drawn or app-native status character.
- A small status mark.
- No default long status paragraph.

Chapter icons:

- Wins icon.
- Risks icon.
- Full review icon.

Bottom navigation:

- Review.
- Signals.
- Track.
- Plan.

### Level 1 Must Not Show

- Full generated review text.
- Complete wins list.
- Complete risks list.
- Next action as a separate homepage module.
- Evidence shortcut.
- Numeric badges after module names.
- Plan vs actual table.
- Activity details.
- Project details.
- Product explanation copy.
- Permanent refresh button.

### Level 2 Sections

Tap status character:

- Show a short speech bubble in second person.
- Example: "You moved Theseus forward, but your resume work needs a restart."
- Keep it short enough to feel like app feedback, not report text.

Tap wins icon:

- Open Wins chapter.
- Show short wins list.

Tap risks icon:

- Open Risks chapter.
- Show short risks list.

Tap full review icon:

- Open Full Review chapter.
- The review can include generated narrative text.
- Suggested next adjustment belongs at the end of this chapter.

### Level 3 Details

Tap a win or risk:

- Show related reason and evidence.
- Example fields for a risk detail:
  - Project name.
  - Logged versus planned time.
  - Inactive days.
  - Weekly minimum.
  - Short reason.

### Next Action Placement

Next action is not a first-screen module. It appears near the end of Full Review and can later connect directly to Plan.

Flow:

```text
Full Review -> Suggested adjustment -> Plan detail
```

## 7. Signals Screen

### Purpose

Signals explains why the app reached its review conclusion. It should not duplicate Track.

Signals is interpreted data. Track is raw behavior data.

### User Questions

- Why did the app say this week needs attention?
- Which structural signal matters most?
- Is the issue plan drift, project stage, goal alignment, or energy balance?
- Where should I adjust next?

### Level 1 Glance Content

Header:

```text
Signals
```

Main state:

- One evidence-ranked priority signal with its identity, compact status, and one
  concrete reason.
- Four aligned summary rows in the stable order Plan, Stage, Goal, and Energy.
- Each row combines a line icon, visible signal label, compact status text, and
  an optional status mark.
- Green means normal, amber means attention, red means severe risk, and gray
  means no data. Color and marks reinforce the written status; they never
  replace it.
- Preserve the Warm Stationery paper, muted palette, restrained borders, and
  line-icon language. Do not use a decorative orbit, static severity dots, or
  arbitrary card rotation as evidence.

### Level 1 Must Not Show

- Raw time log list.
- Timer.
- Today's records.
- Full evidence tables.
- Long explanations.
- Generated review text.
- JSON evidence.
- Large numeric badges.

### Signal Meanings

Plan:

- Plan versus actual.
- Under-plan or over-plan signals.
- Answers: did the user follow the plan?

Stage:

- Project stage health.
- Wake-up, dormant, drift, maintenance, healthy, or overheated signals.
- Answers: are projects in a healthy lifecycle state?

Goal:

- Whether actual time supported important goals.
- Answers: did time support priorities?

Energy:

- Activity type balance.
- Consuming, restore, neutral, and destroy patterns.
- Answers: did activity mix support a sustainable week?

### Level 2 Sections

Tap the priority signal or a summary row:

- Open that signal chapter.
- Show a short list of affected projects, goals, or activity categories.
- Use compact statuses.

Example Stage chapter:

```text
Resume        Wake-up
Frontend      Drift
Backend       Maintenance
```

### Level 3 Details

Tap a specific signal row:

- Show the concrete evidence behind that signal.
- Example:
  - Project name.
  - Actual minutes.
  - Planned minutes.
  - Inactive days.
  - Stage threshold.
  - Short reason.

## 8. Track Screen

### Purpose

Track is the future time tracker and low-friction raw behavior capture surface.

It should avoid traditional forms.

### User Questions

- Am I tracking time now?
- How long has the current session been running?
- Which project and activity type is this for?
- How do I start, pause, stop, or save quickly?
- What did I record today?

### Level 1 Glance Content

Header:

```text
Today
```

Main state:

- Timer state symbol or character.
- Large active timer.
- Current project icon.
- Current activity type icon.
- Primary play, pause, or stop control.
- Compact today-total indicator.

### Level 1 Must Not Show

- Traditional forms.
- Label/input stacks.
- Submit button.
- Full log history.
- Full editing fields.
- Review risks.
- Evidence signals.
- Project health.
- Plan versus actual.

### Required Interaction Model

Allowed controls:

- Icon grid.
- Picker.
- Bottom sheet.
- Segmented control.
- Chips.
- Stepper.
- Swipe action.
- Optional note sheet.

Disallowed controls on the main screen:

- Project select form.
- Activity type select form.
- Start-time input.
- End-time input.
- Duration input.
- Textarea.
- Submit form.

### Level 2 Sections

Tap project icon:

- Open project picker.

Tap activity type icon:

- Open activity type picker.

Tap today-total indicator:

- Open Today's Logs.

Tap current timer area:

- Open current session controls if needed.

### Level 3 Details

Tap a log:

- Open log detail sheet.
- Show:
  - Activity name.
  - Time range.
  - Duration.
  - Project.
  - Activity type.
  - Note row.
  - Delete action if needed.

Editing should use rows, chips, pickers, and sheets, not a traditional form.

## 9. Plan Screen

### Purpose

Plan turns review feedback into next-week adjustment. It is not a full project-management system.

### User Questions

- What should I focus on next week?
- Which project needs restart?
- Is next week too full?
- Did I leave enough slack?
- Can I apply the review suggestion to my plan?

### Level 1 Glance Content

Header:

```text
Jun 15 - Jun 21
```

Main state:

- One compact week-balance surface showing written status, planned load,
  capacity, and slack from the selected user's data.
- One evidence-linked suggested adjustment, when the review produced one.
  Show the target project and signed time change; keep the concrete reason to
  one short sentence.

Primary icon entries:

- Focus project.
- Slack or capacity.
- Projects.

The balance indicator must be computed from the current plan. Do not use a
static ring or decorative segments that look like plan evidence.

### Level 1 Must Not Show

- Full planned-items table.
- Full task list.
- Goal/project CRUD surface.
- Weekly minimum fields.
- Weekly target fields.
- Capacity input.
- Dense project settings.
- Long explanation text.

### Level 2 Sections

Tap focus:

- Show next-week focus.
- Include target block or target hours only if needed.

Tap restart:

- Show project that needs restart.
- Include suggested restart block.

Tap slack:

- Show planned load, capacity, and buffer status.

Tap projects:

- Show compact project list with stage status.

Tap apply suggestion:

- Open suggested adjustment from Review.
- Show project time, total planned time, and slack before and after.
- Apply replaces one complete user-scoped weekly plan; a newly created plan can
  be undone.
- Show compact saving, saved, conflict, error, retry, and restored states.

### Level 3 Details

Tap a project or plan item:

- Show project or plan-item detail.
- Allow stage, minimum, target, or planned block adjustment using pickers, chips, steppers, or bottom sheets.

Do not use a traditional form unless a later implementation has a strong reason and a reviewed exception.

## 10. Cross-Screen Flows

Primary demo path:

```text
Review -> Signals -> Track -> Plan -> Review
```

Review risk flow:

```text
Review -> Risks chapter -> Risk detail
```

Review-to-plan flow:

```text
Full Review -> Suggested adjustment -> Plan detail
```

Signals explanation flow:

```text
Signals -> Signal chapter -> Signal detail
```

Tracking flow:

```text
Track -> Start timer -> Stop timer -> Today logs -> Log detail
```

Planning flow:

```text
Plan -> Restart project -> Project detail
```

## 11. State Requirements

Each main screen must define:

- Loading state.
- Empty state.
- Error state.
- No-data state.
- Success or saved state where relevant.

State UI should be short and app-like. Do not add product explanation paragraphs.

## 12. Prototype Requirements

Before production frontend work:

- Build an app-sized HTML prototype.
- Use mobile-first vertical layout.
- Use icon-first navigation and entry points.
- Validate that each screen follows the Level 1, Level 2, Level 3 rule.
- Review the prototype manually before implementing app code.

The prototype is allowed to be static. Its goal is to validate UX structure, not backend integration.

## 13. Non-Goals

Do not use the wide web dashboard as the primary demo surface.

Do not build:

- Marketing home page.
- Desktop-first dashboard.
- Traditional time-entry form.
- Dense project-management tool.
- Evidence JSON viewer.
- Full task manager.
- Deep drill-down navigation.

## 14. Hard UX Constraints

- No emoji.
- Icon-first controls.
- No permanent text-heavy modules on Level 1 screens.
- No visible explanation copy on main screens.
- No tables on Level 1 screens.
- No full review text on the Review Level 1 screen.
- No full logs on the Track Level 1 screen.
- No full task list on the Plan Level 1 screen.
- Maximum depth is three levels.
- Any detailed information must be reachable within two taps from its parent tab.
