export type SuggestionStatus = "available" | "applied" | "dismissed";
export type PlanAdjustmentKind = "add" | "reduce";
export type PlanBalanceStatus = "balanced" | "tight" | "overloaded" | "unknown";
export type PlanProjectStage = "startup" | "stable" | "sprint" | "dormant" | "wake_up";
export type PlanProjectStatus = "active" | "paused" | "archived";

export interface PlanDateRange {
  start: string;
  end: string;
}

export interface PlanItem {
  id?: number;
  projectId: number | null;
  title: string;
  plannedMinutes: number;
  priority: number;
  isCompleted: boolean;
}

export interface PlanDraft {
  id: number | null;
  userId?: number;
  week: PlanDateRange;
  capacityMinutes: number;
  slackTargetPercent: number;
  items: PlanItem[];
  note: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlanProject {
  id: number;
  title: string;
  stage: PlanProjectStage;
  status: PlanProjectStatus;
  weeklyMinMinutes: number;
  weeklyTargetMinutes: number;
}

export interface PlanSuggestion {
  title: string;
  reason: string;
  kind: PlanAdjustmentKind;
  projectId: number | null;
  projectTitle: string | null;
  deltaMinutes: number;
}

export interface PlanSeed {
  reviewWeek: PlanDateRange;
  targetWeek: PlanDateRange;
  sourcePlan: PlanDraft;
  projects: PlanProject[];
  suggestion: PlanSuggestion | null;
}
