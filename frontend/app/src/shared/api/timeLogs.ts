import type { ActivityTimer, EnergyKind } from "../domain/track";
import type { FetchLike } from "./loadAppWeek";

export type ApiActivityType = "consuming" | "neutral" | "restore" | "destroy";
export type ApiActivityTypeSource = "user_selected" | "ai_suggested" | "user_corrected";

export interface TimeLogCreatePayload {
  activity_id?: number;
  project_id?: number;
  date: string;
  duration_minutes: number;
  activity_name: string;
  activity_type: ApiActivityType;
  type_source: ApiActivityTypeSource;
  note: string;
}

export interface SaveTimeLogOptions {
  apiBaseUrl?: string;
  payload: TimeLogCreatePayload;
  fetchImpl?: FetchLike;
}

export interface SaveTimeLogResult {
  saved: boolean;
  error: string | null;
}

export function activitySessionToTimeLog(
  activity: ActivityTimer,
  options: { date?: string; note?: string } = {}
): TimeLogCreatePayload | null {
  if (activity.sessionSeconds <= 0) return null;

  return {
    ...(activity.activityId ? { activity_id: activity.activityId } : {}),
    ...(activity.projectId ? { project_id: activity.projectId } : {}),
    date: options.date ?? todayIsoDate(),
    duration_minutes: Math.max(1, Math.round(activity.sessionSeconds / 60)),
    activity_name: activity.name,
    activity_type: energyToApiActivityType(activity.energy),
    type_source: "user_selected",
    note: options.note ?? ""
  };
}

export async function saveTimeLog(options: SaveTimeLogOptions): Promise<SaveTimeLogResult> {
  const apiBaseUrl = options.apiBaseUrl?.trim();
  if (!apiBaseUrl) {
    return { saved: false, error: "API base URL is not configured" };
  }

  try {
    const response = await (options.fetchImpl ?? fetch)(`${apiBaseUrl.replace(/\/$/, "")}/time-logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(options.payload)
    });

    if (!response.ok) {
      return { saved: false, error: `Backend returned ${response.status}` };
    }

    return { saved: true, error: null };
  } catch (error) {
    return {
      saved: false,
      error: error instanceof Error ? error.message : "Time log request failed"
    };
  }
}

export function energyToApiActivityType(energy: EnergyKind): ApiActivityType {
  if (energy === "consume") return "consuming";
  return energy;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
