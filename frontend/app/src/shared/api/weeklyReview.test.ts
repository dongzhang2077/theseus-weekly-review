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
      time_log_count: 5
    },
    plan: {
      planned_capacity_minutes: 1800,
      planned_total_minutes: 660,
      planned_slack_minutes: 1140,
      required_slack_minutes: 360,
      slack_status: "healthy",
      project_drift: [
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
      status: "Dormant"
    });
    expect(mapped.signals.summaries.find((signal) => signal.id === "plan")).toMatchObject({
      severity: "attention",
      status: "Drift"
    });
    expect(mapped.signals.evidence.find((row) => row.signalId === "stage")).toMatchObject({
      title: "Resume and applications dormant",
      action: "Plan"
    });
  });

  it("preserves tracker demo data and prepares plan state from next step evidence", () => {
    const mapped = mapWeeklyReviewToAppWeek(apiReview, demoWeek);

    expect(mapped.track.activities).toBe(demoWeek.track.activities);
    expect(mapped.plan.initialState).toMatchObject({
      suggestionStatus: "available",
      focusProject: "Protect one restart block",
      slackHours: 19,
      savedAt: null
    });
  });
});
