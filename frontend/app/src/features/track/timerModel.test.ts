import { describe, expect, it } from "vitest";
import { chooseFocusActivity, formatClock, tickActivities, toggleActivity, type ActivityTimer } from "./timerModel";

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
  it("starts and stops an activity without a save confirmation step", () => {
    const started = toggleActivity(activities, "build");
    expect(started[0].running).toBe(true);
    expect(started[0].sessionSeconds).toBe(0);

    const ticked = tickActivities(started, 15);
    const stopped = toggleActivity(ticked, "build");
    expect(stopped[0].running).toBe(false);
    expect(stopped[0].todaySeconds).toBe(1215);
    expect(stopped[0].sessionSeconds).toBe(0);
  });

  it("keeps multi-running support and focuses the highest energy active activity", () => {
    const running = [
      { ...activities[0], running: true, sessionSeconds: 10 },
      { ...activities[1], running: true, sessionSeconds: 90 }
    ];

    expect(chooseFocusActivity(running).id).toBe("build");
  });

  it("can ignore a recommendation or honor a manual choice", () => {
    expect(chooseFocusActivity(activities, { ignoredIds: ["build"] }).id).toBe("walk");
    expect(chooseFocusActivity(activities, { preferredId: "walk" }).id).toBe("walk");
  });

  it("formats a session clock from zero", () => {
    expect(formatClock(42)).toBe("00:00:42");
  });
});
