import { describe, expect, it } from "vitest";
import { applySuggestion, dismissSuggestion, savePlanDetail, type PlanState } from "./planModel";

const baseState: PlanState = {
  suggestionStatus: "available",
  focusProject: null,
  slackHours: 1,
  savedAt: null
};

describe("planModel", () => {
  it("applies the review suggestion into next week planning", () => {
    const next = applySuggestion(baseState);
    expect(next.suggestionStatus).toBe("applied");
    expect(next.focusProject).toBe("Resume restart");
    expect(next.slackHours).toBe(2);
  });

  it("dismisses the suggestion without changing focus", () => {
    const next = dismissSuggestion(baseState);
    expect(next.suggestionStatus).toBe("dismissed");
    expect(next.focusProject).toBeNull();
  });

  it("saves editable plan detail state", () => {
    const next = savePlanDetail(baseState, { focusProject: "Frontend polish", slackHours: 3 });
    expect(next.focusProject).toBe("Frontend polish");
    expect(next.slackHours).toBe(3);
    expect(next.savedAt).toBeTruthy();
  });
});
