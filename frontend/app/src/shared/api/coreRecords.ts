import type { FetchLike } from "./loadAppWeek";

export type ProjectStage = "startup" | "stable" | "sprint" | "dormant" | "wake_up";
export type ProjectStatus = "active" | "paused" | "archived";

export interface GoalCreatePayload {
  title: string;
  description?: string;
  priority?: number;
  active_status?: boolean;
}

export interface ProjectCreatePayload {
  goal_id?: number | null;
  title: string;
  stage?: ProjectStage;
  deadline?: string | null;
  weekly_min_minutes?: number;
  weekly_target_minutes?: number;
  status?: ProjectStatus;
  last_activity_date?: string | null;
}

export interface PlannedItemCreatePayload {
  project_id?: number | null;
  title: string;
  planned_minutes: number;
  priority?: number;
  is_completed?: boolean;
}

export interface WeeklyPlanCreatePayload {
  week_start: string;
  week_end: string;
  planned_capacity_minutes?: number;
  slack_target_percent?: number;
  items?: PlannedItemCreatePayload[];
  note?: string;
}

export interface ApiWriteResult<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
}

export interface ApiWriteOptions<TPayload> {
  apiBaseUrl?: string;
  payload: TPayload;
  fetchImpl?: FetchLike;
}

export async function createGoal(options: ApiWriteOptions<GoalCreatePayload>): Promise<ApiWriteResult<unknown>> {
  return postJson({ ...options, path: "/goals" });
}

export async function createProject(options: ApiWriteOptions<ProjectCreatePayload>): Promise<ApiWriteResult<unknown>> {
  return postJson({ ...options, path: "/projects" });
}

export async function createWeeklyPlan(options: ApiWriteOptions<WeeklyPlanCreatePayload>): Promise<ApiWriteResult<unknown>> {
  return postJson({ ...options, path: "/weekly-plans" });
}

async function postJson<TPayload>(options: ApiWriteOptions<TPayload> & { path: string }): Promise<ApiWriteResult<unknown>> {
  const apiBaseUrl = options.apiBaseUrl?.trim();
  if (!apiBaseUrl) {
    return { ok: false, data: null, error: "API base URL is not configured" };
  }

  try {
    const response = await (options.fetchImpl ?? fetch)(`${apiBaseUrl.replace(/\/$/, "")}${options.path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(options.payload)
    });

    if (!response.ok) {
      return { ok: false, data: null, error: `Backend returned ${response.status}` };
    }

    return { ok: true, data: await response.json(), error: null };
  } catch (error) {
    return {
      ok: false,
      data: null,
      error: error instanceof Error ? error.message : "API request failed"
    };
  }
}
