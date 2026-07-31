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

const signalActionClass =
  "min-h-11 w-full rounded-paper border border-desk-accent/30 bg-desk-accent-soft px-4 text-sm font-bold text-desk-accent shadow-paper transition-colors hover:border-desk-accent/50 hover:bg-desk-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-desk-accent";

interface SignalsScreenProps {
  signals: AppWeekViewModel["signals"];
  weekLabel: string;
  onAction: (action: AppSignalAction) => void;
  onTrack: () => void;
  onDetailOpenChange?: (open: boolean) => void;
}

type SignalDetailLevel = "summary" | "evidence";

export function SignalsScreen({
  signals,
  weekLabel,
  onAction,
  onTrack,
  onDetailOpenChange
}: SignalsScreenProps) {
  const issues = useMemo(() => selectSignalIssues(signals.evidence), [signals.evidence]);
  const steadyCount = useMemo(() => countSteadyEvidence(signals.evidence), [signals.evidence]);
  const [activeDetail, setActiveDetail] = useState<AppSignalEvidence | null>(null);
  const [detailLevel, setDetailLevel] = useState<SignalDetailLevel>("summary");
  const hasSignalData = signals.summaries.some((signal) => signal.severity !== "nodata");

  const openDetail = (evidence: AppSignalEvidence) => {
    setActiveDetail(evidence);
    setDetailLevel("summary");
  };

  const closeDetail = () => {
    setActiveDetail(null);
    setDetailLevel("summary");
  };

  useEffect(() => {
    onDetailOpenChange?.(activeDetail !== null);
  }, [activeDetail, onDetailOpenChange]);

  useEffect(() => () => onDetailOpenChange?.(false), [onDetailOpenChange]);

  if (activeDetail) {
    return detailLevel === "summary" ? (
      <SignalSummaryPage
        evidence={activeDetail}
        weekLabel={weekLabel}
        onBack={closeDetail}
        onEvidence={() => setDetailLevel("evidence")}
        onAction={onAction}
      />
    ) : (
      <SignalEvidencePage
        evidence={activeDetail}
        weekLabel={weekLabel}
        onBack={() => setDetailLevel("summary")}
      />
    );
  }

  return (
    <section className="screen signals-screen !h-full !min-h-0 touch-pan-y overflow-y-auto overscroll-y-contain bg-desk-paper">
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
        <div className="mx-auto grid w-full gap-5 px-1 py-4 pb-8" aria-label="Current signal issues">
          <section className="grid gap-2" aria-labelledby="priority-signal-heading">
            <h2 id="priority-signal-heading" className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-desk-muted">
              Priority
            </h2>
            <PrioritySignalCard
              issue={issues[0]}
              onAction={onAction}
              onDetails={() => openDetail(issues[0])}
            />
          </section>

          {issues.length > 1 ? (
            <section className="grid gap-2" aria-labelledby="other-signals-heading">
              <h2 id="other-signals-heading" className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-desk-muted">
                Other signals
              </h2>
              <div className="overflow-hidden rounded-paper border border-desk-line bg-desk-raised shadow-paper">
                {issues.slice(1).map((issue) => (
                  <SignalIssueRow key={issue.id} issue={issue} onDetails={() => openDetail(issue)} />
                ))}
              </div>
            </section>
          ) : null}

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

export function PrioritySignalCard({
  issue,
  onAction,
  onDetails
}: {
  issue: AppSignalEvidence;
  onAction: (action: AppSignalAction) => void;
  onDetails: () => void;
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
            <strong className="block break-words text-base leading-5">{issue.title}</strong>
            <small className="mt-0.5 block text-xs text-desk-muted">{signalLabel(issue.signalId)}</small>
          </span>
        </div>
        <span className={`status-chip shrink-0 whitespace-nowrap severity-${issue.severity}`}>
          {issue.status ?? severityLabel(issue.severity)}
        </span>
      </div>

      {issue.value ? <strong className="mt-4 block text-2xl tabular-nums">{issue.value}</strong> : null}

      <div className={`mt-4 grid items-center gap-2 ${issue.action ? "grid-cols-[1fr_auto]" : "grid-cols-[auto] justify-end"}`}>
        {issue.action ? (
          <button
            className={signalActionClass}
            type="button"
            onClick={() => onAction(issue.action as AppSignalAction)}
          >
            {actionVerb(issue.action)}
          </button>
        ) : null}
        <IconButton label={`Open ${issue.title} details`} icon="chevronRight" variant="soft" onClick={onDetails} />
      </div>
    </article>
  );
}

export function SignalIssueRow({ issue, onDetails }: { issue: AppSignalEvidence; onDetails: () => void }) {
  return (
    <button
      className="grid min-h-16 w-full grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 border-0 border-b border-desk-line bg-transparent px-3 py-3 text-left text-desk-ink last:border-b-0 hover:bg-desk-sunk focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-desk-accent"
      type="button"
      aria-label={`Open ${issue.title} details`}
      title={`Open ${issue.title} details`}
      onClick={onDetails}
    >
      <span className="grid size-8 place-items-center rounded-full bg-desk-sunk text-desk-muted" aria-hidden="true">
        <Icon name={iconBySignal[issue.signalId]} className="size-4" />
      </span>
      <strong className="min-w-0 break-words text-sm leading-5">{issue.title}</strong>
      <span className="text-right">
        {issue.value ? <strong className="block text-sm tabular-nums">{issue.value}</strong> : null}
        <small className="block text-[11px] text-desk-muted">
          {issue.status ?? severityLabel(issue.severity)}
        </small>
      </span>
      <Icon name="chevronRight" className="size-4 text-desk-subtle" />
    </button>
  );
}

export function SignalSummaryPage({
  evidence,
  weekLabel,
  onBack,
  onEvidence,
  onAction
}: {
  evidence: AppSignalEvidence;
  weekLabel: string;
  onBack: () => void;
  onEvidence: () => void;
  onAction: (action: AppSignalAction) => void;
}) {
  const entity = affectedEntity(evidence);
  return (
    <section
      className="screen !h-full !min-h-0 touch-pan-y overflow-y-auto overscroll-y-contain bg-desk-paper"
      aria-label={`${evidence.title} summary`}
    >
      <header className="screen-header">
        <IconButton label="Back" icon="chevronLeft" onClick={onBack} />
        <div className="screen-title">Signal</div>
      </header>
      <div className="grid gap-5 px-1 py-5 pb-8">
        <section className="grid gap-3" aria-labelledby="signal-summary-title">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-desk-sunk text-desk-muted" aria-hidden="true">
              <Icon name={iconBySignal[evidence.signalId]} className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 id="signal-summary-title" className="m-0 break-words text-xl leading-7 text-desk-ink">
                {evidence.title}
              </h1>
              <span className={`status-chip mt-2 shrink-0 whitespace-nowrap severity-${evidence.severity}`}>
                {evidence.status ?? severityLabel(evidence.severity)}
              </span>
            </div>
            {evidence.value ? (
              <strong className="shrink-0 text-2xl leading-8 tabular-nums text-desk-ink">{evidence.value}</strong>
            ) : null}
          </div>
          <p className="m-0 text-sm leading-6 text-desk-muted">{evidence.reason}</p>
        </section>

        <dl className="overflow-hidden rounded-paper border border-desk-line bg-desk-raised shadow-paper">
          <SignalContextRow label="Type" value={signalLabel(evidence.signalId)} />
          {entity ? <SignalContextRow label={entity.label} value={entity.value} /> : null}
          <SignalContextRow label="Period" value={weekLabel} />
        </dl>

        <div className={`grid items-center gap-2 ${evidence.action ? "grid-cols-[1fr_auto]" : "justify-end"}`}>
          {evidence.action ? (
            <button
              className={signalActionClass}
              type="button"
              onClick={() => onAction(evidence.action as AppSignalAction)}
            >
              {actionVerb(evidence.action)}
            </button>
          ) : null}
          <IconButton label="Evidence" icon="fileText" variant="soft" onClick={onEvidence} />
        </div>
      </div>
    </section>
  );
}

function SignalContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-h-12 grid-cols-[5rem_minmax(0,1fr)] items-center gap-3 border-b border-desk-line px-3 py-2 last:border-b-0">
      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-desk-subtle">{label}</dt>
      <dd className="m-0 min-w-0 break-words text-right text-sm font-semibold text-desk-ink">{value}</dd>
    </div>
  );
}

