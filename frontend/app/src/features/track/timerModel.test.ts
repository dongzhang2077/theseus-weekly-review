import { describe, expect, it } from "vitest";
import {
  chooseFocusActivity,
  completeActivity,
  formatClock,
  formatCompactClock,
  nextFocusActivityId,
  pauseActivity,
  reconcileFocusActivities,
  startActivity,
  tickActivities,
  type ActivityTimer
} from "./timerModel";

const activities: ActivityTimer[] = [
  {
    id: "build",
    name: "Frontend build",
    category: "Project",
    energy: "consume",
    color: "#6f8f6b",
    todaySeconds: 1200,
    sessionSeconds: 0,
    running: false,
    recommended: true
  },
  {
    id: "walk",
    name: "Walk",
    category: "Health",
    energy: "restore",
    color: "#8aa9c0",
    todaySeconds: 900,
    sessionSeconds: 0,
    running: false
  }
];

describe("timerModel", () => {
  it("resolves a legacy multi-running state to the highest-energy activity", () => {
    const running = [
      { ...activities[0], running: true, sessionSeconds: 10 },
      { ...activities[1], running: true, sessionSeconds: 90 }
    ];

    expect(chooseFocusActivity(running)?.id).toBe("build");
  });

  it("supports pause and completion as separate session states", () => {
    const started = startActivity(activities, "build");
    const ticked = tickActivities(started, 75);
    const paused = pauseActivity(ticked, "build");
    expect(paused[0]).toMatchObject({ running: false, sessionSeconds: 75, todaySeconds: 1200 });

    const completed = completeActivity(paused, "build");
    expect(completed[0]).toMatchObject({ running: false, sessionSeconds: 0, todaySeconds: 1275 });
  });

  it("does not switch away from an in-progress session", () => {
    const current = [
      { ...activities[0], running: true, sessionSeconds: 15 },
      { ...activities[1], sessionSeconds: 20 }
    ];

    const started = startActivity(current, "walk");
    expect(started[0]).toMatchObject({ running: true, sessionSeconds: 15 });
    expect(started[1]).toMatchObject({ running: false, sessionSeconds: 20 });
  });

  it("can ignore a recommendation or honor a manual choice", () => {
    expect(chooseFocusActivity(activities, { ignoredIds: ["build"] })?.id).toBe("walk");
    expect(chooseFocusActivity(activities, { preferredId: "walk" })?.id).toBe("walk");
    expect(chooseFocusActivity(activities, { ignoredIds: ["build", "walk"] })).toBeNull();
    expect(chooseFocusActivity([])).toBeNull();
  });

  it("moves to the next visible activity without redefining recommendation rank", () => {
    expect(nextFocusActivityId(activities, "build")).toBe("walk");
    expect(nextFocusActivityId(activities, "walk")).toBe("build");
    expect(nextFocusActivityId(activities, "build", ["build"])).toBe("walk");
    expect(nextFocusActivityId(activities, "walk", ["build"])).toBeNull();
  });

  it("keeps an open session while accepting refreshed persisted Today totals", () => {
    const incoming = [{
      ...activities[0],
      id: "review-project-7",
      projectId: 7,
      todaySeconds: 0,
      focusContext: { source: "review_evidence" as const, actualMinutes: 45 }
    }];
    const current = [{
      ...activities[0],
      id: "plan-7",
      projectId: 7,
      todaySeconds: 180,
      sessionSeconds: 25,
      running: true,
      focusContext: { source: "persisted_plan" as const, planItemId: 12 }
    }];

    expect(reconcileFocusActivities(incoming, current)).toEqual([
      expect.objectContaining({
        id: "review-project-7",
        todaySeconds: 0,
        sessionSeconds: 25,
        running: true,
        focusContext: { source: "review_evidence", actualMinutes: 45 }
      })
    ]);
  });

  it("retains only explicit view-local and persisted-plan additions across a review refresh", () => {
    const manual = {
      ...activities[1],
      id: "manual",
      focusContext: { source: "manual" as const }
    };
    const staleSample = {
      ...activities[0],
      id: "sample",
      focusContext: { source: "sample" as const }
    };

    expect(reconcileFocusActivities([], [manual, staleSample])).toEqual([manual]);
  });

  it("formats a session clock from zero", () => {
    expect(formatClock(42)).toBe("00:00:42");
    expect(formatCompactClock(42)).toBe("00:42");
    expect(formatCompactClock(3661)).toBe("61:01");
  });
});
