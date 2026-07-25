import { describe, expect, it } from "vitest";
import { demoWeek } from "../demo/demoWeek";
import { mapWeeklyReviewToAppWeek, type WeeklyReviewApiResponse } from "./weeklyReview";

const apiReview: WeeklyReviewApiResponse = {
  week_start: "2026-06-08",
  week_end: "2026-06-14",
  wins: [
    {
      title: "Prototype work started",
      evidence: "Theseus MVP received 6.0 hours."
    }
  ],
  insights: [
    {
      title: "Goal-time alignment is improving",
      evidence: "The highest priority goal received the most project time."
    }
  ],
  risk_flags: [
    {
      type: "dormancy_risk",
      severity: "high",
      evidence: "Resume and applications received no time."
    }
  ],
  next_steps: [
    {
      title: "Protect one restart block",
      reason: "Keeps progress realistic without overfilling the week."
    }
  ],
  evidence: {
    summary: {
      planned_total_minutes: 660,
      actual_total_minutes: 450,
      goal_count: 2,
      project_count: 3,
      time_log_count: 5
    },
    goals: [
      {
        id: 1,
        title: "Ship the Theseus MVP",
        priority: 1,
        active_status: true,
        actual_minutes: 420,
        active_project_count: 1
      },
      {
        id: 2,
        title: "Prepare for internship search",
        priority: 2,
        active_status: true,
        actual_minutes: 0,
        active_project_count: 1
      }
    ],
    projects: [
      {
        id: 1,
        title: "Theseus backend",
        stage: "startup",
        status: "active",
        weekly_min_minutes: 180,
        weekly_target_minutes: 480,
        planned_minutes: 420,
        actual_minutes: 430,
        plan_status: "on_track"
      },
      {
        id: 2,
        title: "Theseus frontend",
        stage: "startup",
        status: "active",
        weekly_min_minutes: 120,
        weekly_target_minutes: 360,
        planned_minutes: 240,
        actual_minutes: 60,
        plan_status: "under_plan"
      },
      {
        id: 3,
        title: "Resume and applications",
        stage: "stable",
        status: "active",
        weekly_min_minutes: 60,
        weekly_target_minutes: 180,
        planned_minutes: 0,
        actual_minutes: 0,
        plan_status: "not_planned"
      }
    ],
    plan: {
      planned_capacity_minutes: 1800,
      planned_total_minutes: 660,
      planned_slack_minutes: 1140,
      required_slack_minutes: 360,
      slack_status: "healthy",
      project_drift: [
        {
          project_id: 1,
          project_title: "Theseus backend",
          planned_minutes: 420,
          actual_minutes: 430,
          difference_minutes: 10,
          status: "on_track"
        },
        {
          project_id: 2,
          project_title: "Theseus frontend",
          planned_minutes: 240,
          actual_minutes: 60,
          difference_minutes: -180,
          status: "under_plan"
        }
      ]
    },
    activity: {
      mix: {
        consuming: 300,
        restore: 60,
        destroy: 90
      },
      total_minutes: 450
    },
    stage_health: {
      projects: [
        {
          project_id: 1,
          project_title: "Theseus backend",
          status: "healthy",
          actual_minutes: 430,
          target_minutes: 420,
          inactive_days: 1,
          reason: "Backend stayed inside its build-stage range."
        },
        {
          project_id: 3,
          project_title: "Resume and applications",
          status: "wake_up_risk",
          actual_minutes: 0,
          target_minutes: 60,
          inactive_days: 30,
          reason: "Resume work needs a small restart block."
        }
      ]
    },
    dormancy: {
      projects: [
        {
          project_id: 3,
          project_title: "Resume and applications",
          weekly_min_minutes: 60,
          actual_minutes: 0,
          inactive_days: 30,
          risk_level: "high",
          missed_weekly_minimum: true
        }
      ]
    }
  },
  generated_text: "Win: prototype work started. Risk: resume restart needed."
};

