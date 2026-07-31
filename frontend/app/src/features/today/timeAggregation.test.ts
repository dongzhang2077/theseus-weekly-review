import { describe, expect, it } from "vitest";
import type { ApiTimeLogRead } from "../../shared/api/timeLogs";
import type { PlanProject } from "../../shared/domain/plan";
import {
  aggregateProjectTime,
  aggregateTimeWeek,
  collapseProjectBuckets,
} from "./timeAggregation";

const projects: PlanProject[] = [
  project(1, "Theseus"),
  project(2, "Coursework"),
  project(3, "Recovery"),
  project(4, "Writing"),
  project(5, "Admin"),
];

describe("aggregateProjectTime", () => {
  it("counts each non-deleted in-range TimeLog once using exact seconds", () => {
    const logs = [
      timeLog({ id: 4, project_id: 1, date: "2026-07-30", duration_seconds: 7_801, duration_minutes: 999, start_time: "10:00:00" }),
      timeLog({ id: 2, project_id: 2, date: "2026-07-30", duration_seconds: 5_100, start_time: "08:00:00" }),
      timeLog({ id: 3, project_id: null, date: "2026-07-30", duration_seconds: 3_600, start_time: "09:00:00" }),
      timeLog({ id: 5, project_id: 1, date: "2026-07-31", duration_seconds: 8_000 }),
      timeLog({ id: 6, project_id: 1, date: "2026-07-30", duration_seconds: 900, deleted_at: "2026-07-30T12:00:00Z" }),
      timeLog({ id: 7, project_id: 1, date: "2026-07-30", duration_seconds: 0 }),
    ];

    const summary = aggregateProjectTime(logs, projects, {
      start: "2026-07-30",
      end: "2026-07-30",
    });

    expect(summary.totalSeconds).toBe(16_501);
    expect(summary.recordIds).toEqual([2, 3, 4]);
    expect(summary.buckets).toEqual([
      expect.objectContaining({ key: "project:1", title: "Theseus", seconds: 7_801, recordIds: [4] }),
      expect.objectContaining({ key: "project:2", title: "Coursework", seconds: 5_100, recordIds: [2] }),
      expect.objectContaining({ key: "unassigned", title: "Unassigned", seconds: 3_600, recordIds: [3] }),
    ]);
    expect(summary.buckets.map((bucket) => bucket.percentage)).toEqual([47.3, 30.9, 21.8]);
  });

  it("keeps unknown Project IDs distinct without inventing titles", () => {
    const summary = aggregateProjectTime([
      timeLog({ id: 1, project_id: 90, duration_seconds: 600 }),
      timeLog({ id: 2, project_id: 91, duration_seconds: 600 }),
    ], projects, { start: "2026-07-30", end: "2026-07-30" });

    expect(summary.buckets).toEqual([
      expect.objectContaining({ key: "project:90", projectId: 90, title: "Unknown project", recordIds: [1] }),
      expect.objectContaining({ key: "project:91", projectId: 91, title: "Unknown project", recordIds: [2] }),
    ]);
  });

  it("is deterministic when API record order changes", () => {
    const logs = [
      timeLog({ id: 3, project_id: 1, start_time: "11:00:00", duration_seconds: 900 }),
      timeLog({ id: 1, project_id: 2, start_time: "09:00:00", duration_seconds: 900 }),
      timeLog({ id: 2, project_id: 1, start_time: "10:00:00", duration_seconds: 900 }),
    ];

    expect(aggregateProjectTime(logs, projects, dayRange()))
      .toEqual(aggregateProjectTime([...logs].reverse(), projects, dayRange()));
  });

  it("rejects invalid or reversed calendar ranges", () => {
    expect(() => aggregateProjectTime([], projects, { start: "2026-07-31", end: "2026-07-30" }))
      .toThrow("range.end must not precede range.start");
    expect(() => aggregateProjectTime([], projects, { start: "2026-02-30", end: "2026-03-01" }))
      .toThrow("range.start must be a real calendar date");
  });
});

