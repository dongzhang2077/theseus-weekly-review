import { useMemo, useState } from "react";
import { DetailPanel } from "../../shared/components/DetailPanel";
import { Sheet } from "../../shared/components/Sheet";
import { StateSurface } from "../../shared/components/StateSurface";
import { Icon } from "../../shared/icons/Icon";
import type { AppWeekViewModel } from "../../shared/api/weeklyReview";
import {
  choosePrioritySignal,
  orderSignalSummaries,
  sortSignalEvidence,
  type SignalEvidence,
  type SignalId,
  type SignalSeverity,
  type SignalSummary
} from "./signalModel";

const iconBySignal: Record<SignalId, "calendar" | "target" | "layers" | "leaf"> = {
  plan: "calendar",
  stage: "layers",
  goal: "target",
  energy: "leaf"
};

interface SignalsScreenProps {
  signals: AppWeekViewModel["signals"];
  onPlan: () => void;
  onTrack: () => void;
}

export function SignalsScreen({ signals, onPlan, onTrack }: SignalsScreenProps) {
  const summaries = useMemo(
    () => orderSignalSummaries(signals.summaries),
    [signals.summaries]
  );
  const priority = useMemo(() => choosePrioritySignal(summaries), [summaries]);
  const [activeSignal, setActiveSignal] = useState<SignalId | null>(null);
  const [activeDetail, setActiveDetail] = useState<SignalEvidence | null>(null);
  const evidenceBySignal = useMemo(() => groupEvidence(signals.evidence), [signals.evidence]);
  const activeSummary = summaries.find((signal) => signal.id === activeSignal) ?? null;
  const rows = activeSignal ? sortSignalEvidence(evidenceBySignal[activeSignal]) : [];
  const hasSignalData = summaries.some((signal) => signal.severity !== "nodata");

  function openSignal(signal: SignalSummary) {
    setActiveDetail(null);
    setActiveSignal(signal.id);
  }

  return (
    <section className="screen signals-screen">
      <header className="screen-header">
        <div className="screen-title">Signals</div>
      </header>

      {!priority || !hasSignalData ? (
        <div className="signals-state">
          <StateSurface
            icon="activity"
            title="Track a little more first"
            actionLabel="Open track"
            actionIcon="timer"
            onAction={onTrack}
          />
        </div>
      ) : (
        <div className="signals-workspace">
          <button
            className={`signal-priority severity-${priority.severity}`}
            type="button"
            aria-label={`Priority signal: ${priority.label}, ${priority.status}`}
            onClick={() => openSignal(priority)}
          >
            <span className="signal-priority-kicker">Priority</span>
            <span className="signal-priority-icon" aria-hidden="true">
              <Icon name={iconBySignal[priority.id]} />
            </span>
            <span className="signal-priority-copy">
              <span>{priority.label}</span>
              <strong>{priority.status}</strong>
              <small>{priority.reason}</small>
            </span>
            <Icon name="chevronRight" />
          </button>

          <div className="signal-summary-list" aria-label="Signal summaries">
            {summaries.map((signal) => (
              <button
                key={signal.id}
                className={`signal-summary-row severity-${signal.severity}`}
                type="button"
                aria-label={`${signal.label}: ${signal.status}`}
                onClick={() => openSignal(signal)}
              >
                <span className="signal-summary-icon" aria-hidden="true">
                  <Icon name={iconBySignal[signal.id]} />
                </span>
                <strong>{signal.label}</strong>
                <span className="signal-summary-status">
                  <span className="signal-state-mark" aria-hidden="true" />
                  {signal.status}
                </span>
                <Icon name="chevronRight" />
              </button>
            ))}
          </div>
        </div>
      )}

      <Sheet
        title={activeSummary?.label ?? "Signals"}
        open={activeSignal !== null}
        onClose={() => {
          setActiveDetail(null);
          setActiveSignal(null);
        }}
      >
        {activeSummary ? (
          <div className="signal-sheet-context">
            <span className={`status-chip severity-${activeSummary.severity}`}>
              {severityLabel(activeSummary.severity)}
            </span>
            <p>{activeSummary.reason}</p>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <div className="signal-evidence-list">
            {rows.map((row) => (
              <button
                key={row.id}
                className={`signal-evidence-row severity-${row.severity}`}
                type="button"
                aria-label={`${row.title}: ${row.status ?? severityLabel(row.severity)}`}
                onClick={() => setActiveDetail(row)}
              >
                <span className="signal-state-mark" aria-hidden="true" />
                <span className="signal-evidence-copy">
                  <strong>{row.title}</strong>
                  <small>{row.status ?? severityLabel(row.severity)}</small>
                </span>
                {row.value ? <span className="signal-evidence-value">{row.value}</span> : null}
                <Icon name="chevronRight" />
              </button>
            ))}
          </div>
        ) : activeSignal ? (
          <div className="signal-sheet-state">
            <StateSurface
              icon={iconBySignal[activeSignal]}
              title={`No ${activeSummary?.label ?? "signal"} evidence yet`}
              actionLabel="Open track"
              actionIcon="timer"
              onAction={onTrack}
            />
          </div>
        ) : null}
      </Sheet>

      <DetailPanel
        title={activeDetail?.title ?? "Signal"}
        open={activeDetail !== null}
        onBack={() => setActiveDetail(null)}
      >
        {activeDetail ? (
          <div className="detail-stack">
            <span className={`status-chip severity-${activeDetail.severity}`}>
              {activeDetail.status ?? severityLabel(activeDetail.severity)}
            </span>
            <p>{activeDetail.reason}</p>
            <dl className="evidence-list">
              {activeDetail.rows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
            {activeDetail.action === "Plan" ? (
              <button className="paper-action" type="button" onClick={onPlan}>
                Plan
              </button>
            ) : null}
          </div>
        ) : null}
      </DetailPanel>
    </section>
  );
}

function groupEvidence(
  evidence: AppWeekViewModel["signals"]["evidence"]
): Record<SignalId, SignalEvidence[]> {
  const grouped: Record<SignalId, SignalEvidence[]> = {
    plan: [],
    stage: [],
    goal: [],
    energy: []
  };

  for (const item of evidence) {
    const { signalId, ...row } = item;
    grouped[signalId].push(row);
  }
  return grouped;
}

function severityLabel(severity: SignalSeverity): string {
  if (severity === "severe") return "Risk";
  if (severity === "attention") return "Attention";
  if (severity === "normal") return "Steady";
  return "No data";
}
