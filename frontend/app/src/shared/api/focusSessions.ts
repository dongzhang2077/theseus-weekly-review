import type { ActivityTimer } from "../domain/track";
import type { FetchLike } from "./loadAppWeek";
import { splitElapsedSecondsByDate, type ApiTimeLogRead } from "./timeLogs";

export type ApiFocusStatus = "running" | "completed" | "cancelled";
export type FocusApiStatus = "ok" | "conflict" | "not_found" | "error";

export interface ApiFocusSessionRead {
  id: number;
  user_id: number;
  activity_id: number;
  task_id: number | null;
  project_id: number | null;
  activity_name: string;
  activity_type: "consuming" | "neutral" | "restore" | "destroy";
  type_source: "user_selected" | "ai_suggested" | "user_corrected";
  task_title: string | null;
  timezone: string;
  status: ApiFocusStatus;
  accumulated_seconds: number;
  current_run_started_at: string | null;
  elapsed_seconds: number;
  version: number;
  started_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiFocusCommandResponse {
  session: ApiFocusSessionRead;
  time_logs: ApiTimeLogRead[];
}

export interface FocusApiResult<T> {
  status: FocusApiStatus;
  data: T | null;
  code: string | null;
  error: string | null;
  current: ApiFocusSessionRead | null;
}

interface FocusApiOptions {
  apiBaseUrl?: string;
  fetchImpl?: FetchLike;
}

interface FocusErrorPayload {
  detail?: {
    code?: string;
    message?: string;
    current?: ApiFocusSessionRead;
  };
}

export async function loadOpenFocusSessions(
  options: FocusApiOptions
): Promise<FocusApiResult<ApiFocusSessionRead[]>> {
  return request<ApiFocusSessionRead[]>(
    options,
    "/focus-sessions?state=open",
    "GET"
  );
}

export async function startFocusSession(
  options: FocusApiOptions & {
    activityId: number;
    taskId?: number;
    idempotencyKey: string;
  }
): Promise<FocusApiResult<ApiFocusSessionRead>> {
  return request<ApiFocusSessionRead>(
    options,
    "/focus-sessions",
    "POST",
    options.idempotencyKey,
    {
      activity_id: options.activityId,
      ...(options.taskId ? { task_id: options.taskId } : {})
    }
  );
}

export async function endFocusSession(
  options: FocusApiOptions & {
    sessionId: number;
    expectedVersion: number;
    idempotencyKey: string;
  }
): Promise<FocusApiResult<ApiFocusCommandResponse>> {
  return commandFocusSession(options, "end");
}

export async function cancelFocusSession(
  options: FocusApiOptions & {
    sessionId: number;
    expectedVersion: number;
    idempotencyKey: string;
  }
): Promise<FocusApiResult<ApiFocusCommandResponse>> {
  return commandFocusSession(options, "cancel");
}

export function applyOpenFocusSessions(
  activities: ActivityTimer[],
  sessions: ApiFocusSessionRead[],
  timeZone?: string
): ActivityTimer[] {
  const byActivity = new Map(
    sessions
      .filter((session) => session.status === "running")
      .map((session) => [session.activity_id, session])
  );
  return activities.map((activity) => {
    const session = activity.activityId
      ? byActivity.get(activity.activityId)
      : undefined;
    return session
      ? applyFocusSession(activity, session, timeZone)
      : clearFocusSession(activity);
  });
}

export function applyFocusSession(
  activity: ActivityTimer,
  session: ApiFocusSessionRead,
  timeZone?: string
): ActivityTimer {
  const startedAtMs = session.current_run_started_at
    ? Date.parse(session.current_run_started_at)
    : Number.NaN;
  const sessionSecondsByDate = Number.isFinite(startedAtMs)
    ? splitElapsedSecondsByDate(
        startedAtMs,
        session.elapsed_seconds,
        timeZone ?? session.timezone
      )
    : undefined;
  return {
    ...activity,
    activityId: session.activity_id,
    ...(session.task_id ? { taskId: session.task_id } : { taskId: undefined }),
    ...(session.project_id
      ? { projectId: session.project_id }
      : { projectId: undefined }),
    focusSessionId: session.id,
    focusSessionVersion: session.version,
    focusStartedAt: session.started_at,
    sessionSeconds: session.elapsed_seconds,
    sessionSecondsByDate,
    runSeconds: session.elapsed_seconds,
    running: session.status === "running"
  };
}

export function clearFocusSession(activity: ActivityTimer): ActivityTimer {
  return {
    ...activity,
    focusSessionId: undefined,
    focusSessionVersion: undefined,
    focusStartedAt: undefined,
    sessionSeconds: 0,
    sessionSecondsByDate: undefined,
    runSeconds: 0,
    running: false
  };
}

export function createIdempotencyKey(prefix: "start" | "end" | "cancel"): string {
  const randomId = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `focus-${prefix}-${randomId}`;
}

async function commandFocusSession(
  options: FocusApiOptions & {
    sessionId: number;
    expectedVersion: number;
    idempotencyKey: string;
  },
  command: "end" | "cancel"
): Promise<FocusApiResult<ApiFocusCommandResponse>> {
  return request<ApiFocusCommandResponse>(
    options,
    `/focus-sessions/${options.sessionId}/commands`,
    "POST",
    options.idempotencyKey,
    {
      command,
      expected_version: options.expectedVersion
    }
  );
}

async function request<T>(
  options: FocusApiOptions,
  path: string,
  method: "GET" | "POST",
  idempotencyKey?: string,
  body?: unknown
): Promise<FocusApiResult<T>> {
  const apiBaseUrl = options.apiBaseUrl?.trim();
  if (!apiBaseUrl) {
    return failure("error", "api_unavailable", "API base URL is not configured");
  }
  try {
    const response = await (options.fetchImpl ?? fetch)(
      `${apiBaseUrl.replace(/\/$/, "")}${path}`,
      {
        method,
        headers: {
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      }
    );
    if (!response.ok) {
      const payload = await response.json() as FocusErrorPayload;
      return {
        status: response.status === 409
          ? "conflict"
          : response.status === 404
            ? "not_found"
            : "error",
        data: null,
        code: payload.detail?.code ?? null,
        error: payload.detail?.message ?? `Backend returned ${response.status}`,
        current: payload.detail?.current ?? null
      };
    }
    return {
      status: "ok",
      data: await response.json() as T,
      code: null,
      error: null,
      current: null
    };
  } catch (error) {
    return failure(
      "error",
      "network_error",
      error instanceof Error ? error.message : "Focus request failed"
    );
  }
}

function failure<T>(
  status: FocusApiStatus,
  code: string,
  error: string
): FocusApiResult<T> {
  return { status, data: null, code, error, current: null };
}
