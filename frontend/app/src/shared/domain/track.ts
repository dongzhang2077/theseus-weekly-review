export type EnergyKind = "destroy" | "consume" | "neutral" | "restore";

export interface ActivityTimer {
  id: string;
  activityId?: number;
  projectId?: number;
  name: string;
  category: string;
  energy: EnergyKind;
  color: string;
  todaySeconds: number;
  sessionSeconds: number;
  running: boolean;
  recommended?: boolean;
  recommendationReason?: string;
  completionStandard?: string;
  suggestedMinutes?: number;
}
