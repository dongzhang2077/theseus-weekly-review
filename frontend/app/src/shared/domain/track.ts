export type EnergyKind = "destroy" | "consume" | "neutral" | "restore";

export type FocusContextSource =
  | "persisted_plan"
  | "persisted_activity"
  | "review_evidence"
  | "persisted_log"
  | "manual"
  | "sample";

export interface FocusContext {
  source: FocusContextSource;
  planItemId?: number;
  plannedMinutes?: number;
  actualMinutes?: number;
  priority?: number;
  isCompleted?: boolean;
  reason?: string;
}

export interface ActivityTimer {
  id: string;
  activityId?: number;
  activityVersion?: number;
  activityDescription?: string;
  activityTypeSource?: "user_selected" | "ai_suggested" | "user_corrected";
  taskId?: number;
  projectId?: number;
  projectTitle?: string;
  focusContext?: FocusContext;
  name: string;
  category: string;
  energy: EnergyKind;
  color: string;
  todayDate?: string;
  todaySeconds: number;
  sessionSeconds: number;
  sessionSecondsByDate?: Record<string, number>;
  runSeconds?: number;
  focusSessionId?: number;
  focusSessionVersion?: number;
  focusStartedAt?: string;
  running: boolean;
  recommended?: boolean;
}

export interface FocusSessionDraft {
  targetMinutes: number | null;
  intent: string;
}
