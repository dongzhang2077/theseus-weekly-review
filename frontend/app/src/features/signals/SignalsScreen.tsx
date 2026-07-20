import { useEffect, useMemo, useState } from "react";
import { StateSurface } from "../../shared/components/StateSurface";
import { Icon } from "../../shared/icons/Icon";
import { IconButton } from "../../shared/components/IconButton";
import type {
  AppSignalAction,
  AppSignalEvidence,
  AppWeekViewModel
} from "../../shared/api/weeklyReview";
import type { SignalId, SignalSeverity } from "./signalModel";
import { countSteadyEvidence, selectSignalIssues } from "./signalModel";

const iconBySignal: Record<SignalId, "calendar" | "target" | "layers" | "leaf"> = {
  plan: "calendar",
  stage: "layers",
  goal: "target",
  energy: "leaf"
};

interface SignalsScreenProps {
  signals: AppWeekViewModel["signals"];
  onAction: (action: AppSignalAction) => void;
  onTrack: () => void;
  onDetailOpenChange?: (open: boolean) => void;
}

export function SignalsScreen({
  signals,
  onAction,
  onTrack,
  onDetailOpenChange
}: SignalsScreenProps) {
  const issues = useMemo(() => selectSignalIssues(signals.evidence), [signals.evidence]);
  const steadyCount = useMemo(() => countSteadyEvidence(signals.evidence), [signals.evidence]);
  const [activeDetail, setActiveDetail] = useState<AppSignalEvidence | null>(null);
  const hasSignalData = signals.summaries.some((signal) => signal.severity !== "nodata");

  useEffect(() => {
    onDetailOpenChange?.(activeDetail !== null);
  }, [activeDetail, onDetailOpenChange]);

  useEffect(() => () => onDetailOpenChange?.(false), [onDetailOpenChange]);

  if (activeDetail) {
    return (
      <SignalDetailPage
        evidence={activeDetail}
        onBack={() => setActiveDetail(null)}
        onAction={onAction}
      />
    );
  }

  return (
    <section className="screen signals-screen overflow-y-auto bg-desk-paper">
      <header className="screen-header">
        <div className="screen-title">Signals</div>
      </header>

      {!hasSignalData ? (
        <div className="h-[calc(100%-52px)]">
          <StateSurface
            icon="activity"
            title="Track a little more first"
            actionLabel="Open focus"
            actionIcon="timer"
            onAction={onTrack}
          />
        </div>
      ) : issues.length === 0 ? (
        <div className="h-[calc(100%-52px)]">
          <StateSurface icon="check" title="All checks steady" />
        </div>
      ) : (
        <div className="mx-auto grid w-full gap-4 px-1 py-5 pb-8">
          <div>
            <p className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-desk-muted">Needs attention</p>
            <p className="mb-0 mt-1 text-sm leading-5 text-desk-muted">
              Resolve the highest-impact issue first. Evidence stays available without blocking action.
            </p>
          </div>

          <div className="grid gap-3" aria-label="Current signal issues">
            {issues.map((issue, index) => (
              <SignalIssueCard
                key={issue.id}
                issue={issue}
                priority={index === 0}
                onAction={onAction}
                onEvidence={() => setActiveDetail(issue)}
              />
            ))}
          </div>

          {steadyCount > 0 ? (
            <div className="flex min-h-11 items-center gap-2 rounded-paper border border-desk-line bg-desk-raised px-3 text-sm font-semibold text-desk-muted">
              <Icon name="check" className="size-4 text-desk-accent" />
              <span>{steadyCount} other {steadyCount === 1 ? "check is" : "checks are"} steady</span>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function SignalIssueCard({
  issue,
  priority,
  onAction,
  onEvidence
}: {
  issue: AppSignalEvidence;
  priority: boolean;
  onAction: (action: AppSignalAction) => void;
  onEvidence: () => void;
}) {
  return (
    <article
      className={`rounded-paper border p-4 shadow-paper ${issueSurface(issue.severity)}`}
      aria-label={`${issue.title}: ${issue.status ?? severityLabel(issue.severity)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-desk-sunk text-desk-muted" aria-hidden="true">
            <Icon name={iconBySignal[issue.signalId]} className="size-4" />
          </span>
          <span className="min-w-0">
            <small className="block text-[11px] font-bold uppercase tracking-wide text-desk-muted">
              {priority ? "Priority" : signalLabel(issue.signalId)}
            </small>
            <strong className="block truncate text-base">{issue.title}</strong>
          </span>
        </div>
        <span className={`status-chip severity-${issue.severity}`}>
          {issue.status ?? severityLabel(issue.severity)}
        </span>
      </div>

      <p className="mb-0 mt-3 text-sm leading-5 text-desk-muted">{issue.reason}</p>
      {issue.value ? <strong className="mt-3 block text-lg tabular-nums">{issue.value}</strong> : null}

      <div className={`mt-4 grid gap-2 ${issue.action ? "grid-cols-[1fr_auto]" : "grid-cols-1"}`}>
        {issue.action ? (
          <button
            className="min-h-11 rounded-paper border-0 bg-desk-accent px-4 text-sm font-bold text-white"
            type="button"
            onClick={() => onAction(issue.action as AppSignalAction)}
          >
            {issue.action.label}
          </button>
        ) : null}
        <button
          className="min-h-11 rounded-paper border border-desk-line bg-desk-raised px-4 text-sm font-bold text-desk-muted"
          type="button"
          onClick={onEvidence}
        >
          Evidence
        </button>
      </div>
    </article>
  );
}

function SignalDetailPage({
  evidence,
  onBack,
  onAction
}: {
  evidence: AppSignalEvidence;
  onBack: () => void;
  onAction: (action: AppSignalAction) => void;
}) {
  const rows = evidence.rows.filter((row) => row.value.trim() !== evidence.reason.trim());
  return (
    <section className="screen h-full overflow-y-auto bg-desk-paper" aria-label={evidence.title}>
      <header className="screen-header">
        <IconButton label="Back" icon="chevronLeft" onClick={onBack} />
        <div className="screen-title truncate px-2">{evidence.title}</div>
      </header>
      <div className="grid gap-5 px-1 py-6">
        <div>
          <span className={`status-chip severity-${evidence.severity}`}>
            {evidence.status ?? severityLabel(evidence.severity)}
          </span>
          <p className="mb-0 mt-3 text-sm leading-6 text-desk-muted">{evidence.reason}</p>
        </div>
        <section className="grid gap-3 rounded-paper border border-desk-line bg-desk-raised p-4" aria-labelledby="signal-evidence-title">
          <h2 id="signal-evidence-title" className="m-0 text-base font-bold">Evidence</h2>
          <dl className="evidence-list">
            {rows.map((row) => (
              <div key={`${row.label}-${row.value}`}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
        {evidence.action ? (
          <button
            className="min-h-11 rounded-paper border-0 bg-desk-accent px-4 font-bold text-white"
            type="button"
            onClick={() => onAction(evidence.action as AppSignalAction)}
          >
            {evidence.action.label}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function signalLabel(signalId: SignalId): string {
  if (signalId === "stage") return "Project stage";
  if (signalId === "goal") return "Goal support";
  if (signalId === "energy") return "Energy balance";
  return "Plan variance";
}

function severityLabel(severity: SignalSeverity): string {
  if (severity === "severe") return "Risk";
  if (severity === "attention") return "Attention";
  if (severity === "normal") return "Steady";
  return "No data";
}

function issueSurface(severity: SignalSeverity): string {
  if (severity === "severe") return "border-desk-danger/40 bg-desk-danger-soft/30";
  return "border-desk-warn/40 bg-desk-raised";
}
