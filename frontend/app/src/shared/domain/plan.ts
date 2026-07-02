export type SuggestionStatus = "available" | "applied" | "dismissed";

export interface PlanState {
  suggestionStatus: SuggestionStatus;
  focusProject: string | null;
  slackHours: number;
  savedAt: string | null;
}
