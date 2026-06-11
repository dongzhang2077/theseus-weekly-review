# Project Charter

## Project Name

Theseus: Weekly AI Review for Goal-Time Alignment

## Team

- Team name: Zisyphuz
- Course: CSIS 4495 Applied Research Project
- Team members: Dong Zhang, Zhi Kang

## Problem

Many students and knowledge workers make weekly plans, but they do not consistently review whether their actual time supported their most important goals. They may feel busy while important projects receive little or no attention. Existing tools usually focus on task planning, calendar scheduling, or time tracking. Theseus focuses on the review layer after execution.

## Product Vision

Theseus helps users understand the completed week in a clear and supportive way. It shows what went well, what patterns appeared, what risks need attention, and what small adjustment would make the next week more realistic.

## MVP Objective

Build a working prototype that can:

1. Accept goals, projects, weekly plans, time logs, activity types, and optional reflection notes.
2. Analyze goal-time alignment, plan-vs-actual gaps, activity energy-impact mix, slack risk, and dormancy risk.
3. Generate a weekly review in a positive `win`, `insight`, `next_step` format.
4. Store and evaluate the review result using a clear quality rubric.

## Success Criteria

The MVP is successful if:

- It can generate weekly reviews from 3-5 sample weekly datasets.
- The review matches the input data factually.
- The review connects findings to the user's goals.
- The review identifies positive progress, not only failure.
- The next-week suggestions are realistic and restrained.
- 2-3 external users can understand the review and rate it as useful.

## Constraints

- The course timeline is short.
- The MVP should not depend on wearable data or automatic calendar access.
- The user remains the final decision maker.
- The system should avoid punitive or judgmental wording.