export function SignalEvidencePage({
  evidence,
  weekLabel,
  onBack
}: {
  evidence: AppSignalEvidence;
  weekLabel: string;
  onBack: () => void;
}) {
  const rows = evidence.rows.filter((row) => row.value.trim() !== evidence.reason.trim());
  const entity = affectedEntity(evidence);

  return (
    <section
      className="screen !h-full !min-h-0 touch-pan-y overflow-y-auto overscroll-y-contain bg-desk-paper"
      aria-label={`${evidence.title} evidence`}
    >
      <header className="screen-header">
        <IconButton label="Back" icon="chevronLeft" onClick={onBack} />
        <div className="screen-title">Evidence</div>
      </header>
      <div className="grid gap-5 px-1 py-5 pb-8">
        <section className="grid gap-2" aria-labelledby="signal-evidence-title">
          <h1 id="signal-evidence-title" className="m-0 break-words text-xl leading-7 text-desk-ink">
            {evidence.title}
          </h1>
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.12em] text-desk-subtle">
            {weekLabel}
          </p>
          {entity ? <p className="m-0 break-words text-sm text-desk-muted">{entity.label}: {entity.value}</p> : null}
        </section>

        <section className="grid gap-3 rounded-paper border border-desk-line bg-desk-raised p-4 shadow-paper" aria-label="Source values">
          <h2 className="m-0 text-base font-bold">Recorded values</h2>
          <dl className="evidence-list">
            {rows.map((row) => (
              <div key={`${row.label}-${row.value}`}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </section>
  );
}

function affectedEntity(evidence: AppSignalEvidence): { label: "Goal" | "Project"; value: string } | null {
  if (evidence.signalId === "goal") return { label: "Goal", value: evidence.title };
  if (evidence.signalId === "energy") return null;

  const projectTitle = evidence.action?.suggestion?.projectTitle;
  if (projectTitle) return { label: "Project", value: projectTitle };
  if (evidence.title !== "Weekly plan") return { label: "Project", value: evidence.title };
  return null;
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

function actionVerb(action: AppSignalAction): string {
  const label = action.label.trim();
  const normalized = label.toLocaleLowerCase();
  if (normalized.includes("restart") || normalized.includes("resume") || normalized.includes("recover")) {
    return "Restart";
  }
  if (normalized.startsWith("adjust") || normalized.startsWith("reduce") || normalized.startsWith("rebalance")) {
    return "Adjust";
  }
  if (normalized.startsWith("choose") || normalized.startsWith("select") || normalized.startsWith("link")) {
    return "Choose";
  }
  return label.split(/\s+/)[0] || "Open";
}
