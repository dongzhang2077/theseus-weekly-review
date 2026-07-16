import type { AppReviewItem, AppSignalEvidence, AppSignalSummary, AppWeekViewModel } from "../api/weeklyReview";
import type { ActivityTimer } from "../domain/track";

export type DemoReviewItem = AppReviewItem;
export type DemoSignalSummary = AppSignalSummary;
export type DemoSignalEvidence = AppSignalEvidence;

export const demoWeek = {
  review: {
    weekLabel: "Jun 8 - Jun 14",
    status: "Needs attention",
    characterAlt: "Week needs attention",
    bubble: "You moved Theseus forward, but your resume work needs a restart.",
    rhythm: ["green", "green", "green", "amber", "green", "green", "green"] as const,
    narrative: [
      "Theseus backend moved forward with consistent deep-work blocks.",
      "Resume work needs a small restart before the week gets crowded."
    ],
    wins: [
      {
        id: "win-backend",
        title: "Backend progress on track",
        reason: "Consistent work kept the demo path healthy.",
        evidence: [
          { label: "Planned", value: "8h" },
          { label: "Logged", value: "9.5h" },
          { label: "Status", value: "On track" }
        ]
      },
      {
        id: "win-deep-work",
        title: "Deep-work blocks protected",
        reason: "Repeated focus blocks kept implementation moving without fragmenting the week.",
        evidence: [
          { label: "Blocks", value: "4" },
          { label: "Longest", value: "2h" },
          { label: "Status", value: "Consistent" }
        ]
      }
    ] satisfies DemoReviewItem[],
    risks: [
      {
        id: "risk-resume",
        title: "Resume dormant",
        severity: "severe",
        reason: "The project had no logged work this week.",
        evidence: [
          { label: "Logged", value: "0h" },
          { label: "Inactive", value: "5d" },
          { label: "Minimum", value: "3h" }
        ],
        action: "Plan"
      },
      {
        id: "risk-frontend",
        title: "Frontend drift",
        severity: "attention",
        reason: "Frontend work landed below the planned target while backend took priority.",
        evidence: [
          { label: "Planned", value: "8h" },
          { label: "Logged", value: "2h" },
          { label: "Delta", value: "-6h" }
        ],
        action: "Plan"
      }
    ] satisfies DemoReviewItem[]
  },
  signals: {
    summaries: [
      {
        id: "plan",
        label: "Plan",
        severity: "attention",
        status: "Drift",
        reason: "Planned work shifted away from resume restart."
      },
      {
        id: "stage",
        label: "Stage",
        severity: "severe",
        status: "Dormant",
        reason: "A restart project stayed inactive this week."
      },
      {
        id: "goal",
        label: "Goal",
        severity: "normal",
        status: "Aligned",
        reason: "Backend work still supports the MVP goal."
      },
      {
        id: "energy",
        label: "Energy",
        severity: "attention",
        status: "Thin",
        reason: "Recovery time is lower than planned focus time."
      }
    ] satisfies DemoSignalSummary[],
    evidence: [
      {
        id: "resume-dormant",
        signalId: "stage",
        title: "Resume dormant",
        severity: "severe",
        status: "Wake-up",
        value: "6d",
        reason: "The project was planned, then received no active block.",
        rows: [
          { label: "Planned", value: "2h" },
          { label: "Logged", value: "0m" },
          { label: "Inactive", value: "6d" }
        ],
        action: "Plan"
      },
      {
        id: "backend-healthy",
        signalId: "stage",
        title: "Backend healthy",
        severity: "normal",
        status: "Healthy",
        value: "7h",
        reason: "Core API work continued with usable evidence.",
        rows: [
          { label: "Logged", value: "7h" },
          { label: "Stage", value: "Build" },
          { label: "Evidence", value: "4" }
        ]
      },
      {
        id: "plan-drift",
        signalId: "plan",
        title: "Plan drift",
        severity: "attention",
        status: "Drift",
        value: "-2h",
        reason: "Backend moved forward, but restart work fell out of the week.",
        rows: [
          { label: "Backend", value: "+1h" },
          { label: "Resume", value: "-2h" },
          { label: "Review", value: "Done" }
        ],
        action: "Plan"
      },
      {
        id: "goal-aligned",
        signalId: "goal",
        title: "Goal aligned",
        severity: "normal",
        status: "Supported",
        reason: "The strongest work still supports the demo path.",
        rows: [
          { label: "MVP", value: "On" },
          { label: "Docs", value: "Light" },
          { label: "Scope", value: "Clear" }
        ]
      },
      {
        id: "energy-thin",
        signalId: "energy",
        title: "Energy thin",
        severity: "attention",
        status: "Thin",
        value: "9h",
        reason: "Recovery blocks are present, but not enough to offset build work.",
        rows: [
          { label: "Focus", value: "8h" },
          { label: "Restore", value: "1h" },
          { label: "Load", value: "High" }
        ]
      }
    ] satisfies DemoSignalEvidence[]
  },
  track: {
    activities: [
      {
        id: "frontend",
        name: "Frontend build block",
        category: "Project",
        energy: "consume",
        color: "#6f8f6b",
        todaySeconds: 42 * 60,
        sessionSeconds: 0,
        running: false,
        recommended: true
      },
      {
        id: "backend",
        name: "Backend polish",
        category: "Project",
        energy: "consume",
        color: "#8aa9c0",
        todaySeconds: 24 * 60,
        sessionSeconds: 0,
        running: false
      },
      {
        id: "research",
        name: "Research notes",
        category: "Study",
        energy: "neutral",
        color: "#c8a25f",
        todaySeconds: 55 * 60,
        sessionSeconds: 0,
        running: false
      },
      {
        id: "walk",
        name: "Health walk",
        category: "Health",
        energy: "restore",
        color: "#7f9f85",
        todaySeconds: 45 * 60,
        sessionSeconds: 0,
        running: false
      }
    ] satisfies ActivityTimer[]
  },
  plan: {
    reviewWeek: { start: "2026-06-08", end: "2026-06-14" },
    targetWeek: { start: "2026-06-15", end: "2026-06-21" },
    sourcePlan: {
      id: null,
      week: { start: "2026-06-08", end: "2026-06-14" },
      capacityMinutes: 1800,
      slackTargetPercent: 20,
      items: [
        {
          projectId: 1,
          title: "Design backend schema and API",
          plannedMinutes: 300,
          priority: 1,
          isCompleted: false
        },
        {
          projectId: 2,
          title: "Draft review page layout",
          plannedMinutes: 240,
          priority: 2,
          isCompleted: false
        },
        {
          projectId: 3,
          title: "Update resume and apply to two roles",
          plannedMinutes: 120,
          priority: 3,
          isCompleted: false
        }
      ],
      note: "Progress report preparation week."
    },
    projects: [
      {
        id: 1,
        title: "Theseus backend",
        stage: "startup",
        status: "active",
        weeklyMinMinutes: 180,
        weeklyTargetMinutes: 480
      },
      {
        id: 2,
        title: "Theseus frontend",
        stage: "startup",
        status: "active",
        weeklyMinMinutes: 120,
        weeklyTargetMinutes: 360
      },
      {
        id: 3,
        title: "Resume and applications",
        stage: "stable",
        status: "active",
        weeklyMinMinutes: 60,
        weeklyTargetMinutes: 180
      }
    ],
    suggestion: {
      title: "Protect one restart block",
      reason: "A small protected block gives the dormant project a realistic restart.",
      kind: "add",
      projectId: 3,
      projectTitle: "Resume and applications",
      deltaMinutes: 60
    }
  }
} satisfies AppWeekViewModel;
