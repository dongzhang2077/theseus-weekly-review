import { describe, expect, it } from "vitest";
import { createGoal, createProject, createWeeklyPlan } from "./coreRecords";
import type { FetchLike } from "./loadAppWeek";

function okFetch(calls: Array<{ input: string; init: RequestInit }>): FetchLike {
  return async (input, init) => {
    calls.push({ input, init });
    return {
      ok: true,
      status: 201,
      json: async () => ({ id: 1 })
    };
  };
}

describe("coreRecords api helpers", () => {
  it("creates goals through the documented endpoint", async () => {
    const calls: Array<{ input: string; init: RequestInit }> = [];

    await expect(
      createGoal({
        apiBaseUrl: "http://127.0.0.1:8000/",
        userId: 7,
        payload: {
          title: "Research Proposal",
          priority: 1,
          active_status: true
        },
        fetchImpl: okFetch(calls)
      })
    ).resolves.toEqual({ ok: true, data: { id: 1 }, error: null });

    expect(calls[0].input).toBe("http://127.0.0.1:8000/goals");
    expect(calls[0].init.headers).toMatchObject({ "X-Theseus-User-Id": "7" });
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({
      title: "Research Proposal",
      priority: 1,
      active_status: true
    });
  });

  it("creates projects through the documented endpoint", async () => {
    const calls: Array<{ input: string; init: RequestInit }> = [];

    await createProject({
      apiBaseUrl: "http://127.0.0.1:8000",
      userId: 7,
      payload: {
        goal_id: 1,
        title: "Theseus MVP",
        stage: "startup",
        weekly_min_minutes: 180,
        weekly_target_minutes: 480,
        status: "active"
      },
      fetchImpl: okFetch(calls)
    });

    expect(calls[0].input).toBe("http://127.0.0.1:8000/projects");
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({
      goal_id: 1,
      title: "Theseus MVP",
      stage: "startup"
    });
  });

  it("creates weekly plans with planned items", async () => {
    const calls: Array<{ input: string; init: RequestInit }> = [];

    await createWeeklyPlan({
      apiBaseUrl: "http://127.0.0.1:8000",
      userId: 7,
      payload: {
        week_start: "2026-06-08",
        week_end: "2026-06-14",
        planned_capacity_minutes: 1800,
        slack_target_percent: 20,
        items: [
          {
            project_id: 1,
            title: "Design backend schema",
            planned_minutes: 240,
            priority: 1
          }
        ],
        note: "Progress report week."
      },
      fetchImpl: okFetch(calls)
    });

    expect(calls[0].input).toBe("http://127.0.0.1:8000/weekly-plans");
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({
      week_start: "2026-06-08",
      week_end: "2026-06-14",
      items: [{ title: "Design backend schema" }]
    });
  });

  it("does not claim writes are saved when no API base URL is configured", async () => {
    await expect(createGoal({ payload: { title: "Research" } })).resolves.toEqual({
      ok: false,
      data: null,
      error: "API base URL is not configured"
    });
  });

  it("does not write when the local user is missing", async () => {
    await expect(
      createGoal({ apiBaseUrl: "http://127.0.0.1:8000", payload: { title: "Research" } })
    ).resolves.toEqual({
      ok: false,
      data: null,
      error: "Local user is not selected"
    });
  });
});
