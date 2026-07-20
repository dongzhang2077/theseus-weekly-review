import { describe, expect, it } from "vitest";
import type { AppSignalEvidence } from "../../shared/api/weeklyReview";
import { countSteadyEvidence, selectSignalIssues } from "./signalModel";

const rows: AppSignalEvidence[] = [
  {
    id: "goal-steady",
    signalId: "goal",
    title: "Goal supported",
    severity: "normal",
    reason: "Goal received time.",
    rows: []
  },
  {
    id: "plan-drift",
    signalId: "plan",
    title: "Plan drift",
    severity: "attention",
    reason: "Plan changed.",
    rows: []
  },
  {
    id: "stage-risk",
    signalId: "stage",
    title: "Project dormant",
    severity: "severe",
    reason: "Project needs a restart.",
    rows: []
  },
  {
    id: "energy-empty",
    signalId: "energy",
    title: "Energy",
    severity: "nodata",
    reason: "No data.",
    rows: []
  }
];

describe("signalModel", () => {
  it("keeps only concrete issues and orders the highest severity first", () => {
    expect(selectSignalIssues(rows).map((row) => row.id)).toEqual(["stage-risk", "plan-drift"]);
  });

  it("counts normal checks separately from issues and missing data", () => {
    expect(countSteadyEvidence(rows)).toBe(1);
  });
});
