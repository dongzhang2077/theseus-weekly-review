import type { PlanState, SuggestionStatus } from "../../shared/domain/plan";
export type { PlanState, SuggestionStatus } from "../../shared/domain/plan";

export function applySuggestion(state: PlanState): PlanState {
  return {
    ...state,
    suggestionStatus: "applied",
    focusProject: "Resume restart",
    slackHours: Math.max(state.slackHours, 2),
    savedAt: new Date().toISOString()
  };
}

export function dismissSuggestion(state: PlanState): PlanState {
  return {
    ...state,
    suggestionStatus: "dismissed"
  };
}

export function savePlanDetail(state: PlanState, detail: Partial<Pick<PlanState, "focusProject" | "slackHours">>): PlanState {
  return {
    ...state,
    ...detail,
    savedAt: new Date().toISOString()
  };
}
