import { describe, expect, it } from "vitest";
import {
  chooseFocusActivity,
  completeActivity,
  formatClock,
  formatCompactClock,
  pauseActivity,
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

    expect(chooseFocusActivity(running).id).toBe("build");
  });

  it("supports pause and completion as separate session states", () => {
    const started = startActivity(activities, "build");
    const ticked = tickActivities(started, 75);
    const paused = pauseActivity(ticked, "build");
    expect(paused[0]).toMatchObject({ running: false, sessionSeconds: 75, todaySeconds: 1200 });

    const completed = completeActivity(paused, "build");
    expect(completed[0]).toMatchObject({ running: false, sessionSeconds: 0, todaySeconds: 1275 });
  });

  it("starts only one activity and preserves an interrupted session", () => {
    const current = [
      { ...activities[0], running: true, sessionSeconds: 15 },
      { ...activities[1], sessionSeconds: 20 }
    ];

    const started = startActivity(current, "walk");
    expect(started[0]).toMatchObject({ running: false, sessionSeconds: 15 });
    expect(started[1]).toMatchObject({ running: true, sessionSeconds: 20 });
  });

  it("can ignore a recommendation or honor a manual choice", () => {
    expect(chooseFocusActivity(activities, { ignoredIds: ["build"] }).id).toBe("walk");
    expect(chooseFocusActivity(activities, { preferredId: "walk" }).id).toBe("walk");
  });

  it("formats a session clock from zero", () => {
    expect(formatClock(42)).toBe("00:00:42");
    expect(formatCompactClock(42)).toBe("00:42");
    expect(formatCompactClock(3661)).toBe("61:01");
  });
});
