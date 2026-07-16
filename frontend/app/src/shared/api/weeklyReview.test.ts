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
    expect(mapped.review.risks[0]).toMatchObject({
      title: "Dormancy risk",
      severity: "severe",
      action: "Plan"
    });
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
      action: "Plan"
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
      action: "Plan"
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

  it("preserves tracker demo data and prepares plan state from next step evidence", () => {
    const mapped = mapWeeklyReviewToAppWeek(apiReview, demoWeek);

    expect(mapped.track.activities).toBe(demoWeek.track.activities);
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
