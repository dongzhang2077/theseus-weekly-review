export type EnergyKind = "destroy" | "consume" | "neutral" | "restore";

export interface ActivityTimer {
  id: string;
  name: string;
  category: string;
  energy: EnergyKind;
  color: string;
  todaySeconds: number;
  sessionSeconds: number;
  running: boolean;
  recommended?: boolean;
}
