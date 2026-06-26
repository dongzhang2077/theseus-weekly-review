import { useEffect, useState } from "react";
import { DetailPanel } from "../../shared/components/DetailPanel";
import { Icon } from "../../shared/icons/Icon";
import { IconButton } from "../../shared/components/IconButton";
import { applySuggestion, dismissSuggestion, savePlanDetail, type PlanState } from "./planModel";
import { demoWeek } from "../../shared/demo/demoWeek";

const initialPlan: PlanState = demoWeek.plan.initialState;

export type PlanDetail = "suggestion" | "focus" | "slack" | "projects";

interface PlanScreenProps {
  entryRequest: {
    id: number;
    detail: PlanDetail;
  } | null;
}

export function PlanScreen({ entryRequest }: PlanScreenProps) {
  const [plan, setPlan] = useState(initialPlan);
  const [detail, setDetail] = useState<PlanDetail | null>(null);

  useEffect(() => {
    if (entryRequest) {
      setDetail(entryRequest.detail);
    }
  }, [entryRequest]);

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
            <dl className="evidence-list">
              <div>
                <dt>Primary</dt>
                <dd>Frontend</dd>
              </div>
              <div>
                <dt>Support</dt>
                <dd>Backend</dd>
              </div>
            </dl>
            <button className="paper-action" onClick={() => setPlan((current) => savePlanDetail(current, { focusProject: "Frontend polish" }))}>
              Save
            </button>
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
            <dl className="evidence-list">
              <div>
                <dt>Frontend</dt>
                <dd>Polish</dd>
              </div>
              <div>
                <dt>Resume</dt>
                <dd>Restart</dd>
              </div>
              <div>
                <dt>Backend</dt>
                <dd>Build</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </DetailPanel>
    </section>
  );
}

function detailTitle(detail: PlanDetail | null): string {
  if (detail === "suggestion") return "Suggestion";
  if (detail === "focus") return "Focus";
  if (detail === "slack") return "Slack";
  if (detail === "projects") return "Projects";
  return "Plan";
}
