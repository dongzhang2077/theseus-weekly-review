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

export interface TimeLogBatchCreatePayload {
  time_logs: TimeLogCreatePayload[];
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
  return activitySessionToTimeLogs(activity, options)[0] ?? null;
}

export function activitySessionToTimeLogs(
  activity: ActivityTimer,
  options: { date?: string; timeZone?: string; note?: string } = {}
): TimeLogCreatePayload[] {
  if (activity.sessionSeconds <= 0) return [];

  const fallbackDate = options.date ?? calendarDate(options.timeZone);
  const byDate = normalizedSessionDates(activity, fallbackDate);
  const minutesByDate = allocateWholeMinutes(byDate);
  return minutesByDate.map(({ date, minutes }) => ({
    ...(activity.activityId ? { activity_id: activity.activityId } : {}),
    ...(activity.projectId ? { project_id: activity.projectId } : {}),
    date,
    duration_minutes: minutes,
    activity_name: activity.name,
    activity_type: energyToApiActivityType(activity.energy),
    type_source: "user_selected",
    note: options.note ?? ""
  }));
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
  const payloads = activitySessionToTimeLogs(options.activity, {
    date: options.date,
    timeZone: options.timeZone,
    note: options.note
  });
  if (payloads.length === 0) {
    return { saved: false, error: "Activity session is empty" };
  }

  if (payloads.length > 1) {
    return saveTimeLogBatch({
      apiBaseUrl: options.apiBaseUrl,
      payloads,
      fetchImpl: options.fetchImpl
    });
  }

  return saveTimeLog({
    apiBaseUrl: options.apiBaseUrl,
    payload: payloads[0],
    fetchImpl: options.fetchImpl
  });
}

export async function saveTimeLogBatch(options: {
  apiBaseUrl?: string;
  payloads: TimeLogCreatePayload[];
  fetchImpl?: FetchLike;
}): Promise<SaveTimeLogResult> {
  const apiBaseUrl = options.apiBaseUrl?.trim();
  if (!apiBaseUrl) {
    return { saved: false, error: "API base URL is not configured" };
  }
  if (options.payloads.length === 0) {
    return { saved: false, error: "Time-log batch is empty" };
  }
  try {
    const response = await (options.fetchImpl ?? fetch)(
      `${apiBaseUrl.replace(/\/$/, "")}/time-logs/batch`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time_logs: options.payloads } satisfies TimeLogBatchCreatePayload)
      }
    );
    if (!response.ok) {
      return { saved: false, error: `Backend returned ${response.status}` };
    }
    return { saved: true, error: null };
  } catch (error) {
    return {
      saved: false,
      error: error instanceof Error ? error.message : "Time-log batch request failed"
    };
  }
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
    todayDate: date,
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
      todayDate: date,
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

export function splitElapsedSecondsByDate(
  startedAtMs: number,
  elapsedSeconds: number,
  timeZone?: string
): Record<string, number> {
  const wholeSeconds = Math.max(0, Math.floor(elapsedSeconds));
  if (wholeSeconds === 0) return {};

  const elapsedByDate: Record<string, number> = {};
  let offset = 0;
  while (offset < wholeSeconds) {
    const date = calendarDate(timeZone, new Date(startedAtMs + offset * 1000));
    const finalOffset = wholeSeconds - 1;
    if (calendarDate(timeZone, new Date(startedAtMs + finalOffset * 1000)) === date) {
      elapsedByDate[date] = (elapsedByDate[date] ?? 0) + wholeSeconds - offset;
      break;
    }

    let low = offset + 1;
    let high = finalOffset;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      const middleDate = calendarDate(timeZone, new Date(startedAtMs + middle * 1000));
      if (middleDate === date) low = middle + 1;
      else high = middle;
    }
    elapsedByDate[date] = (elapsedByDate[date] ?? 0) + low - offset;
    offset = low;
  }
  return elapsedByDate;
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

function normalizedSessionDates(activity: ActivityTimer, fallbackDate: string): Array<{ date: string; seconds: number }> {
  const entries = Object.entries(activity.sessionSecondsByDate ?? {})
    .map(([date, seconds]) => ({ date, seconds: Math.max(0, Math.floor(seconds)) }))
    .filter((entry) => entry.seconds > 0)
    .sort((left, right) => left.date.localeCompare(right.date));
  const allocatedSeconds = entries.reduce((total, entry) => total + entry.seconds, 0);
  const missingSeconds = Math.max(0, activity.sessionSeconds - allocatedSeconds);
  if (missingSeconds > 0) {
    const fallback = entries.find((entry) => entry.date === fallbackDate);
    if (fallback) fallback.seconds += missingSeconds;
    else entries.push({ date: fallbackDate, seconds: missingSeconds });
  }
  return entries.length > 0 ? entries : [{ date: fallbackDate, seconds: activity.sessionSeconds }];
}

function allocateWholeMinutes(entries: Array<{ date: string; seconds: number }>): Array<{ date: string; minutes: number }> {
  const totalSeconds = entries.reduce((total, entry) => total + entry.seconds, 0);
  let remainingMinutes = Math.max(1, Math.round(totalSeconds / 60));
  const allocated = entries.map((entry) => {
    const minutes = Math.floor(entry.seconds / 60);
    remainingMinutes -= minutes;
    return { ...entry, minutes, remainder: entry.seconds % 60 };
  });

  const byRemainder = [...allocated].sort(
    (left, right) => right.remainder - left.remainder || left.date.localeCompare(right.date)
  );
  for (let index = 0; index < byRemainder.length && remainingMinutes > 0; index += 1) {
    byRemainder[index].minutes += 1;
    remainingMinutes -= 1;
  }

  return allocated
    .filter((entry) => entry.minutes > 0)
    .map(({ date, minutes }) => ({ date, minutes }));
}
