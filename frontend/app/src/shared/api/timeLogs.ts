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

export interface SaveActivitySessionOptions {
  apiBaseUrl?: string;
  activity: ActivityTimer;
  date?: string;
  timeZone?: string;
  note?: string;
  fetchImpl?: FetchLike;
}

export interface SaveTimeLogResult {
  saved: boolean;
  error: string | null;
}

export interface ApiTimeLogRead extends TimeLogCreatePayload {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
}

export interface LoadTimeLogsResult {
  loaded: boolean;
  logs: ApiTimeLogRead[];
  error: string | null;
}

export function activitySessionToTimeLog(
  activity: ActivityTimer,
  options: { date?: string; timeZone?: string; note?: string } = {}
): TimeLogCreatePayload | null {
  if (activity.sessionSeconds <= 0) return null;

  return {
    ...(activity.activityId ? { activity_id: activity.activityId } : {}),
    ...(activity.projectId ? { project_id: activity.projectId } : {}),
    date: options.date ?? calendarDate(options.timeZone),
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
      headers: { "Content-Type": "application/json" },
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

export async function saveActivitySession(options: SaveActivitySessionOptions): Promise<SaveTimeLogResult> {
  const payload = activitySessionToTimeLog(options.activity, {
    date: options.date,
    timeZone: options.timeZone,
    note: options.note
  });
  if (!payload) {
    return { saved: false, error: "Activity session is empty" };
  }

  return saveTimeLog({
    apiBaseUrl: options.apiBaseUrl,
    payload,
    fetchImpl: options.fetchImpl
  });
}

export async function loadTimeLogs(options: {
  apiBaseUrl?: string;
  fetchImpl?: FetchLike;
}): Promise<LoadTimeLogsResult> {
  const apiBaseUrl = options.apiBaseUrl?.trim();
  if (!apiBaseUrl) {
    return { loaded: false, logs: [], error: "API base URL is not configured" };
  }
  try {
    const response = await (options.fetchImpl ?? fetch)(`${apiBaseUrl.replace(/\/$/, "")}/time-logs`, {
      method: "GET"
    });
    if (!response.ok) {
      return { loaded: false, logs: [], error: `Backend returned ${response.status}` };
    }
    const payload = await response.json();
    if (!Array.isArray(payload)) {
      return { loaded: false, logs: [], error: "Backend returned invalid time-log data" };
    }
    return { loaded: true, logs: payload as ApiTimeLogRead[], error: null };
  } catch (error) {
    return {
      loaded: false,
      logs: [],
      error: error instanceof Error ? error.message : "Time-log request failed"
    };
  }
}

export function applyTodayTimeLogs(
  activities: ActivityTimer[],
  logs: ApiTimeLogRead[],
  date: string
): ActivityTimer[] {
  const todayLogs = logs.filter((log) => log.date === date && log.duration_minutes > 0);
  const totals = activities.map(() => 0);
  const unmatched: ApiTimeLogRead[] = [];

  for (const log of todayLogs) {
    let index = log.activity_id
      ? activities.findIndex((activity) => activity.activityId === log.activity_id)
      : -1;
    if (index < 0 && log.project_id) {
      index = activities.findIndex((activity) => activity.projectId === log.project_id);
    }
    if (index < 0) {
      index = activities.findIndex((activity) => activity.name === log.activity_name);
    }
    if (index < 0) {
      unmatched.push(log);
      continue;
    }
    totals[index] += Math.round(log.duration_minutes * 60);
  }

  const hydrated = activities.map((activity, index) => ({
    ...activity,
    todaySeconds: totals[index]
  }));
  const groups = new Map<string, ActivityTimer>();
  for (const log of unmatched) {
    const key = log.activity_id
      ? `activity-${log.activity_id}`
      : log.project_id
        ? `project-${log.project_id}-${log.activity_name}`
        : `name-${log.activity_name}`;
    const existing = groups.get(key);
    if (existing) {
      existing.todaySeconds += Math.round(log.duration_minutes * 60);
      continue;
    }
    groups.set(key, {
      id: `today-${key}`,
      ...(log.activity_id ? { activityId: log.activity_id } : {}),
      ...(log.project_id ? { projectId: log.project_id } : {}),
      name: log.activity_name,
      category: log.project_id ? "Project" : "Activity",
      energy: apiActivityTypeToEnergy(log.activity_type),
      color: "#8aa9c0",
      todaySeconds: Math.round(log.duration_minutes * 60),
      sessionSeconds: 0,
      running: false,
      focusContext: {
        source: "persisted_log",
        reason: "Recorded from today's saved focus history"
      }
    });
  }

  return [...hydrated, ...groups.values()];
}

export function energyToApiActivityType(energy: EnergyKind): ApiActivityType {
  if (energy === "consume") return "consuming";
  return energy;
}

export function calendarDate(timeZone?: string, now = new Date()): string {
  if (!timeZone) {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return calendarDate(undefined, now);
  }
}

function apiActivityTypeToEnergy(activityType: ApiActivityType): EnergyKind {
  if (activityType === "consuming") return "consume";
  return activityType;
}
