import { describe, expect, it, vi } from "vitest";
import type { FetchLike } from "./loadAppWeek";
import {
  activityRecordToTimer,
  createActivity,
  loadActivityCatalog,
  mergeActivityCatalog,
  updateActivity
} from "./activities";

const activityRecord = {
  id: 7,
  user_id: 3,
  project_id: 11,
  name: "Focused writing",
  description: "Drafting",
  activity_type: "consuming",
  type_source: "user_selected",
  version: 1,
  created_at: "2026-07-22T20:00:00Z",
  updated_at: "2026-07-22T20:00:00Z"
};

const projectRecord = {
  id: 11,
  title: "Final report",
  stage: "sprint",
  status: "active",
  weekly_min_minutes: 120,
  weekly_target_minutes: 300
};

describe("activities api", () => {
  it("loads the durable Activity catalog with real Projects", async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(response(true, 200, [activityRecord]))
      .mockResolvedValueOnce(response(true, 200, [projectRecord]));

    const result = await loadActivityCatalog({
      apiBaseUrl: "http://127.0.0.1:8000",
      fetchImpl
    });

    expect(result.status).toBe("ok");
    expect(result.data?.activities[0]).toMatchObject({
      id: 7,
      projectId: 11,
      name: "Focused writing",
      activityType: "consuming",
      version: 1
    });
    expect(result.data?.projects[0]).toMatchObject({
      id: 11,
      title: "Final report"
    });
  });

  it("creates and corrects Activities using the public contract", async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(response(true, 201, activityRecord))
      .mockResolvedValueOnce(
        response(true, 200, {
          ...activityRecord,
          name: "Focused revision",
          activity_type: "restore",
          type_source: "user_corrected",
          version: 2
        })
      );

    const created = await createActivity({
      apiBaseUrl: "http://127.0.0.1:8000",
      fetchImpl,
      draft: {
        projectId: 11,
        name: "Focused writing",
        description: "Drafting",
        activityType: "consuming"
      }
    });
    const updated = await updateActivity({
      apiBaseUrl: "http://127.0.0.1:8000",
      fetchImpl,
      activityId: 7,
      draft: {
        expectedVersion: 1,
        name: "Focused revision",
        activityType: "restore"
      }
    });

    expect(JSON.parse(String(fetchImpl.mock.calls[0][1].body))).toEqual({
      project_id: 11,
      name: "Focused writing",
      description: "Drafting",
      activity_type: "consuming"
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[1][1].body))).toEqual({
      expected_version: 1,
      name: "Focused revision",
      activity_type: "restore"
    });
    expect(created.data?.version).toBe(1);
    expect(updated.data).toMatchObject({
      name: "Focused revision",
      activityType: "restore",
      typeSource: "user_corrected",
      version: 2
    });
  });

  it("returns the current safe representation after a version conflict", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(
      response(false, 409, {
        detail: {
          code: "version_conflict",
          message: "The activity changed after it was loaded",
          current: { ...activityRecord, name: "Current title", version: 2 }
        }
      })
    );

    const result = await updateActivity({
      apiBaseUrl: "http://127.0.0.1:8000",
      fetchImpl,
      activityId: 7,
      draft: { expectedVersion: 1, name: "Stale title" }
    });

    expect(result.status).toBe("conflict");
    expect(result.current).toMatchObject({ name: "Current title", version: 2 });
  });

  it("maps and merges persisted Activities without collapsing siblings in one Project", () => {
    const project = {
      id: 11,
      title: "Final report",
      stage: "sprint" as const,
      status: "active" as const,
      weeklyMinMinutes: 120,
      weeklyTargetMinutes: 300
    };
    const first = activityRecordToTimer(
      {
        id: 7,
        userId: 3,
        projectId: 11,
        name: "Writing",
        description: "",
        activityType: "consuming",
        typeSource: "user_selected",
        version: 1,
        createdAt: "2026-07-22T20:00:00Z",
        updatedAt: "2026-07-22T20:00:00Z"
      },
      [project]
    );
    const second = {
      ...first,
      id: "activity-8",
      activityId: 8,
      name: "Editing"
    };

    expect(mergeActivityCatalog([first, second], [])).toHaveLength(2);
    expect(first).toMatchObject({
      projectTitle: "Final report",
      energy: "consume",
      activityVersion: 1
    });
  });
});

function response(ok: boolean, status: number, payload: unknown) {
  return {
    ok,
    status,
    json: async () => payload
  };
}
