import type { SignalId, SignalSeverity } from "../../shared/domain/signals";
import type { AppSignalEvidence } from "../../shared/api/weeklyReview";
export type { SignalId, SignalSeverity } from "../../shared/domain/signals";

export interface SignalSummary {
  id: SignalId;
  label: string;
  severity: SignalSeverity;
  status: string;
  reason: string;
}

export type SignalEvidence = Omit<AppSignalEvidence, "signalId">;

export const severityRank: Record<SignalSeverity, number> = {
  severe: 3,
  attention: 2,
  normal: 1,
  nodata: 0
};

export const signalPriorityOrder: SignalId[] = ["stage", "plan", "goal", "energy"];
export const signalDisplayOrder: SignalId[] = ["plan", "stage", "goal", "energy"];

export function choosePrioritySignal(signals: SignalSummary[]): SignalSummary | null {
  if (signals.length === 0) return null;
  return [...signals].sort((a, b) => {
    const severityDelta = severityRank[b.severity] - severityRank[a.severity];
    if (severityDelta !== 0) return severityDelta;
    return signalPriorityOrder.indexOf(a.id) - signalPriorityOrder.indexOf(b.id);
  })[0];
}

export function sortSignalEvidence(rows: SignalEvidence[]): SignalEvidence[] {
  return [...rows].sort((a, b) => {
    const severityDelta = severityRank[b.severity] - severityRank[a.severity];
    return severityDelta !== 0 ? severityDelta : a.title.localeCompare(b.title);
  });
}

export function selectSignalIssues(rows: AppSignalEvidence[]): AppSignalEvidence[] {
  return [...rows]
    .filter((row) => row.severity === "severe" || row.severity === "attention")
    .sort((left, right) => {
      const severityDelta = severityRank[right.severity] - severityRank[left.severity];
      if (severityDelta !== 0) return severityDelta;
      const signalDelta = signalPriorityOrder.indexOf(left.signalId) - signalPriorityOrder.indexOf(right.signalId);
      return signalDelta !== 0 ? signalDelta : left.title.localeCompare(right.title);
    });
}

export function countSteadyEvidence(rows: AppSignalEvidence[]): number {
  return rows.filter((row) => row.severity === "normal").length;
}

export function orderSignalSummaries(signals: SignalSummary[]): SignalSummary[] {
  return signalDisplayOrder.flatMap((id) => {
    const signal = signals.find((candidate) => candidate.id === id);
    return signal ? [signal] : [];
  });
}
