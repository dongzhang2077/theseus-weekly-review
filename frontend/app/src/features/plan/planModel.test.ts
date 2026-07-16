import { describe, expect, it } from "vitest";
import { demoWeek } from "../../shared/demo/demoWeek";
import {
  applyPlanSuggestion,
  buildPlanProposal,
  calculatePlanMetrics,
  createPlanWorkspace,
  createUpcomingPlanSeed
} from "./planModel";

describe("planModel", () => {
  it("clones the reviewed plan into the target week without persisted identity", () => {
    const workspace = createPlanWorkspace(demoWeek.plan);

    expect(workspace.draft.id).toBeNull();
    expect(workspace.draft.week).toEqual({ start: "2026-06-15", end: "2026-06-21" });
    expect(workspace.draft.items).toHaveLength(3);
    expect(workspace.persistedPlan).toBeNull();
  });

  it("prefers an already persisted target-week plan over the reviewed plan", () => {
    const target = {
      ...demoWeek.plan.sourcePlan,
      id: 9,
      week: demoWeek.plan.targetWeek,
      items: [{
        projectId: 2,
        title: "Existing target block",
        plannedMinutes: 90,
        priority: 1,
        isCompleted: false
      }]
    };
    const workspace = createPlanWorkspace(demoWeek.plan, {
      plans: [target],
      projects: demoWeek.plan.projects
    });

    expect(workspace.draft.id).toBe(9);
    expect(workspace.draft.items[0].title).toBe("Existing target block");
    expect(workspace.persistedPlan?.id).toBe(9);
  });

  it("builds a concrete before-and-after proposal from review evidence", () => {
    const workspace = createPlanWorkspace(demoWeek.plan);
    const proposal = buildPlanProposal(workspace);

    expect(proposal?.suggestion.projectTitle).toBe("Resume and applications");
    expect(proposal?.beforeProjectMinutes).toBe(120);
    expect(proposal?.afterProjectMinutes).toBe(180);
    expect(proposal?.beforeMetrics.plannedMinutes).toBe(660);
    expect(proposal?.afterMetrics.plannedMinutes).toBe(720);
  });

  it("can reduce a lower-priority plan block without leaving zero-minute items", () => {
    const reduced = applyPlanSuggestion(demoWeek.plan.sourcePlan, {
      title: "Protect slack",
      reason: "The current plan is tight.",
      kind: "reduce",
      projectId: 3,
      projectTitle: "Resume and applications",
      deltaMinutes: -120
    });

    expect(reduced.items.find((item) => item.projectId === 3)).toBeUndefined();
    expect(calculatePlanMetrics(reduced).plannedMinutes).toBe(540);
  });

  it("uses an explicit unknown balance when capacity is absent", () => {
    expect(calculatePlanMetrics({ ...demoWeek.plan.sourcePlan, capacityMinutes: 0 })).toMatchObject({
      slackMinutes: null,
      status: "unknown"
    });
  });

  it("derives the next Monday week without fixture dates", () => {
    const seed = createUpcomingPlanSeed(new Date("2026-07-15T12:00:00Z"));
    expect(seed.targetWeek).toEqual({ start: "2026-07-20", end: "2026-07-26" });
  });
});
