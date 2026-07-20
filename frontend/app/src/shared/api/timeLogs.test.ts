import { describe, expect, it } from "vitest";
import {
  activitySessionToTimeLog,
  applyTodayTimeLogs,
  calendarDate,
  energyToApiActivityType,
  loadTimeLogs,
  saveActivitySession,
  saveTimeLog,
  type ApiTimeLogRead,
  type TimeLogCreatePayload
} from "./timeLogs";
import type { ActivityTimer } from "../domain/track";
import type { FetchLike } from "./loadAppWeek";

const activity: ActivityTimer = {
  id: "frontend",
  activityId: 7,
  projectId: 3,
  name: "Frontend build block",
  category: "Project",
  energy: "consume",
  color: "#6f8f6b",
  todaySeconds: 42 * 60,
  sessionSeconds: 95,
  running: true
};

describe("timeLogs api helpers", () => {
  it("maps frontend energy terms to backend activity types", () => {
    expect(energyToApiActivityType("consume")).toBe("consuming");
    expect(energyToApiActivityType("restore")).toBe("restore");
    expect(energyToApiActivityType("neutral")).toBe("neutral");
    expect(energyToApiActivityType("destroy")).toBe("destroy");
  });

  it("builds a backend-compatible time-log payload from a completed session", () => {
    expect(activitySessionToTimeLog(activity, { date: "2026-06-26", note: "Focused UI polish." })).toEqual({
      activity_id: 7,
      project_id: 3,
      date: "2026-06-26",
      duration_minutes: 2,
      activity_name: "Frontend build block",
      activity_type: "consuming",
      type_source: "user_selected",
      note: "Focused UI polish."
    });
  });

  it("does not build a time-log payload for an empty session", () => {
    expect(activitySessionToTimeLog({ ...activity, sessionSeconds: 0 })).toBeNull();
  });

  it("uses the account timezone rather than UTC for the calendar date", () => {
    const losAngelesEvening = new Date("2026-07-19T01:00:00.000Z");

    expect(calendarDate("America/Los_Angeles", losAngelesEvening)).toBe("2026-07-18");
    expect(calendarDate("Asia/Shanghai", losAngelesEvening)).toBe("2026-07-19");
    expect(calendarDate("Not/A_Timezone", losAngelesEvening)).toMatch(/^2026-07-(18|19)$/);
  });

  it("posts time-log payloads when an API base URL is configured", async () => {
    const payload = activitySessionToTimeLog(activity, { date: "2026-06-26" }) as TimeLogCreatePayload;
    const calls: Array<{ input: string; init: RequestInit }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      calls.push({ input, init });
      return {
        ok: true,
        status: 201,
        json: async () => ({ id: 1, ...payload })
      };
    };

    const result = await saveTimeLog({ apiBaseUrl: "http://127.0.0.1:8000/", payload, fetchImpl });

    expect(result).toEqual({ saved: true, error: null });
    expect(calls[0].input).toBe("http://127.0.0.1:8000/time-logs");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject(payload);
  });

  it("keeps demo mode explicit when no API base URL is configured", async () => {
    const payload = activitySessionToTimeLog(activity, { date: "2026-06-26" }) as TimeLogCreatePayload;

    await expect(saveTimeLog({ payload })).resolves.toEqual({
      saved: false,
      error: "API base URL is not configured"
    });
  });

  it("can save a completed activity session directly", async () => {
    const calls: Array<{ input: string; init: RequestInit }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      calls.push({ input, init });
      return {
        ok: true,
        status: 201,
        json: async () => ({})
      };
    };

    await expect(
      saveActivitySession({
        apiBaseUrl: "http://127.0.0.1:8000",
        activity,
        date: "2026-06-26",
        fetchImpl
      })
    ).resolves.toEqual({ saved: true, error: null });

    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({
      date: "2026-06-26",
      duration_minutes: 2,
      activity_name: "Frontend build block"
    });
  });

  it("loads account-scoped time logs from the authenticated API", async () => {
    const log = apiLog({ id: 9, date: "2026-07-18", duration_minutes: 12 });
    const fetchImpl: FetchLike = async () => ({
      ok: true,
      status: 200,
      json: async () => [log]
    });

    await expect(
      loadTimeLogs({ apiBaseUrl: "http://127.0.0.1:8000/", fetchImpl })
    ).resolves.toEqual({ loaded: true, logs: [log], error: null });
  });

  it("hydrates Today from persisted logs without counting a project twice", () => {
    const duplicateProjectCards: ActivityTimer[] = [
      { ...activity, id: "review-project-3", activityId: undefined, todaySeconds: 0 },
      { ...activity, id: "plan-item-8", activityId: undefined, todaySeconds: 0 }
    ];
    const logs = [
      apiLog({ id: 1, date: "2026-07-18", duration_minutes: 12 }),
      apiLog({ id: 2, date: "2026-07-17", duration_minutes: 30 })
    ];

    const hydrated = applyTodayTimeLogs(duplicateProjectCards, logs, "2026-07-18");

    expect(hydrated[0].todaySeconds).toBe(12 * 60);
    expect(hydrated[1].todaySeconds).toBe(0);
  });

  it("restores an unlinked saved activity after a browser reload", () => {
    const logs = [apiLog({
      id: 4,
      activity_id: undefined,
      project_id: undefined,
      activity_name: "Inbox cleanup",
      activity_type: "neutral",
      date: "2026-07-18",
      duration_minutes: 7
    })];

    expect(applyTodayTimeLogs([], logs, "2026-07-18")).toEqual([
      expect.objectContaining({
        id: "today-name-Inbox cleanup",
        name: "Inbox cleanup",
        todaySeconds: 7 * 60,
        focusContext: {
          source: "persisted_log",
          reason: "Recorded from today's saved focus history"
        }
      })
    ]);
  });
});

function apiLog(overrides: Partial<ApiTimeLogRead>): ApiTimeLogRead {
  return {
    id: 1,
    user_id: 1,
    project_id: 3,
    date: "2026-07-18",
    duration_minutes: 2,
    activity_name: "Frontend build block",
    activity_type: "consuming",
    type_source: "user_selected",
    note: "",
    created_at: "2026-07-18T12:00:00Z",
    updated_at: "2026-07-18T12:00:00Z",
    ...overrides
  };
}
