import { describe, expect, it } from "vitest";
import { activitySessionToTimeLog, energyToApiActivityType, saveActivitySession, saveTimeLog, type TimeLogCreatePayload } from "./timeLogs";
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

    const result = await saveTimeLog({ apiBaseUrl: "http://127.0.0.1:8000/", userId: 7, payload, fetchImpl });

    expect(result).toEqual({ saved: true, error: null });
    expect(calls[0].input).toBe("http://127.0.0.1:8000/time-logs");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers).toMatchObject({ "X-Theseus-User-Id": "7" });
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
        userId: 7,
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

  it("does not save personal logs without a selected local user", async () => {
    const payload = activitySessionToTimeLog(activity, { date: "2026-06-26" }) as TimeLogCreatePayload;

    await expect(
      saveTimeLog({ apiBaseUrl: "http://127.0.0.1:8000", payload })
    ).resolves.toEqual({
      saved: false,
      error: "Local user is not selected"
    });
  });
});
