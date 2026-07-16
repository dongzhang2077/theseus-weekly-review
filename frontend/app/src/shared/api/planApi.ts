import type { PlanDraft, PlanItem, PlanProject } from "../domain/plan";
import type { FetchLike } from "./loadAppWeek";
import { isValidLocalUserId, localUserHeaders } from "./localUserContext";

interface WeeklyPlanApiRecord {
  id: number;
  user_id: number;
  week_start: string;
  week_end: string;
  planned_capacity_minutes: number;
  slack_target_percent: number;
  items: PlannedItemApiRecord[];
  note: string;
  created_at: string;
  updated_at: string;
}

interface PlannedItemApiRecord {
  id: number;
  weekly_plan_id: number;
  project_id: number | null;
  title: string;
  planned_minutes: number;
  priority: number;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

interface ProjectApiRecord {
  id: number;
  title: string;
  stage: PlanProject["stage"];
  status: PlanProject["status"];
  weekly_min_minutes: number;
  weekly_target_minutes: number;
}

export interface PlanApiRecords {
  plans: PlanDraft[];
  projects: PlanProject[];
}

export type PlanApiStatus = "ok" | "conflict" | "error";

export interface PlanApiResult<T> {
  status: PlanApiStatus;
  data: T | null;
  error: string | null;
}

interface PlanApiOptions {
  apiBaseUrl?: string;
  userId?: number;
  fetchImpl?: FetchLike;
}

export async function loadPlanRecords(
  options: PlanApiOptions
): Promise<PlanApiResult<PlanApiRecords>> {
  const plans = await requestJson<WeeklyPlanApiRecord[]>(options, "/weekly-plans", "GET");
  if (plans.status !== "ok" || !plans.data) {
    return { status: plans.status, data: null, error: plans.error };
  }
  const projects = await requestJson<ProjectApiRecord[]>(options, "/projects", "GET");
  if (projects.status !== "ok" || !projects.data) {
    return { status: projects.status, data: null, error: projects.error };
  }

  return {
    status: "ok",
    data: {
      plans: plans.data.map(mapWeeklyPlan),
      projects: projects.data.map(mapProject)
    },
    error: null
  };
}

export async function savePlanDraft(
  options: PlanApiOptions & { draft: PlanDraft }
): Promise<PlanApiResult<PlanDraft>> {
  const path = options.draft.id === null
    ? "/weekly-plans"
    : `/weekly-plans/${options.draft.id}`;
  const method = options.draft.id === null ? "POST" : "PUT";
  const result = await requestJson<WeeklyPlanApiRecord>(
    options,
    path,
    method,
    weeklyPlanPayload(options.draft)
  );
  return result.status === "ok" && result.data
    ? { status: "ok", data: mapWeeklyPlan(result.data), error: null }
    : { status: result.status, data: null, error: result.error };
}

export async function deletePlan(
  options: PlanApiOptions & { planId: number }
): Promise<PlanApiResult<null>> {
  return requestJson<null>(options, `/weekly-plans/${options.planId}`, "DELETE");
}

function weeklyPlanPayload(draft: PlanDraft) {
  return {
    week_start: draft.week.start,
    week_end: draft.week.end,
    planned_capacity_minutes: draft.capacityMinutes,
    slack_target_percent: draft.slackTargetPercent,
    items: draft.items.map((item) => ({
      project_id: item.projectId,
      title: item.title,
      planned_minutes: item.plannedMinutes,
      priority: item.priority,
      is_completed: item.isCompleted
    })),
    note: draft.note
  };
}

async function requestJson<T>(
  options: PlanApiOptions,
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: unknown
): Promise<PlanApiResult<T>> {
  const apiBaseUrl = options.apiBaseUrl?.trim();
  if (!apiBaseUrl) {
    return { status: "error", data: null, error: "API base URL is not configured" };
  }
  if (!isValidLocalUserId(options.userId)) {
    return { status: "error", data: null, error: "Local user is not selected" };
  }

  try {
    const response = await (options.fetchImpl ?? fetch)(
      `${apiBaseUrl.replace(/\/$/, "")}${path}`,
      {
        method,
        headers: localUserHeaders(options.userId, body !== undefined),
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      }
    );
    if (!response.ok) {
      return response.status === 409
        ? { status: "conflict", data: null, error: "Plan conflicts with another saved week" }
        : { status: "error", data: null, error: `Backend returned ${response.status}` };
    }
    if (method === "DELETE") {
      return { status: "ok", data: null, error: null };
    }
    return { status: "ok", data: await response.json() as T, error: null };
  } catch (error) {
    return {
      status: "error",
      data: null,
      error: error instanceof Error ? error.message : "Plan request failed"
    };
  }
}

function mapWeeklyPlan(plan: WeeklyPlanApiRecord): PlanDraft {
  return {
    id: plan.id,
    userId: plan.user_id,
    week: { start: plan.week_start, end: plan.week_end },
    capacityMinutes: plan.planned_capacity_minutes,
    slackTargetPercent: plan.slack_target_percent,
    items: plan.items.map(mapPlanItem),
    note: plan.note,
    createdAt: plan.created_at,
    updatedAt: plan.updated_at
  };
}

function mapPlanItem(item: PlannedItemApiRecord): PlanItem {
  return {
    id: item.id,
    projectId: item.project_id,
    title: item.title,
    plannedMinutes: item.planned_minutes,
    priority: item.priority,
    isCompleted: item.is_completed
  };
}

function mapProject(project: ProjectApiRecord): PlanProject {
  return {
    id: project.id,
    title: project.title,
    stage: project.stage,
    status: project.status,
    weeklyMinMinutes: project.weekly_min_minutes,
    weeklyTargetMinutes: project.weekly_target_minutes
  };
}