describe("aggregateTimeWeek", () => {
  it("returns Monday through Sunday and excludes future records from the current total", () => {
    const summary = aggregateTimeWeek([
      timeLog({ id: 1, date: "2026-07-27", project_id: 1, duration_seconds: 3_600 }),
      timeLog({ id: 2, date: "2026-07-30", project_id: 2, duration_seconds: 1_800 }),
      timeLog({ id: 3, date: "2026-07-31", project_id: 1, duration_seconds: 7_200 }),
      timeLog({ id: 4, date: "2026-08-02", project_id: 3, duration_seconds: 7_200 }),
    ], projects, "2026-07-27", "2026-07-30");

    expect(summary.range).toEqual({ start: "2026-07-27", end: "2026-08-02" });
    expect(summary.days.map((day) => day.date)).toEqual([
      "2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30",
      "2026-07-31", "2026-08-01", "2026-08-02",
    ]);
    expect(summary.days.map((day) => day.status)).toEqual([
      "recorded", "empty", "empty", "recorded", "unavailable", "unavailable", "unavailable",
    ]);
    expect(summary.totalSeconds).toBe(5_400);
    expect(summary.recordIds).toEqual([1, 2]);
    expect(summary.buckets).toEqual([
      expect.objectContaining({ key: "project:1", seconds: 3_600, recordIds: [1] }),
      expect.objectContaining({ key: "project:2", seconds: 1_800, recordIds: [2] }),
    ]);
    expect(summary.days.slice(4).every((day) => day.recordIds.length === 0)).toBe(true);
  });

  it("keeps historical Sundays available", () => {
    const summary = aggregateTimeWeek([
      timeLog({ id: 7, date: "2026-06-14", project_id: 3, duration_seconds: 2_400 }),
    ], projects, "2026-06-08", "2026-07-30");

    expect(summary.days[summary.days.length - 1]).toEqual(expect.objectContaining({
      date: "2026-06-14",
      status: "recorded",
      totalSeconds: 2_400,
      recordIds: [7],
    }));
  });
});

describe("collapseProjectBuckets", () => {
  it("groups only display overflow and retains every member and source ID", () => {
    const summary = aggregateProjectTime([
      timeLog({ id: 1, project_id: 1, duration_seconds: 5_000 }),
      timeLog({ id: 2, project_id: 2, duration_seconds: 4_000 }),
      timeLog({ id: 3, project_id: 3, duration_seconds: 3_000 }),
      timeLog({ id: 4, project_id: 4, duration_seconds: 2_000 }),
      timeLog({ id: 5, project_id: 5, duration_seconds: 1_000 }),
    ], projects, dayRange());

    const collapsed = collapseProjectBuckets(summary.buckets, 4);

    expect(collapsed.map((bucket) => bucket.title)).toEqual([
      "Theseus", "Coursework", "Recovery", "Other",
    ]);
    expect(collapsed[collapsed.length - 1]).toEqual(expect.objectContaining({
      seconds: 3_000,
      percentage: 20,
      recordIds: [4, 5],
      members: [
        expect.objectContaining({ key: "project:4", recordIds: [4] }),
        expect.objectContaining({ key: "project:5", recordIds: [5] }),
      ],
    }));
  });

  it("rejects a display limit that cannot preserve a visible source bucket", () => {
    expect(() => collapseProjectBuckets([], 1)).toThrow(
      "maximumVisible must be an integer of at least 2"
    );
  });
});

function dayRange() {
  return { start: "2026-07-30", end: "2026-07-30" };
}

function project(id: number, title: string): PlanProject {
  return {
    id,
    title,
    stage: "stable",
    status: "active",
    weeklyMinMinutes: 0,
    weeklyTargetMinutes: 0,
  };
}

function timeLog(overrides: Partial<ApiTimeLogRead>): ApiTimeLogRead {
  return {
    id: 1,
    user_id: 1,
    activity_id: 1,
    project_id: 1,
    task_id: null,
    focus_session_id: null,
    task_title: null,
    date: "2026-07-30",
    duration_minutes: 10,
    duration_seconds: 600,
    activity_name: "Focused work",
    activity_type: "neutral",
    type_source: "user_selected",
    note: "",
    start_time: null,
    end_time: null,
    version: 1,
    deleted_at: null,
    created_at: "2026-07-30T10:00:00Z",
    updated_at: "2026-07-30T10:00:00Z",
    ...overrides,
  };
}
