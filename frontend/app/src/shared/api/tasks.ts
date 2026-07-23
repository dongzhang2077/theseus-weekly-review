import type {
  TaskCreateDraft,
  TaskCreationSource,
  TaskRecord,
  TaskStatus,
  TaskUpdateDraft
} from "../domain/task";
import type { FetchLike } from "./loadAppWeek";

interface TaskApiRecord {
  id: number;
  user_id: number;
  project_id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: number;
  estimated_minutes: number | null;
  due_date: string | null;
  created_source: TaskCreationSource;
  completed_at: string | null;
  archived_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

interface TaskConflictDetail {
  detail?: {
    code?: string;
    message?: string;
    current?: TaskApiRecord;
  };
}

export type TaskApiStatus = "ok" | "conflict" | "not_found" | "error";

export interface TaskApiResult<T> {
  status: TaskApiStatus;
  data: T | null;
  current: TaskRecord | null;
  error: string | null;
}

interface TaskApiOptions {
  apiBaseUrl?: string;
  fetchImpl?: FetchLike;
}

export async function loadTasks(
  options: TaskApiOptions & { includeArchived?: boolean }
): Promise<TaskApiResult<TaskRecord[]>> {
  const suffix = options.includeArchived ? "?include_archived=true" : "";
  const response = await request<TaskApiRecord[]>(options, `/tasks${suffix}`, "GET");
  return response.status === "ok" && response.data
    ? success(response.data.map(mapTask))
    : failure(response);
}

export async function createTask(
  options: TaskApiOptions & { draft: TaskCreateDraft }
): Promise<TaskApiResult<TaskRecord>> {
  const response = await request<TaskApiRecord>(options, "/tasks", "POST", {
    project_id: options.draft.projectId,
    title: options.draft.title,
    description: options.draft.description,
    priority: options.draft.priority,
    estimated_minutes: options.draft.estimatedMinutes,
    due_date: options.draft.dueDate
  });
  return response.status === "ok" && response.data
    ? success(mapTask(response.data))
    : failure(response);
}

export async function updateTask(
  options: TaskApiOptions & { taskId: number; draft: TaskUpdateDraft }
): Promise<TaskApiResult<TaskRecord>> {
  const draft = options.draft;
  const response = await request<TaskApiRecord>(
    options,
    `/tasks/${options.taskId}`,
    "PATCH",
    {
      expected_version: draft.expectedVersion,
      ...("title" in draft ? { title: draft.title } : {}),
      ...("description" in draft ? { description: draft.description } : {}),
      ...("priority" in draft ? { priority: draft.priority } : {}),
      ...("estimatedMinutes" in draft
        ? { estimated_minutes: draft.estimatedMinutes }
        : {}),
      ...("dueDate" in draft ? { due_date: draft.dueDate } : {}),
      ...("status" in draft ? { status: draft.status } : {}),
      ...("archived" in draft ? { archived: draft.archived } : {})
    }
  );
  return response.status === "ok" && response.data
    ? success(mapTask(response.data))
    : failure(response);
}

async function request<T>(
  options: TaskApiOptions,
  path: string,
  method: "GET" | "POST" | "PATCH",
  body?: unknown
): Promise<TaskApiResult<T>> {
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
      const payload = await response.json() as TaskConflictDetail;
      const current = payload.detail?.current
        ? mapTask(payload.detail.current)
        : null;
      return {
        status: response.status === 409
          ? "conflict"
          : response.status === 404
            ? "not_found"
            : "error",
        data: null,
        current,
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
      error: error instanceof Error ? error.message : "Task request failed"
    };
  }
}

function mapTask(task: TaskApiRecord): TaskRecord {
  return {
    id: task.id,
    userId: task.user_id,
    projectId: task.project_id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    estimatedMinutes: task.estimated_minutes,
    dueDate: task.due_date,
    createdSource: task.created_source,
    completedAt: task.completed_at,
    archivedAt: task.archived_at,
    version: task.version,
    createdAt: task.created_at,
    updatedAt: task.updated_at
  };
}

function success<T>(data: T): TaskApiResult<T> {
  return { status: "ok", data, current: null, error: null };
}

function failure<T>(result: TaskApiResult<unknown>): TaskApiResult<T> {
  return {
    status: result.status,
    data: null,
    current: result.current,
    error: result.error
  };
}