describe("weeklyReview mapper", () => {
  it("maps backend review output into the app review model", () => {
    const mapped = mapWeeklyReviewToAppWeek(apiReview, demoWeek);

    expect(mapped.review.weekLabel).toBe("Jun 8 - Jun 14");
    expect(mapped.review.status).toBe("Needs attention");
    expect(mapped.review.rhythm).toHaveLength(7);
    expect(mapped.review.wins[0].title).toBe("Prototype work started");
    expect(mapped.review.wins[0].evidence).toEqual([
      { label: "Finding", value: "Theseus MVP received 6.0 hours." },
      { label: "Week logged", value: "7h 30m" },
      { label: "Sources", value: "5 time logs" }
    ]);
    expect(mapped.review.risks[0]).toMatchObject({
      title: "Dormancy risk",
      severity: "severe",
      action: {
        label: "Schedule restart",
        detail: "suggestion",
        suggestion: {
          projectId: 3,
          projectTitle: "Resume and applications",
          deltaMinutes: 60
        }
      }
    });
    expect(mapped.review.risks[0].evidence).toEqual([
      { label: "Finding", value: "Resume and applications received no time." },
      { label: "Project", value: "Resume and applications" },
      { label: "Inactive", value: "30d" },
      { label: "Logged", value: "0m" },
      { label: "Sources", value: "5 time logs" }
    ]);
  });

  it("maps evidence into signal summaries and compact details", () => {
    const mapped = mapWeeklyReviewToAppWeek(apiReview, demoWeek);

    expect(mapped.signals.summaries.find((signal) => signal.id === "stage")).toMatchObject({
      severity: "severe",
      status: "Wake-up"
    });
    expect(mapped.signals.summaries.find((signal) => signal.id === "plan")).toMatchObject({
      severity: "attention",
      status: "Drift"
    });
    expect(mapped.signals.evidence.find((row) => row.title === "Resume and applications")).toMatchObject({
      severity: "severe",
      status: "Wake-up",
      action: {
        label: "Schedule restart",
        detail: "suggestion",
        suggestion: {
          projectId: 3,
          projectTitle: "Resume and applications",
          deltaMinutes: 30
        }
      }
    });
    expect(mapped.signals.evidence.find((row) => row.title === "Theseus backend" && row.signalId === "stage")).toMatchObject({
      severity: "normal",
      status: "Healthy"
    });
    expect(mapped.signals.evidence.find((row) => row.title === "Theseus backend" && row.signalId === "plan")).toMatchObject({
      severity: "normal",
      status: "On track"
    });
    expect(mapped.signals.evidence.find((row) => row.title === "Prepare for internship search")).toMatchObject({
      signalId: "goal",
      severity: "attention",
      status: "No time",
      action: { label: "Choose project", detail: "edit" }
    });
    expect(mapped.signals.evidence.filter((row) => row.signalId === "goal")).toHaveLength(2);
  });

  it("returns explicit no-data summaries when the review contains no signal evidence", () => {
    const mapped = mapWeeklyReviewToAppWeek(
      {
        ...apiReview,
        wins: [],
        insights: [],
        risk_flags: [],
        next_steps: [],
        evidence: {},
        generated_text: "No evidence yet."
      },
      demoWeek
    );

    expect(mapped.signals.summaries).toHaveLength(4);
    expect(mapped.signals.summaries.every((signal) => signal.severity === "nodata")).toBe(true);
    expect(mapped.signals.evidence).toEqual([]);
    expect(mapped.track.activities).toEqual([]);
  });

  it("keeps recovery gaps in Energy instead of also lighting up a healthy Plan", () => {
    const mapped = mapWeeklyReviewToAppWeek(
      {
        ...apiReview,
        risk_flags: [
          {
            type: "slack_risk",
            severity: "medium",
            evidence: "Recovery time was below 20% of consuming time."
          }
        ],
        evidence: {
          ...apiReview.evidence,
          plan: {
            ...apiReview.evidence.plan,
            slack_status: "healthy",
            project_drift: apiReview.evidence.plan?.project_drift?.map((row) => ({
              ...row,
              difference_minutes: 0,
              status: "on_track"
            }))
          },
          activity: {
            mix: { consuming: 100, restore: 19, destroy: 0 },
            total_minutes: 119
          }
        }
      },
      demoWeek
    );

    expect(mapped.signals.summaries.find((signal) => signal.id === "plan")?.severity).toBe("normal");
    expect(mapped.signals.summaries.find((signal) => signal.id === "energy")).toMatchObject({
      severity: "attention",
      reason: "Restore was 19% of focus time; the steady threshold is 20%."
    });
  });

  it("does not call a small amount of drain a destroy pattern", () => {
    const mapped = mapWeeklyReviewToAppWeek(
      {
        ...apiReview,
        risk_flags: [],
        evidence: {
          ...apiReview.evidence,
          activity: {
            mix: { consuming: 100, restore: 20, destroy: 1 },
            total_minutes: 121
          }
        }
      },
      demoWeek
    );

    expect(mapped.signals.summaries.find((signal) => signal.id === "energy")).toMatchObject({
      severity: "normal",
      status: "Balanced",
      reason: "Restore was 20% of focus time and drain stayed below the 2h / 25% risk threshold."
    });
  });

  it("reduces an under-plan block when drift is the only review risk", () => {
    const mapped = mapWeeklyReviewToAppWeek(
      {
        ...apiReview,
        risk_flags: [
          {
            type: "plan_drift",
            severity: "medium",
            evidence: "Theseus frontend stayed under plan."
          }
        ],
        next_steps: [
          {
            title: "Reduce one lower-priority block",
            reason: "A smaller plan is more realistic."
          }
        ],
        evidence: {
          ...apiReview.evidence,
          dormancy: { projects: [] },
          stage_health: {
            projects: apiReview.evidence.stage_health?.projects?.map((project) => ({
              ...project,
              status: "healthy"
            }))
          }
        }
      },
      demoWeek
    );

    expect(mapped.plan.suggestion).toMatchObject({
      kind: "reduce",
      projectId: 2,
      projectTitle: "Theseus frontend",
      deltaMinutes: -60
    });
  });

  it("repeats the strongest supported project when the week has no risk", () => {
    const mapped = mapWeeklyReviewToAppWeek(
      {
        ...apiReview,
        risk_flags: [],
        next_steps: [
          {
            title: "Repeat the strongest pattern",
            reason: "The week does not need a major change."
          }
        ],
        evidence: {
          ...apiReview.evidence,
          dormancy: { projects: [] },
          stage_health: {
            projects: apiReview.evidence.stage_health?.projects?.map((project) => ({
              ...project,
              status: "healthy"
            }))
          }
        }
      },
      demoWeek
    );

    expect(mapped.plan.suggestion).toMatchObject({
      kind: "add",
      projectId: 1,
      projectTitle: "Theseus backend"
    });
  });

  it("maps authenticated review evidence into truthful focus activities", () => {
    const mapped = mapWeeklyReviewToAppWeek(apiReview, demoWeek);

    expect(mapped.track.activities.map((activity) => activity.name)).toEqual([
      "Theseus frontend",
      "Theseus backend"
    ]);
    expect(mapped.track.activities[0]).toMatchObject({
      id: "review-project-2",
      projectId: 2,
      projectTitle: "Theseus frontend",
      category: "Project",
      energy: "neutral",
      todaySeconds: 0,
      sessionSeconds: 0,
      running: false,
      recommended: true,
      focusContext: {
        source: "review_evidence",
        plannedMinutes: 240,
        actualMinutes: 60,
        reason: "240 min were planned in the reviewed week; 60 min were logged, leaving 180 min."
      }
    });
    expect(mapped.track.activities[1]).toMatchObject({
      id: "review-project-1",
      recommended: false,
      todaySeconds: 0,
      focusContext: {
        source: "review_evidence",
        plannedMinutes: 420,
        actualMinutes: 430,
        reason: "420 min were planned in the reviewed week and 430 min were logged."
      }
    });
    expect(mapped.track.activities.some((activity) => activity.id === "walk")).toBe(false);
  });

  it("uses real project evidence when a review omits the drift projection", () => {
    const mapped = mapWeeklyReviewToAppWeek(
      {
        ...apiReview,
        evidence: {
          projects: [
            {
              id: 7,
              title: "Portfolio refresh",
              status: "active",
              planned_minutes: 90,
              actual_minutes: 30,
              plan_status: "under_plan"
            },
            {
              id: 8,
              title: "Paused project",
              status: "paused",
              planned_minutes: 60,
              actual_minutes: 0,
              plan_status: "under_plan"
            }
          ],
          plan: { project_drift: [] }
        }
      },
      demoWeek
    );

    expect(mapped.track.activities).toHaveLength(1);
    expect(mapped.track.activities[0]).toMatchObject({
      id: "review-project-7",
      name: "Portfolio refresh",
      todaySeconds: 0,
      recommended: true,
      focusContext: {
        source: "review_evidence",
        plannedMinutes: 90,
        actualMinutes: 30
      }
    });
  });

  it("does not surface fallback demo activities when review evidence has no real project rows", () => {
    const mapped = mapWeeklyReviewToAppWeek(
      {
        ...apiReview,
        evidence: {
          projects: [{ title: "Missing persisted ID", planned_minutes: 60 }],
          plan: {
            project_drift: [{ project_title: "Missing persisted ID", planned_minutes: 60 }]
          }
        }
      },
      demoWeek
    );

    expect(mapped.track.activities).toEqual([]);
  });

  it("prepares plan state from next step evidence", () => {
    const mapped = mapWeeklyReviewToAppWeek(apiReview, demoWeek);

    expect(mapped.plan).toMatchObject({
      reviewWeek: { start: "2026-06-08", end: "2026-06-14" },
      targetWeek: { start: "2026-06-15", end: "2026-06-21" },
      sourcePlan: {
        capacityMinutes: 1800,
        slackTargetPercent: 20
      },
      suggestion: {
        title: "Protect one restart block",
        projectId: 3,
        projectTitle: "Resume and applications",
        kind: "add",
        deltaMinutes: 60
      }
    });
  });
});
