import { describe, expect, it } from "vitest";
import { choosePrioritySignal, sortSignalEvidence, type SignalSummary } from "./signalModel";

const baseSignals: SignalSummary[] = [
  { id: "plan", label: "Plan", severity: "attention", status: "Plan drift", reason: "Plan changed." },
  { id: "stage", label: "Stage", severity: "severe", status: "Stage drift", reason: "Project is dormant." },
  { id: "goal", label: "Goal", severity: "normal", status: "Aligned", reason: "Goals are covered." },
  { id: "energy", label: "Energy", severity: "attention", status: "Thin", reason: "Recovery was low." }
];

describe("signalModel", () => {
  it("chooses the highest severity signal", () => {
    expect(choosePrioritySignal(baseSignals).id).toBe("stage");
  });

  it("uses the product priority order when severity ties", () => {
    const tied = baseSignals.map((signal) => ({ ...signal, severity: "attention" as const }));
    expect(choosePrioritySignal(tied).id).toBe("stage");
  });

  it("sorts evidence rows by severity", () => {
    const sorted = sortSignalEvidence([
      { id: "healthy", title: "Healthy", severity: "normal", reason: "OK", rows: [] },
      { id: "risk", title: "Risk", severity: "severe", reason: "Needs work", rows: [] }
    ]);

    expect(sorted.map((row) => row.id)).toEqual(["risk", "healthy"]);
  });
});
