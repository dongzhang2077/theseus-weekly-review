CSIS 4495 - 071 Progress Report 1
Theseus: Weekly AI Review for Goal-Time Alignment

| Item | Information |
| --- | --- |
| Team name | Zisyphuz |
| Team members | Dong Zhang; Zhi Kang |
| Instructor | Michael Ma |
| Submission date | June 15, 2026 |
| Current status | Sprint 0 complete; Sprint 1 starts with backend persistence. |



# 1. Project Update Since Proposal

Theseus remains a weekly AI review system for goal-time alignment. The project direction has not changed since the proposal. The system is designed to help users review whether their actual weekly time supported their important goals.
The core problem is that users often make weekly plans, but they do not always clearly review whether actual time went to the most important work. Theseus focuses on the completed week and produces a supportive review based on evidence from goals, weekly plans, actual time logs, activity-impact labels, and optional reflections.
For the course MVP, Theseus is not a calendar replacement, task manager, automatic scheduler, wearable-dependent system, mobile sync product, or mental health diagnosis tool. It remains focused on one review loop:
goals + weekly plan + actual time logs + activity labels + optional reflection -> evidence checks -> weekly review -> realistic next-week adjustment
Since the proposal submission, the team completed Sprint 0. The main result is not a finished product, but a buildable and trackable project foundation for Sprint 1 development.

| Progress Area | Current Status | Meaning |
| --- | --- | --- |
| Proposal baseline | Complete | The proposal defines the problem, target users, research basis, MVP boundary, architecture direction, timeline, and AI usage documentation. |
| Sprint 0 foundation | Complete | The repository, documentation, sample data, local demo, and evaluation rubric are ready for Sprint 1. |
| Sprint 1 backend persistence | Next | The next development focus is SQLite schema, repository layer, CRUD APIs, sample loader, and stored weekly review path. |



# 2. Current Deliverables and GitHub Progress

Sprint 0 deliverables are foundation deliverables. They make the project easier to develop, track, and verify in the next sprint.
- GitHub repository structure with backend, frontend, review_engine, docs, data, and evaluation folders.
- README and project map describing project purpose, MVP scope, repository structure, and quick-start path.
- Core documentation: project charter, product requirements, system architecture, data model, API contract, review-engine design, agile delivery plan, backlog, decision log, GitHub workflow, and architectural runway.
- FastAPI backend skeleton with /health and /reviews/weekly/analyze routes.
- Pydantic schemas for goals, projects, weekly plans, planned items, time logs, daily reflections, and weekly review requests.
- Sample weekly data file at data/sample/sample_week.json.
- Local review-engine demo using scripts/run_sample_review.py.
- Review quality rubric for later evaluation.
- GitHub issues and project tracking for engineering tasks and course deliverables.

| Current Item | Status | Notes |
| --- | --- | --- |
| Backend skeleton | Exists | FastAPI skeleton exists with health and weekly review analyze routes. |
| Local review demo | Working locally | The sample week can be analyzed by the rule-based review engine. |
| SQLite persistence | Not started | Planned for Sprint 1; the current demo does not store data. |
| CRUD APIs | Not started | Planned for Sprint 1. |
| Frontend review page | Planned | Planned after the backend persistence path becomes stable. |



# 3. Technical Evidence from Current Demo

The local demo shows that the current review logic can process a sample week and produce structured review output. It does not yet show database persistence or frontend integration.
The demo can be run with: python3 scripts/run_sample_review.py

| Demo Step | Current Evidence |
| --- | --- |
| Input | data/sample/sample_week.json |
| Review function | review_engine.rules.analyze_week |
| Output fields | wins, insights, risk_flags, next_steps, evidence, generated_text |
| Current limitation | Working locally; not persisted yet. |



| Output Type | Example from Current Sample |
| --- | --- |
| Win | Theseus backend received 4.0 hours. |
| Insight | Build Theseus MVP received 5.0 hours of goal-linked work. |
| Risk flag | Internship preparation received 0 goal-linked minutes. |
| Next step | Protect one small restart block instead of adding a large task dump. |



# 4. Issues, Assumptions, and Actions Taken After Proposal

The team kept the product direction stable after the proposal. The main action after the proposal was to translate the planned MVP into safe implementation steps and avoid overstating current progress.

| Issue or Assumption | Risk | Action Taken |
| --- | --- | --- |
| Implementation size | Trying to build scheduling, mobile sync, wearable integration, and AI review at the same time would make the first engineering sprint too large. | Keep Sprint 1 focused on backend persistence and the weekly review data path. |
| AI output may be vague | Raw AI advice may become generic if it is not tied to evidence. | Use deterministic evidence checks first; AI wording and LLM polish come later. |
| Input logs may be incomplete | Low-quality logs can make review output misleading. | Start with clean sample weeks, validation rules, and repeatable local demo data. |
| Feedback tone may feel negative | A review that only lists missed tasks may feel blaming. | Use win -> insight -> next step structure with positive recognition. |
| Progress may be misunderstood | A local demo could be mistaken for a complete persisted backend. | State the boundary clearly: local demo works, but persistence is not complete yet. |



# 5. Sprint 1 Plan and Sprint Rhythm

Sprint 1 starts after Progress Report 1 and focuses on backend persistence. The target is to move from the current local sample-file path to a persisted backend path:
sample_week.json -> SQLite -> review_engine -> stored weekly_review
Planned Sprint 1 tasks:
- Implement SQLite schema for goals, projects, activities, weekly plans, planned items, time logs, daily reflections, and weekly reviews.
- Add a repository layer so SQL stays out of FastAPI route handlers.
- Implement CRUD APIs for Sprint 1 entities.
- Build a sample data loader that imports sample_week.json into SQLite.
- Harden the review engine for database-loaded records.
- Add persisted weekly review orchestration.
- Add a verification script for sample data -> stored review.

