import { describe, expect, it } from "vitest";
import { demoWeek } from "../demo/demoWeek";
import { loadAppWeek, type FetchLike } from "./loadAppWeek";
import type { WeeklyReviewApiResponse } from "./weeklyReview";

const apiReview: WeeklyReviewApiResponse = {
  week_start: "2026-06-08",
  week_end: "2026-06-14",
  wins: [{ title: "Backend shipped", evidence: "Backend received 7 hours." }],
  insights: [{ title: "Plan drift visible", evidence: "Frontend work was lighter than planned." }],
  risk_flags: [{ type: "plan_drift", severity: "medium", evidence: "Frontend was 3 hours under plan." }],
  next_steps: [{ title: "Protect frontend block", reason: "Keeps the demo path balanced." }],
  evidence: {
    plan: {
      planned_slack_minutes: 180,
      project_drift: [
        {
          project_id: 1,
          project_title: "Frontend",
          planned_minutes: 240,
          actual_minutes: 60,
          difference_minutes: -180,
          status: "under_plan"
        }
      ]
    },
    activity: {
      mix: {
        consuming: 300,
        restore: 60
      }
    }
  },
  generated_text: "Backend moved, frontend needs a small protected block."
};

describe("loadAppWeek", () => {
  it("uses demo data when no API base URL is configured", async () => {
    const loaded = await loadAppWeek();

    expect(loaded.source).toBe("demo");
    expect(loaded.week).toBe(demoWeek);
    expect(loaded.error).toBeNull();
  });

  it("loads and maps backend data when the API returns OK", async () => {
    const calls: Array<{ input: string; init: RequestInit }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      calls.push({ input, init });
      return {
        ok: true,
        status: 200,
        json: async () => apiReview
      };
    };

    const loaded = await loadAppWeek({ apiBaseUrl: "http://127.0.0.1:8000/", fetchImpl });

    expect(loaded.source).toBe("api");
    expect(loaded.error).toBeNull();
    expect(loaded.week.review.wins[0].title).toBe("Backend shipped");
    expect(loaded.week.plan.suggestion?.title).toBe("Protect frontend block");
    expect(calls[0].input).toBe("http://127.0.0.1:8000/reviews/weekly/generate");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(calls[0].init.body)).mode).toBe("supportive_text");
  });

  it("retries with deterministic mode when supportive generation fails", async () => {
    const calls: Array<{ input: string; init: RequestInit }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      calls.push({ input, init });
      if (calls.length === 1) {
        return { ok: false, status: 502, json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => apiReview };
    };

    const loaded = await loadAppWeek({
      apiBaseUrl: "http://127.0.0.1:8000",
      fetchImpl
    });

    expect(loaded.source).toBe("api");
    expect(loaded.week.review.wins[0].title).toBe("Backend shipped");
    expect(loaded.error).toBe(
      "Supportive review unavailable; deterministic review loaded"
    );
    expect(calls).toHaveLength(2);
    expect(JSON.parse(String(calls[0].init.body)).mode).toBe("supportive_text");
    expect(JSON.parse(String(calls[1].init.body)).mode).toBe(
      "deterministic_first"
    );
  });

  it("shows an empty week when the selected user has no weekly plan", async () => {
    let calls = 0;
    const fetchImpl: FetchLike = async () => {
      calls += 1;
      return {
        ok: false,
        status: 404,
        json: async () => ({})
      };
    };

    const loaded = await loadAppWeek({ apiBaseUrl: "http://127.0.0.1:8000", fetchImpl });

    expect(loaded.source).toBe("empty");
    expect(loaded.week).toBe(demoWeek);
    expect(loaded.error).toBeNull();
    expect(calls).toBe(1);
  });

  it("returns an explicit error state when the backend fails", async () => {
    const loaded = await loadAppWeek({
      apiBaseUrl: "http://127.0.0.1:8000",
      fetchImpl: async () => ({
        ok: false,
        status: 500,
        json: async () => ({})
      })
    });

    expect(loaded.source).toBe("error");
    expect(loaded.week).toBe(demoWeek);
    expect(loaded.error).toBe("Backend returned 500");
  });

});
