import { describe, expect, it, vi } from "vitest";
import type { ActivityTimer } from "../domain/track";
import {
  applyOpenFocusSessions,
  endFocusSession,
  loadOpenFocusSessions,
  startFocusSession,
  type ApiFocusSessionRead
} from "./focusSessions";

const activity: ActivityTimer = {
  id: "activity-7",
  activityId: 7,
  name: "Focused writing",
  category: "Project",
  energy: "consume",
  color: "#6f8f6b",
  todaySeconds: 0,
  sessionSeconds: 0,
  running: false
};

describe("focus session API", () => {
  it("sends idempotent Start and End commands without a result form", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response(true, 201, focusSession()))
      .mockResolvedValueOnce(
        response(true, 200, {
          session: {
            ...focusSession(),
            status: "completed",
            version: 2,
            accumulated_seconds: 95,
            elapsed_seconds: 95,
            current_run_started_at: null,
            completed_at: "2026-07-25T18:01:35Z"
          },
          time_logs: []
        })
      );

    await startFocusSession({
      apiBaseUrl: "http://127.0.0.1:8000",
      fetchImpl,
      activityId: 7,
      taskId: 21,
      idempotencyKey: "start-key"
    });
    await endFocusSession({
      apiBaseUrl: "http://127.0.0.1:8000",
      fetchImpl,
      sessionId: 31,
      expectedVersion: 1,
      idempotencyKey: "end-key"
    });

    expect(fetchImpl.mock.calls[0][0]).toBe(
      "http://127.0.0.1:8000/focus-sessions"
    );
    expect(fetchImpl.mock.calls[0][1].headers["Idempotency-Key"]).toBe(
      "start-key"
    );
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      activity_id: 7,
      task_id: 21
    });
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({
      command: "end",
      expected_version: 1
    });
  });

  it("loads running sessions and hydrates exact elapsed state by local date", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response(true, 200, [
        focusSession({
          current_run_started_at: "2026-07-26T06:59:58Z",
          started_at: "2026-07-26T06:59:58Z",
          elapsed_seconds: 4
        })
      ])
    );

    const loaded = await loadOpenFocusSessions({
      apiBaseUrl: "http://127.0.0.1:8000",
      fetchImpl
    });
    const hydrated = applyOpenFocusSessions(
      [activity],
      loaded.data ?? [],
      "America/Los_Angeles"
    );

    expect(hydrated[0]).toMatchObject({
      running: true,
      focusSessionId: 31,
      focusSessionVersion: 1,
      sessionSeconds: 4,
      runSeconds: 4,
      sessionSecondsByDate: {
        "2026-07-25": 2,
        "2026-07-26": 2
      }
    });
  });

  it("returns stable backend conflict details", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response(false, 409, {
        detail: {
          code: "version_conflict",
          message: "The FocusSession changed after it was loaded",
          current: { ...focusSession(), version: 2 }
        }
      })
    );

    const result = await endFocusSession({
      apiBaseUrl: "http://127.0.0.1:8000",
      fetchImpl,
      sessionId: 31,
      expectedVersion: 1,
      idempotencyKey: "end-key"
    });

    expect(result.status).toBe("conflict");
    expect(result.code).toBe("version_conflict");
    expect(result.current?.version).toBe(2);
  });
});

function focusSession(
  overrides: Partial<ApiFocusSessionRead> = {}
): ApiFocusSessionRead {
  return {
    id: 31,
    user_id: 1,
    activity_id: 7,
    task_id: 21,
    project_id: 3,
    activity_name: "Focused writing",
    activity_type: "consuming",
    type_source: "user_selected",
    task_title: "Draft findings",
    timezone: "America/Los_Angeles",
    status: "running",
    accumulated_seconds: 0,
    current_run_started_at: "2026-07-25T18:00:00Z",
    elapsed_seconds: 0,
    version: 1,
    started_at: "2026-07-25T18:00:00Z",
    completed_at: null,
    cancelled_at: null,
    created_at: "2026-07-25T18:00:00Z",
    updated_at: "2026-07-25T18:00:00Z",
    ...overrides
  };
}

function response(ok: boolean, status: number, payload: unknown) {
  return {
    ok,
    status,
    json: async () => payload
  };
}
