import { useMemo, useState } from "react";
import { DetailPanel } from "../../shared/components/DetailPanel";
import { Icon } from "../../shared/icons/Icon";
import { Sheet } from "../../shared/components/Sheet";
import { choosePrioritySignal, sortSignalEvidence, type SignalEvidence, type SignalId, type SignalSummary } from "./signalModel";
import { demoWeek } from "../../shared/demo/demoWeek";

const signals: SignalSummary[] = demoWeek.signals.summaries;

const evidenceBySignal: Record<SignalId, SignalEvidence[]> = {
  stage: [],
  plan: [],
  goal: [],
  energy: []
};

for (const evidence of demoWeek.signals.evidence) {
  const { signalId, ...signalEvidence } = evidence;
  evidenceBySignal[signalId].push(signalEvidence);
}

const iconBySignal: Record<SignalId, "calendar" | "target" | "layers" | "leaf"> = {
  plan: "calendar",
  stage: "layers",
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
        <div className="orbit-visual" aria-hidden="true">
          <span className="orbit-line one" />
          <span className="orbit-line two" />
          <span className="orbit-core">
            <Icon name={iconBySignal[priority.id]} />
          </span>
          <span className="orbit-dot red" />
          <span className="orbit-dot amber" />
          <span className="orbit-dot green" />
        </div>
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
