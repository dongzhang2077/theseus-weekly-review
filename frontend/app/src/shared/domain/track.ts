export type EnergyKind = "destroy" | "consume" | "neutral" | "restore";

export interface ActivityTimer {
  id: string;
  activityId?: number;
  projectId?: number;
  projectTitle?: string;
  name: string;
  category: string;
  energy: EnergyKind;
  color: string;
  todaySeconds: number;
  sessionSeconds: number;
  running: boolean;
  recommended?: boolean;
}
