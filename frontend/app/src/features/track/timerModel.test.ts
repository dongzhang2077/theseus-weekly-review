import { describe, expect, it } from "vitest";
import {
  chooseFocusActivity,
  completeActivity,
  currentRunSeconds,
  formatClock,
  formatCompactClock,
  formatLiveClock,
  nextFocusActivityId,
  stopActivity,
  reconcileFocusActivities,
  startActivity,
  tickActivities,
  tickActivitiesByDate,
  todayActivitySeconds,
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
  it("selects one visible focus while preserving multiple running activities", () => {
    const running = [
      { ...activities[0], running: true, sessionSeconds: 10 },
      { ...activities[1], running: true, sessionSeconds: 90 }
    ];

    expect(chooseFocusActivity(running)?.id).toBe("build");
  });

  it("starts and accumulates multiple activities independently", () => {
    const bothRunning = startActivity(startActivity(activities, "build"), "walk");
    const ticked = tickActivitiesByDate(bothRunning, { "2026-07-18": 75 });
    const stoppedWalk = stopActivity(ticked, "walk");
    const tickedAgain = tickActivitiesByDate(stoppedWalk, { "2026-07-18": 15 });

    expect(tickedAgain[0]).toMatchObject({ running: true, sessionSeconds: 90, runSeconds: 90 });
    expect(tickedAgain[1]).toMatchObject({ running: false, sessionSeconds: 75, runSeconds: 0 });
    expect(tickedAgain[0].sessionSecondsByDate).toEqual({ "2026-07-18": 90 });
    expect(tickedAgain[1].sessionSecondsByDate).toEqual({ "2026-07-18": 75 });
  });

  it("stops display ticks before committing a completed session", () => {
    const started = startActivity(activities, "build");
    const ticked = tickActivities(started, 75);
    const stopped = stopActivity(ticked, "build");
    expect(stopped[0]).toMatchObject({
      running: false,
      sessionSeconds: 75,
      runSeconds: 0,
      todaySeconds: 1200
    });

    const completed = completeActivity(stopped, "build");
    expect(completed[0]).toMatchObject({
      running: false,
      sessionSeconds: 0,
      runSeconds: 0,
      todaySeconds: 1275
    });
  });

  it("starts a second activity without changing another open session", () => {
    const current = [
      { ...activities[0], running: true, sessionSeconds: 15 },
      { ...activities[1], sessionSeconds: 20 }
    ];

    const started = startActivity(current, "walk");
    expect(started[0]).toMatchObject({ running: true, sessionSeconds: 15 });
    expect(currentRunSeconds(started[0])).toBe(15);
    expect(started[1]).toMatchObject({ running: true, sessionSeconds: 20, runSeconds: 0 });
  });

  it("keeps cross-day session buckets separate from the current Today total", () => {
    const running = startActivity([
      { ...activities[0], todayDate: "2026-07-18", todaySeconds: 1200 }
    ], "build");
    const ticked = tickActivitiesByDate(running, {
      "2026-07-18": 30,
      "2026-07-19": 45
    });

    expect(todayActivitySeconds(ticked[0], "2026-07-18")).toBe(1230);
    expect(todayActivitySeconds(ticked[0], "2026-07-19")).toBe(45);

    const completed = completeActivity(ticked, "build", "2026-07-19");
    expect(completed[0]).toMatchObject({
      todayDate: "2026-07-19",
      todaySeconds: 45,
      sessionSeconds: 0,
      runSeconds: 0,
      running: false
    });
    expect(completed[0].sessionSecondsByDate).toBeUndefined();
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
      runSeconds: 7,
      running: true,
      focusContext: { source: "persisted_plan" as const, planItemId: 12 }
    }];

    expect(reconcileFocusActivities(incoming, current)).toEqual([
      expect.objectContaining({
        id: "review-project-7",
        todaySeconds: 0,
        sessionSeconds: 25,
        runSeconds: 7,
        running: true,
        focusContext: { source: "review_evidence", actualMinutes: 45 }
      })
    ]);
  });

  it("does not collapse two persisted Activities that share one Project", () => {
    const incoming = [
      {
        ...activities[0],
        id: "activity-7",
        activityId: 7,
        projectId: 4,
        name: "Writing"
      },
      {
        ...activities[1],
        id: "activity-8",
        activityId: 8,
        projectId: 4,
        name: "Editing"
      }
    ];
    const current = incoming.map((activity, index) => ({
      ...activity,
      sessionSeconds: index + 10,
      running: index === 0
    }));

    expect(reconcileFocusActivities(incoming, current)).toEqual([
      expect.objectContaining({ activityId: 7, sessionSeconds: 10, running: true }),
      expect.objectContaining({ activityId: 8, sessionSeconds: 11, running: false })
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
    expect(formatLiveClock(42)).toBe("00:42");
    expect(formatLiveClock(3661)).toBe("1:01:01");
  });
});
