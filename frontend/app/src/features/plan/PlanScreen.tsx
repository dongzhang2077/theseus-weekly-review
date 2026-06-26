import { useState } from "react";
import { DetailPanel } from "../../shared/components/DetailPanel";
import { Icon } from "../../shared/icons/Icon";
import { IconButton } from "../../shared/components/IconButton";
import { Sheet } from "../../shared/components/Sheet";
import { applySuggestion, dismissSuggestion, savePlanDetail, type PlanState } from "./planModel";

const initialPlan: PlanState = {
  suggestionStatus: "available",
  focusProject: "Backend MVP",
  slackHours: 1,
  savedAt: null
};

type PlanDetail = "suggestion" | "focus" | "slack" | "projects";

export function PlanScreen() {
  const [plan, setPlan] = useState(initialPlan);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detail, setDetail] = useState<PlanDetail | null>(null);

  return (
    <section className="screen plan-screen">
      <header className="screen-header">
        <IconButton label="Previous" icon="chevronLeft" />
        <div className="screen-title">Jun 15 - Jun 21</div>
        <IconButton label="Next" icon="chevronRight" />
      </header>

      <div className="plan-cover">
        <div className="balance-orb">
          <Icon name="leaf" />
        </div>
        <div className="plan-pill">
          <span />
          {plan.slackHours}h slack
        </div>
      </div>

      <div className="plan-entry-list">
        {plan.suggestionStatus === "available" ? (
          <button className="paper-entry priority" onClick={() => setDetail("suggestion")}>
            <Icon name="route" />
            <span>Restart</span>
            <Icon name="chevronRight" />
          </button>
        ) : null}
        <button className="paper-entry" onClick={() => setDetail("focus")}>
          <Icon name="target" />
          <span>Focus</span>
          <Icon name="chevronRight" />
        </button>
        <button className="paper-entry" onClick={() => setDetail("slack")}>
          <Icon name="leaf" />
          <span>Slack</span>
          <Icon name="chevronRight" />
        </button>
        <button className="paper-entry" onClick={() => setDetail("projects")}>
          <Icon name="folder" />
          <span>Projects</span>
          <Icon name="chevronRight" />
        </button>
      </div>

      <Sheet title="Plan" open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <div className="sheet-list">
          <button className="list-row" onClick={() => setDetail("focus")}>
            <span>
              <strong>{plan.focusProject ?? "Focus"}</strong>
              <small>Primary block</small>
            </span>
            <Icon name="chevronRight" />
          </button>
          <button className="list-row" onClick={() => setDetail("slack")}>
            <span>
              <strong>{plan.slackHours}h slack</strong>
              <small>Capacity</small>
            </span>
            <Icon name="chevronRight" />
          </button>
        </div>
      </Sheet>

      <DetailPanel title={detailTitle(detail)} open={detail !== null} onBack={() => setDetail(null)}>
        {detail === "suggestion" ? (
          <div className="detail-stack">
            <span className="status-chip severity-attention">attention</span>
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
            <p>{plan.focusProject ?? "Choose one focus project."}</p>
            <button className="paper-action" onClick={() => setPlan((current) => savePlanDetail(current, { focusProject: "Frontend polish" }))}>
              Save
            </button>
          </div>
        ) : null}
        {detail === "slack" ? (
          <div className="detail-stack">
            <div className="chip-row">
              {[1, 2, 3].map((hours) => (
                <button key={hours} className={plan.slackHours === hours ? "selected" : ""} onClick={() => setPlan((current) => savePlanDetail(current, { slackHours: hours }))}>
                  {hours}h
                </button>
              ))}
            </div>
            <button className="paper-action" onClick={() => setPlan((current) => savePlanDetail(current, { slackHours: current.slackHours }))}>
              Save
            </button>
          </div>
        ) : null}
        {detail === "projects" ? (
          <div className="detail-stack">
            <dl className="evidence-list">
              <div>
                <dt>Backend</dt>
                <dd>Build</dd>
              </div>
              <div>
                <dt>Resume</dt>
                <dd>Restart</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </DetailPanel>
    </section>
  );
}

function detailTitle(detail: PlanDetail | null): string {
  if (detail === "suggestion") return "Restart";
  if (detail === "focus") return "Focus";
  if (detail === "slack") return "Slack";
  if (detail === "projects") return "Projects";
  return "Plan";
}
