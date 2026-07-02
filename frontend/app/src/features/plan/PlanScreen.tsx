import { useEffect, useState } from "react";
import { DetailPanel } from "../../shared/components/DetailPanel";
import { Icon } from "../../shared/icons/Icon";
import { IconButton } from "../../shared/components/IconButton";
import { applySuggestion, dismissSuggestion, savePlanDetail, type PlanState } from "./planModel";
import type { AppWeekViewModel } from "../../shared/api/weeklyReview";
import { createGoal, createProject, createWeeklyPlan } from "../../shared/api/coreRecords";

export type PlanDetail = "suggestion" | "focus" | "slack" | "projects";
type SaveStatus = "idle" | "saved" | "demo" | "error";
type EditableProjectStage = "sprint" | "startup";

interface PlanScreenProps {
  planData: AppWeekViewModel["plan"];
  apiBaseUrl?: string;
  entryRequest: {
    id: number;
    detail: PlanDetail;
  } | null;
}

export function PlanScreen({ apiBaseUrl, planData, entryRequest }: PlanScreenProps) {
  const [plan, setPlan] = useState<PlanState>(planData.initialState);
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [goalTitle, setGoalTitle] = useState("Career");
  const [projectTitle, setProjectTitle] = useState("Resume restart");
  const [projectStage, setProjectStage] = useState<EditableProjectStage>("sprint");
  const [planItemTitle, setPlanItemTitle] = useState("Restart block");
  const [planHours, setPlanHours] = useState(2);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    setPlan(planData.initialState);
  }, [planData.initialState]);

  useEffect(() => {
    if (entryRequest) {
      setDetail(entryRequest.detail);
    }
  }, [entryRequest]);

  function mark(status: SaveStatus) {
    setSaveStatus(status);
    window.setTimeout(() => setSaveStatus("idle"), 1400);
  }

  async function onSaveProjectSetup() {
    setPlan((current) => savePlanDetail(current, { focusProject: projectTitle }));

    if (!apiBaseUrl) {
      mark("demo");
      return;
    }

    const goal = await createGoal({
      apiBaseUrl,
      payload: {
        title: goalTitle,
        priority: 1,
        active_status: true
      }
    });
    const goalId = readId(goal.data);
    if (!goal.ok || goalId === null) {
      mark("error");
      return;
    }

    const project = await createProject({
      apiBaseUrl,
      payload: {
        goal_id: goalId,
        title: projectTitle,
        stage: projectStage,
        weekly_min_minutes: 60,
        weekly_target_minutes: planHours * 60,
        status: "active"
      }
    });

    mark(project.ok ? "saved" : "error");
  }

  async function onSaveWeeklyPlan() {
    setPlan((current) => savePlanDetail(current, { focusProject: projectTitle }));

    if (!apiBaseUrl) {
      mark("demo");
      return;
    }

    const result = await createWeeklyPlan({
      apiBaseUrl,
      payload: {
        week_start: "2026-06-15",
        week_end: "2026-06-21",
        planned_capacity_minutes: 18 * 60,
        slack_target_percent: 20,
        items: [
          {
            title: planItemTitle,
            planned_minutes: planHours * 60,
            priority: 1
          }
        ],
        note: "Planned from Theseus app."
      }
    });

    mark(result.ok ? "saved" : "error");
  }

  return (
    <section className="screen plan-screen">
      <header className="screen-header">
        <IconButton label="Previous" icon="chevronLeft" />
        <div className="screen-title">Jun 15 - Jun 21</div>
        <IconButton label="Next" icon="chevronRight" />
      </header>

      <div className="plan-cover">
        <button className="balance-orb" aria-label="Week balance" onClick={() => setDetail("slack")}>
          <span className="balance-ring">
            <span className="balance-arc green" />
            <span className="balance-arc amber" />
            <span className="balance-core">
              <Icon name="gauge" />
            </span>
          </span>
        </button>

        {plan.suggestionStatus === "available" ? (
          <button className="suggestion-card" aria-label="Review suggestion" onClick={() => setDetail("suggestion")}>
            <span className="suggestion-mark">
              <Icon name="route" />
            </span>
            <span className="suggestion-copy">
              <strong>Resume restart</strong>
              <small>Tue / Thu mornings</small>
            </span>
          </button>
        ) : (
          <button className={`suggestion-card ${plan.suggestionStatus}`} aria-label="Suggestion status" onClick={() => setDetail("suggestion")}>
            <span className="suggestion-mark">
              <Icon name={plan.suggestionStatus === "applied" ? "check" : "x"} />
            </span>
            <span className="suggestion-copy">
              <strong>{plan.suggestionStatus === "applied" ? "Applied" : "Dismissed"}</strong>
              <small>Review suggestion</small>
            </span>
          </button>
        )}

        <div className="plan-entry-grid">
          <button className="plan-entry focus" aria-label="Focus" onClick={() => setDetail("focus")}>
            <Icon name="target" />
          </button>
          <button className="plan-entry slack" aria-label="Slack" onClick={() => setDetail("slack")}>
            <Icon name="gauge" />
          </button>
          <button className="plan-entry projects" aria-label="Projects" onClick={() => setDetail("projects")}>
            <Icon name="folder" />
          </button>
        </div>
      </div>

      <DetailPanel title={detailTitle(detail)} open={detail !== null} onBack={() => setDetail(null)}>
        {detail === "suggestion" ? (
          <div className="detail-stack">
            <span className="status-chip severity-attention">attention</span>
            <h2>Resume restart</h2>
            <p>Protect one small restart block before adding more build work.</p>
            <div className="action-row">
              <button className="paper-action" onClick={() => setPlan((current) => applySuggestion(current))}>
                Apply
              </button>
              <button className="paper-action subtle" onClick={() => setPlan((current) => dismissSuggestion(current))}>
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
        {detail === "focus" ? (
          <div className="detail-stack">
            <h2>{plan.focusProject ?? "Focus"}</h2>
            <label className="paper-field">
              <span>Plan</span>
              <input type="text" value={planItemTitle} aria-label="Planned item" onChange={(event) => setPlanItemTitle(event.currentTarget.value)} />
            </label>
            <label className="paper-field">
              <span>Hours</span>
              <input
                type="number"
                min="1"
                max="12"
                value={planHours}
                aria-label="Planned hours"
                onChange={(event) => setPlanHours(normalizeHours(event.currentTarget.value))}
              />
            </label>
            <dl className="evidence-list">
              <div>
                <dt>Primary</dt>
                <dd>{projectTitle}</dd>
              </div>
              <div>
                <dt>Slack</dt>
                <dd>{plan.slackHours}h</dd>
              </div>
            </dl>
            <button className="paper-action" onClick={onSaveWeeklyPlan}>Save</button>
            {saveStatus !== "idle" ? <span className={`status-chip save-${saveStatus}`}>{saveStatusLabel(saveStatus)}</span> : null}
          </div>
        ) : null}
        {detail === "slack" ? (
          <div className="detail-stack">
            <h2>{plan.slackHours}h slack</h2>
            <dl className="evidence-list">
              <div>
                <dt>Planned</dt>
                <dd>14h</dd>
              </div>
              <div>
                <dt>Capacity</dt>
                <dd>18h</dd>
              </div>
              <div>
                <dt>Buffer</dt>
                <dd>{plan.slackHours}h</dd>
              </div>
            </dl>
            <div className="chip-row">
              {[2, 4, 6].map((hours) => (
                <button key={hours} className={plan.slackHours === hours ? "selected" : ""} onClick={() => setPlan((current) => savePlanDetail(current, { slackHours: hours }))}>
                  {hours}h
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {detail === "projects" ? (
          <div className="detail-stack">
            <label className="paper-field">
              <span>Goal</span>
              <input type="text" value={goalTitle} aria-label="Goal title" onChange={(event) => setGoalTitle(event.currentTarget.value)} />
            </label>
            <label className="paper-field">
              <span>Project</span>
              <input type="text" value={projectTitle} aria-label="Project title" onChange={(event) => setProjectTitle(event.currentTarget.value)} />
            </label>
            <div className="chip-section" aria-label="Stage">
              {(["sprint", "startup"] as const).map((stage) => (
                <button
                  key={stage}
                  className={`choice-chip ${projectStage === stage ? "selected" : ""}`}
                  aria-pressed={projectStage === stage}
                  onClick={() => setProjectStage(stage)}
                >
                  {stage}
                </button>
              ))}
            </div>
            <dl className="evidence-list">
              <div>
                <dt>Stage</dt>
                <dd>{projectStage}</dd>
              </div>
              <div>
                <dt>Target</dt>
                <dd>{planHours}h</dd>
              </div>
            </dl>
            <button className="paper-action" onClick={onSaveProjectSetup}>Save</button>
            {saveStatus !== "idle" ? <span className={`status-chip save-${saveStatus}`}>{saveStatusLabel(saveStatus)}</span> : null}
          </div>
        ) : null}
      </DetailPanel>
    </section>
  );
}

function readId(data: unknown): number | null {
  if (data && typeof data === "object" && "id" in data && typeof data.id === "number") {
    return data.id;
  }
  return null;
}

function saveStatusLabel(status: SaveStatus): string {
  if (status === "saved") return "Saved";
  if (status === "demo") return "Demo";
  return "Error";
}

function normalizeHours(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(12, Math.max(1, Math.round(parsed)));
}

function detailTitle(detail: PlanDetail | null): string {
  if (detail === "suggestion") return "Suggestion";
  if (detail === "focus") return "Focus";
  if (detail === "slack") return "Slack";
  if (detail === "projects") return "Projects";
  return "Plan";
}