| Phase | Focus | Status | Main Deliverable |
| --- | --- | --- | --- |
| Sprint 0 | Foundation | Complete | Proposal submitted; MVP documented; repository and docs prepared; local review demo working. |
| Sprint 1 | Backend persistence | Next | SQLite schema, repository layer, CRUD APIs, sample loader, and stored review path. |
| Sprint 2 | Review hardening + frontend preparation | Planned | More sample weeks, stronger rules, review output polish, and frontend preparation. |
| Sprint 3 | Frontend prototype | Planned | Input flow and weekly review page connected to backend APIs. |
| Sprint 4 | Evaluation + polish | Planned | Rubric testing, classmate feedback, revisions, and final report support. |
| Final | Defense package | Planned | Prototype, validation summary, final presentation, final report, and AI usage documentation. |



# 6. Evaluation Plan

The evaluation will test MVP review quality, not long-term behavior change. The team will check whether generated weekly reviews are accurate, useful, realistic, supportive, and evidence-backed.

| Quality Dimension | Meaning |
| --- | --- |
| Factual accuracy | The review should match the logs and plans. |
| Goal relevance | Insights should connect back to stated goals. |
| Positive recognition | The review should notice completed work, maintenance work, or recovery. |
| Actionability | Next steps should be specific and realistic. |
| Restraint | The review should avoid overloading the next week. |
| Risk detection | The review should flag drift, dormancy, or slack risk without blaming the user. |
| Evidence support | Claims should be tied to visible input data or rule checks. |


Planned validation process:
- Prepare 3-5 sample weekly records.
- Run each sample through the review engine.
- Score generated reviews using the review quality rubric.
- Collect limited feedback from 2-3 classmates.
- Revise rules and wording based on findings.

# Appendix A: AI Usage Report and Documentation

AI tools were used as support, not as final authority. AI supported planning, drafting, document review, slide refinement, speaker-script preparation, and wording. Final scope decisions, technical claims, citations, screenshots, repository status, and presentation content were checked by the team.

## A.1 AI Tools and Models Used

The team utilized the following AI tools and models during Sprint 0:
* **Gemini 3.5 Flash / Pro (via API & Chat Interfaces):** Used for project planning, structural drafting of markdown documents (Requirements, API contracts), Pydantic schema generation, and refinement of presentation slides.
* **Claude 3.5 Sonnet (via IDE Extensions):** Assisted in code architecture skeletons, rule engine logic validation, and Python scripting for sample review executions.

## A.2 AI-Assisted Work and Prompts

The following table summarizes the AI-assisted activities, the prompts utilized, and their corresponding outputs:

| AI-Assisted Area | Prompts / Instructions Used | Output Used & Iteration |
| --- | --- | --- |
| **Proposal Review & Scope** | "Analyze our project proposal for Theseus Weekly Review. Extract core requirements, define a strict MVP boundary for a course project, and outline a modular architecture." | Formulated the Project charter and product requirements. Hand-edited to remove wearable/calendar integrations. |
| **Pydantic Schema Design** | "Generate Pydantic v2 schemas in Python representing Theseus entities: Goal, Project, WeeklyPlan, PlannedItem, TimeLog, DailyReflection. Keep it clean and self-contained." | Integrated into `backend/app/schemas.py`. Human developers added priority constraints and literal stage mappings. |
| **Rules Engine Logic** | "Draft a Python function `analyze_week(payload)` that runs deterministic checks for goal alignment, plan-vs-actual drift, activity energy mix, capacity slack, and dormancy." | Formed the core of `review_engine/rules.py`. Refined by humans to add 21-day dormancy rules and custom slack algorithms. |
| **Presentation Slides** | "Review slides/progress_report_1.html. Suggest how to restructure slide text to be extremely concise, focus on completed Sprint 0 milestones, and fit a 5-minute talk." | Refined presentation deck layouts, visual structure, and slide notes. |
| **Speaker Script Support** | "Write a 5-minute presenter script for a technical progress update based on our Progress Report 1 slides. Highlight our 'evidence first, AI wording second' design choice." | Formed the draft for `slides/progress_report_1_script.md` and minimal speaker script. |

## A.3 Human Verification and Testing

To ensure absolute factual accuracy and compliance with course goals, the team implemented a multi-stage verification process:
1. **Code Execution & Testing:** The AI-assisted rules in `review_engine/rules.py` were tested using `scripts/run_sample_review.py` against a repeatable fixture (`sample_week.json`). The team verified that no rules produced unexpected edge cases (e.g., divide-by-zero on 0 planned capacity).
2. **Technical Boundary Checking:** Wording was manually reviewed to ensure Sprint 1 tasks (like SQLite schema, CRUD API persistence, and frontend pages) are clearly stated as "Planned" or "In progress," avoiding any false claims about completed work.
3. **Course Deliverable Alignment:** The output structure and agile delivery roadmaps were checked against the CSIS 4495 progress report rubrics to verify that all required sections were fully covered.

## A.4 Estimated Contributions

| Module / Asset | AI-Drafted % | Human-Refined % | Verification Method |
| --- | --- | --- | --- |
| **Project Documentation** | 60% | 40% | Manual cross-check against course rubrics |
| **Pydantic Schemas** | 70% | 30% | API contract verification & type checking |
| **Rules Engine Logic** | 40% | 60% | Local execution and boundary condition unit tests |
| **Presentation Slide Deck** | 50% | 50% | Dry-run presentation timing checks (under 5 mins) |
| **Project Backlog & Issues** | 40% | 60% | GitHub issue board mapping & sprint alignment |