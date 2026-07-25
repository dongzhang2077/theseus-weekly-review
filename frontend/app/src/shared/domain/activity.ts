import type { PlanProject } from "./plan";

export type PersistedActivityType = "consuming" | "neutral" | "restore" | "destroy";
export type PersistedActivityTypeSource =
  | "user_selected"
  | "ai_suggested"
  | "user_corrected";

export interface ActivityRecord {
  id: number;
  userId: number;
  projectId: number | null;
  name: string;
  description: string;
  activityType: PersistedActivityType;
  typeSource: PersistedActivityTypeSource;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityCatalog {
  activities: ActivityRecord[];
  projects: PlanProject[];
}

export interface ActivityCreateDraft {
  projectId: number | null;
  name: string;
  description: string;
  activityType: PersistedActivityType;
}

export interface ActivityUpdateDraft {
  expectedVersion: number;
  projectId?: number | null;
  name?: string;
  description?: string | null;
  activityType?: PersistedActivityType;
}
