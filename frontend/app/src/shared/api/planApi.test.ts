import { describe, expect, it } from "vitest";
import { demoWeek } from "../demo/demoWeek";
import type { FetchLike } from "./loadAppWeek";
import { deletePlan, loadPlanRecords, savePlanDraft } from "./planApi";

const apiPlan = {
  id: 4,
  user_id: 7,
  week_start: "2026-06-15",
  week_end: "2026-06-21",
  planned_capacity_minutes: 1800,
  slack_target_percent: 20,
  items: [
    {
      id: 8,
      weekly_plan_id: 4,
      project_id: 3,
      title: "Restart block",
      planned_minutes: 120,
      priority: 1,
      is_completed: false,
      created_at: "2026-07-15T12:00:00",
      updated_at: "2026-07-15T12:00:00"
    }
  ],
  note: "Next week",
  created_at: "2026-07-15T12:00:00",
  updated_at: "2026-07-15T12:00:00"
};

const apiProject = {
  id: 3,
  title: "Resume and applications",
  stage: "stable",
  status: "active",
  weekly_min_minutes: 60,
  weekly_target_minutes: 180
};

describe("planApi", () => {
  it("loads user-scoped plans and projects into the frontend model", async () => {
    const calls: Array<{ input: string; init: RequestInit }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      calls.push({ input, init });
      return {
        ok: true,
        status: 200,
        json: async () => input.endsWith("/weekly-plans") ? [apiPlan] : [apiProject]
      };
    };

    const result = await loadPlanRecords({
      apiBaseUrl: "http://127.0.0.1:8000/",
      userId: 7,
      fetchImpl
    });

    expect(result.status).toBe("ok");
    expect(result.data?.plans[0]).toMatchObject({
      id: 4,
      week: { start: "2026-06-15", end: "2026-06-21" },
      capacityMinutes: 1800,
      items: [{ projectId: 3, plannedMinutes: 120 }]
    });
    expect(result.data?.projects[0].title).toBe("Resume and applications");
    expect(calls.map((call) => call.input)).toEqual([
      "http://127.0.0.1:8000/weekly-plans",
      "http://127.0.0.1:8000/projects"
    ]);
    expect(calls[0].init.headers).toMatchObject({ "X-Theseus-User-Id": "7" });
  });

  it("creates a new target week and replaces an existing target week", async () => {
    const calls: Array<{ input: string; init: RequestInit }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      calls.push({ input, init });
      return { ok: true, status: init.method === "POST" ? 201 : 200, json: async () => apiPlan };
    };
    const draft = {
      ...demoWeek.plan.sourcePlan,
      week: demoWeek.plan.targetWeek
    };

    await savePlanDraft({ apiBaseUrl: "http://127.0.0.1:8000", userId: 7, draft, fetchImpl });
    await savePlanDraft({ apiBaseUrl: "http://127.0.0.1:8000", userId: 7, draft: { ...draft, id: 4 }, fetchImpl });

    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].input).toBe("http://127.0.0.1:8000/weekly-plans");
    expect(calls[1].init.method).toBe("PUT");
    expect(calls[1].input).toBe("http://127.0.0.1:8000/weekly-plans/4");
    expect(JSON.parse(String(calls[1].init.body))).toMatchObject({
      week_start: "2026-06-15",
      week_end: "2026-06-21",
      planned_capacity_minutes: 1800
    });
  });

  it("preserves conflict as a distinct recoverable result", async () => {
    const result = await savePlanDraft({
      apiBaseUrl: "http://127.0.0.1:8000",
      userId: 7,
      draft: { ...demoWeek.plan.sourcePlan, week: demoWeek.plan.targetWeek },
      fetchImpl: async () => ({ ok: false, status: 409, json: async () => ({}) })
    });

    expect(result).toEqual({
      status: "conflict",
      data: null,
      error: "Plan conflicts with another saved week"
    });
  });

  it("deletes only through the user-scoped plan endpoint", async () => {
    const calls: Array<{ input: string; init: RequestInit }> = [];
    const result = await deletePlan({
      apiBaseUrl: "http://127.0.0.1:8000",
      userId: 7,
      planId: 4,
      fetchImpl: async (input, init) => {
        calls.push({ input, init });
        return { ok: true, status: 204, json: async () => ({}) };
      }
    });

    expect(result.status).toBe("ok");
    expect(calls[0]).toMatchObject({
      input: "http://127.0.0.1:8000/weekly-plans/4",
      init: { method: "DELETE" }
    });
  });
});
