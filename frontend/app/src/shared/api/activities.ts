import type {
  ActivityCatalog,
  ActivityCreateDraft,
  ActivityRecord,
  ActivityUpdateDraft,
  PersistedActivityType,
  PersistedActivityTypeSource
} from "../domain/activity";
import type { PlanProject } from "../domain/plan";
import type { ActivityTimer, EnergyKind } from "../domain/track";
import type { FetchLike } from "./loadAppWeek";

interface ActivityApiRecord {
  id: number;
  user_id: number;
  project_id: number | null;
  name: string;
  description: string;
  activity_type: PersistedActivityType;
  type_source: PersistedActivityTypeSource;
  version: number;
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

interface ActivityConflictPayload {
  detail?: {
    code?: string;
    message?: string;
    current?: ActivityApiRecord;
  };
}

export type ActivityApiStatus = "ok" | "conflict" | "not_found" | "error";

export interface ActivityApiResult<T> {
  status: ActivityApiStatus;
  data: T | null;
  current: ActivityRecord | null;
  error: string | null;
}

interface ActivityApiOptions {
  apiBaseUrl?: string;
  fetchImpl?: FetchLike;
}

export async function loadActivityCatalog(
  options: ActivityApiOptions
): Promise<ActivityApiResult<ActivityCatalog>> {
  const [activities, projects] = await Promise.all([
    request<ActivityApiRecord[]>(options, "/activities", "GET"),
    request<ProjectApiRecord[]>(options, "/projects", "GET")
  ]);
  if (activities.status !== "ok" || !activities.data) return failure(activities);
  if (projects.status !== "ok" || !projects.data) return failure(projects);
  return success({
    activities: activities.data.map(mapActivity),
    projects: projects.data.map(mapProject)
  });
}

export async function createActivity(
  options: ActivityApiOptions & { draft: ActivityCreateDraft }
): Promise<ActivityApiResult<ActivityRecord>> {
  const response = await request<ActivityApiRecord>(
    options,
    "/activities",
    "POST",
    {
      project_id: options.draft.projectId,
      name: options.draft.name,
      description: options.draft.description,
      activity_type: options.draft.activityType
    }
  );
  return response.status === "ok" && response.data
    ? success(mapActivity(response.data))
    : failure(response);
}

export async function updateActivity(
  options: ActivityApiOptions & {
    activityId: number;
    draft: ActivityUpdateDraft;
  }
): Promise<ActivityApiResult<ActivityRecord>> {
  const draft = options.draft;
  const response = await request<ActivityApiRecord>(
    options,
    `/activities/${options.activityId}`,
    "PATCH",
    {
      expected_version: draft.expectedVersion,
      ...("projectId" in draft ? { project_id: draft.projectId } : {}),
      ...("name" in draft ? { name: draft.name } : {}),
      ...("description" in draft ? { description: draft.description } : {}),
      ...("activityType" in draft ? { activity_type: draft.activityType } : {})
    }
  );
  if (response.status === "ok" && response.data) {
    return success(mapActivity(response.data));
  }
  return { ...failure<ActivityRecord>(response), current: response.current };
}

export function activityRecordToTimer(
  activity: ActivityRecord,
  projects: readonly PlanProject[]
): ActivityTimer {
  const projectTitle = projects.find((project) => project.id === activity.projectId)?.title;
  return {
    id: `activity-${activity.id}`,
    activityId: activity.id,
    activityVersion: activity.version,
    activityDescription: activity.description,
    activityTypeSource: activity.typeSource,
    ...(activity.projectId ? { projectId: activity.projectId } : {}),
    ...(projectTitle ? { projectTitle } : {}),
    name: activity.name,
    category: activity.projectId ? "Project" : "Activity",
    energy: activityTypeToEnergy(activity.activityType),
    color: activityColor(activity.id),
    todaySeconds: 0,
    sessionSeconds: 0,
    runSeconds: 0,
    running: false,
    focusContext: {
      source: "persisted_activity",
      reason: "Saved to your account"
    }
  };
}

export function mergeActivityCatalog(
  persisted: ActivityTimer[],
  contextual: ActivityTimer[]
): ActivityTimer[] {
  const merged = persisted.map((activity) => ({ ...activity }));
  for (const candidate of contextual) {
    const index = merged.findIndex((activity) =>
      candidate.activityId !== undefined && activity.activityId !== undefined
        ? candidate.activityId === activity.activityId
        : candidate.name === activity.name &&
          candidate.projectId === activity.projectId
    );
    if (index < 0) {
      merged.push(candidate);
      continue;
    }
    merged[index] = {
      ...candidate,
      ...merged[index],
      recommended: candidate.recommended ?? merged[index].recommended,
      focusContext: candidate.focusContext ?? merged[index].focusContext
    };
  }
  return merged;
}

function activityTypeToEnergy(activityType: PersistedActivityType): EnergyKind {
  return activityType === "consuming" ? "consume" : activityType;
}

function activityColor(activityId: number): string {
  const colors = ["#6f8f6b", "#8aa9c0", "#c8a25f", "#d69a9a"];
  return colors[(activityId - 1) % colors.length] ?? colors[0];
}

async function request<T>(
  options: ActivityApiOptions,
  path: string,
  method: "GET" | "POST" | "PATCH",
  body?: unknown
): Promise<ActivityApiResult<T>> {
  const apiBaseUrl = options.apiBaseUrl?.trim();
  if (!apiBaseUrl) {
    return {
      status: "error",
      data: null,
      current: null,
      error: "API base URL is not configured"
    };
  }
  try {
    const response = await (options.fetchImpl ?? fetch)(
      `${apiBaseUrl.replace(/\/$/, "")}${path}`,
      {
        method,
        headers: body === undefined ? {} : { "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      }
    );
    if (!response.ok) {
      const payload = await response.json() as ActivityConflictPayload;
      return {
        status: response.status === 409
          ? "conflict"
          : response.status === 404
            ? "not_found"
            : "error",
        data: null,
        current: payload.detail?.current
          ? mapActivity(payload.detail.current)
          : null,
        error: payload.detail?.message ?? `Backend returned ${response.status}`
      };
    }
    return {
      status: "ok",
      data: await response.json() as T,
      current: null,
      error: null
    };
  } catch (error) {
    return {
      status: "error",
      data: null,
      current: null,
      error: error instanceof Error ? error.message : "Activity request failed"
    };
  }
}

function mapActivity(activity: ActivityApiRecord): ActivityRecord {
  return {
    id: activity.id,
    userId: activity.user_id,
    projectId: activity.project_id,
    name: activity.name,
    description: activity.description,
    activityType: activity.activity_type,
    typeSource: activity.type_source,
    version: activity.version,
    createdAt: activity.created_at,
    updatedAt: activity.updated_at
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

function success<T>(data: T): ActivityApiResult<T> {
  return { status: "ok", data, current: null, error: null };
}

function failure<T>(result: ActivityApiResult<unknown>): ActivityApiResult<T> {
  return {
    status: result.status,
    data: null,
    current: null,
    error: result.error
  };
}
