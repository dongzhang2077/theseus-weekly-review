import { useMemo, useState } from "react";
import { DetailPanel } from "../../shared/components/DetailPanel";
import { Icon } from "../../shared/icons/Icon";
import { Sheet } from "../../shared/components/Sheet";
import { choosePrioritySignal, sortSignalEvidence, type SignalEvidence, type SignalId, type SignalSummary } from "./signalModel";

const signals: SignalSummary[] = [
  {
    id: "plan",
    label: "Plan",
    severity: "attention",
    status: "Drift",
    reason: "Planned work shifted away from resume restart."
  },
  {
    id: "stage",
    label: "Stage",
    severity: "severe",
    status: "Dormant",
    reason: "A restart project stayed inactive this week."
  },
  {
    id: "goal",
    label: "Goal",
    severity: "normal",
    status: "Aligned",
    reason: "Backend work still supports the MVP goal."
  },
  {
    id: "energy",
    label: "Energy",
    severity: "attention",
    status: "Thin",
    reason: "Recovery time is lower than planned focus time."
  }
];

const evidenceBySignal: Record<SignalId, SignalEvidence[]> = {
  stage: [
    {
      id: "resume-dormant",
      title: "Resume dormant",
      severity: "severe",
      reason: "The project was planned, then received no active block.",
      rows: [
        { label: "Planned", value: "2h" },
        { label: "Logged", value: "0m" },
        { label: "Inactive", value: "6d" }
      ],
      action: "Plan"
    },
    {
      id: "backend-healthy",
      title: "Backend healthy",
      severity: "normal",
      reason: "Core API work continued with usable evidence.",
      rows: [
        { label: "Logged", value: "7h" },
        { label: "Stage", value: "Build" },
        { label: "Evidence", value: "4" }
      ]
    }
  ],
  plan: [
    {
      id: "plan-drift",
      title: "Plan drift",
      severity: "attention",
      reason: "Backend moved forward, but restart work fell out of the week.",
      rows: [
        { label: "Backend", value: "+1h" },
        { label: "Resume", value: "-2h" },
        { label: "Review", value: "Done" }
      ],
      action: "Plan"
    }
  ],
  goal: [
    {
      id: "goal-aligned",
      title: "Goal aligned",
      severity: "normal",
      reason: "The strongest work still supports the demo path.",
      rows: [
        { label: "MVP", value: "On" },
        { label: "Docs", value: "Light" },
        { label: "Scope", value: "Clear" }
      ]
    }
  ],
  energy: [
    {
      id: "energy-thin",
      title: "Energy thin",
      severity: "attention",
      reason: "Recovery blocks are present, but not enough to offset build work.",
      rows: [
        { label: "Focus", value: "8h" },
        { label: "Restore", value: "1h" },
        { label: "Load", value: "High" }
      ]
    }
  ]
};

const iconBySignal: Record<SignalId, "route" | "target" | "gauge" | "leaf"> = {
  plan: "route",
  stage: "gauge",
  goal: "target",
  energy: "leaf"
};

export function SignalsScreen() {
  const priority = useMemo(() => choosePrioritySignal(signals), []);
  const [activeSignal, setActiveSignal] = useState<SignalId | null>(null);
  const [activeDetail, setActiveDetail] = useState<SignalEvidence | null>(null);
  const rows = activeSignal ? sortSignalEvidence(evidenceBySignal[activeSignal]) : [];

  return (
    <section className="screen signals-screen">
      <header className="screen-header">
        <div className="screen-title">Signals</div>
      </header>

      <div className={`signal-orbit severity-${priority.severity}`} aria-label={priority.status}>
        <Icon name={iconBySignal[priority.id]} />
        <div className="signal-status">{priority.status}</div>
      </div>

      <div className="signal-grid" aria-label="Signal types">
        {signals.map((signal) => (
          <button
            key={signal.id}
            className={`signal-entry severity-${signal.severity} ${priority.id === signal.id ? "priority" : ""}`}
            aria-label={`${signal.label}: ${signal.status}`}
            onClick={() => setActiveSignal(signal.id)}
          >
            <Icon name={iconBySignal[signal.id]} />
            <span>{signal.label}</span>
          </button>
        ))}
      </div>

      <Sheet title={activeSignal ? signals.find((signal) => signal.id === activeSignal)?.label ?? "Signals" : "Signals"} open={activeSignal !== null} onClose={() => setActiveSignal(null)}>
        <div className="sheet-list">
          {rows.map((row) => (
            <button key={row.id} className={`list-row severity-${row.severity}`} onClick={() => setActiveDetail(row)}>
              <span>
                <strong>{row.title}</strong>
                <small>{row.reason}</small>
              </span>
              <Icon name="chevronRight" />
            </button>
          ))}
        </div>
      </Sheet>

      <DetailPanel title={activeDetail?.title ?? "Signal"} open={activeDetail !== null} onBack={() => setActiveDetail(null)}>
        {activeDetail ? (
          <div className="detail-stack">
            <span className={`status-chip severity-${activeDetail.severity}`}>{activeDetail.severity}</span>
            <p>{activeDetail.reason}</p>
            <dl className="evidence-list">
              {activeDetail.rows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
            {activeDetail.action ? <button className="paper-action">{activeDetail.action}</button> : null}
          </div>
        ) : null}
      </DetailPanel>
    </section>
  );
}
