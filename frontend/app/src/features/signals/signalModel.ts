import type { SignalId, SignalSeverity } from "../../shared/domain/signals";
export type { SignalId, SignalSeverity } from "../../shared/domain/signals";

export interface SignalSummary {
  id: SignalId;
  label: string;
  severity: SignalSeverity;
  status: string;
  reason: string;
}

export interface SignalEvidence {
  id: string;
  title: string;
  severity: SignalSeverity;
  reason: string;
  rows: Array<{
    label: string;
    value: string;
  }>;
  action?: string;
}

export const severityRank: Record<SignalSeverity, number> = {
  severe: 3,
  attention: 2,
  normal: 1,
  nodata: 0
};

export const signalPriorityOrder: SignalId[] = ["stage", "plan", "goal", "energy"];

export function choosePrioritySignal(signals: SignalSummary[]): SignalSummary {
  return [...signals].sort((a, b) => {
    const severityDelta = severityRank[b.severity] - severityRank[a.severity];
    if (severityDelta !== 0) return severityDelta;
    return signalPriorityOrder.indexOf(a.id) - signalPriorityOrder.indexOf(b.id);
  })[0];
}

export function sortSignalEvidence(rows: SignalEvidence[]): SignalEvidence[] {
  return [...rows].sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);
}
