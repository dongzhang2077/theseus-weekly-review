import { describe, expect, it } from "vitest";
import type { FetchLike } from "./loadAppWeek";
import { createTask, loadTasks, updateTask } from "./tasks";

const apiTask = {
  id: 21,
  user_id: 7,
  project_id: 3,
  title: "Draft findings",
  description: "",
  status: "open",
  priority: 1,
  estimated_minutes: 120,
  due_date: "2026-08-01",
  created_source: "user",
  completed_at: null,
  archived_at: null,
  version: 1,
  created_at: "2026-07-22T12:00:00Z",
  updated_at: "2026-07-22T12:00:00Z"
} as const;

describe("tasks API", () => {
  it("maps list records and requests archived Tasks explicitly", async () => {
    const calls: Array<{ input: string; init: RequestInit }> = [];
    const result = await loadTasks({
      apiBaseUrl: "http://127.0.0.1:8000/",
      includeArchived: true,
      fetchImpl: async (input, init) => {
        calls.push({ input, init });
        return ok([apiTask]);
      }
    });

    expect(result.data?.[0]).toMatchObject({
      id: 21,
      projectId: 3,
      estimatedMinutes: 120,
      createdSource: "user"
    });
    expect(calls[0]).toMatchObject({
      input: "http://127.0.0.1:8000/tasks?include_archived=true",
      init: { method: "GET" }
    });
  });

  it("uses server-owned provenance on create", async () => {
    let body: unknown;
    await createTask({
      apiBaseUrl: "http://127.0.0.1:8000",
      draft: {
        projectId: 3,
        title: "Draft findings",
        description: "",
        priority: 1,
        estimatedMinutes: 120,
        dueDate: "2026-08-01"
      },
      fetchImpl: async (_input, init) => {
        body = JSON.parse(String(init.body));
        return ok(apiTask, 201);
      }
    });

    expect(body).toEqual({
      project_id: 3,
      title: "Draft findings",
      description: "",
      priority: 1,
      estimated_minutes: 120,
      due_date: "2026-08-01"
    });
    expect(body).not.toHaveProperty("created_source");
  });

  it("returns the current Task for a recoverable version conflict", async () => {
    const current = { ...apiTask, title: "Current title", version: 2 };
    const result = await updateTask({
      apiBaseUrl: "http://127.0.0.1:8000",
      taskId: 21,
      draft: { expectedVersion: 1, title: "Stale title" },
      fetchImpl: async () => ({
        ok: false,
        status: 409,
        json: async () => ({
          detail: {
            code: "version_conflict",
            message: "The task changed after it was loaded",
            current
          }
        })
      })
    });

    expect(result.status).toBe("conflict");
    expect(result.current).toMatchObject({ title: "Current title", version: 2 });
  });
});

function ok(data: unknown, status = 200): ReturnType<FetchLike> {
  return Promise.resolve({ ok: true, status, json: async () => data });
}
