import type { PlanState } from "../domain/plan";
import type { SignalId, SignalSeverity } from "../domain/signals";
import type { ActivityTimer } from "../domain/track";

type RiskSeverity = "low" | "medium" | "high";
type RiskType = "alignment_gap" | "plan_drift" | "dormancy_risk" | "overload_risk" | "slack_risk" | "destroy_pattern";

export interface WeeklyReviewApiFinding {
  title: string;
  evidence: string;
}

export interface WeeklyReviewApiRisk {
  type: RiskType;
  severity: RiskSeverity;
  evidence: string;
}

export interface WeeklyReviewApiRecommendation {
  title: string;
  reason: string;
}

export interface WeeklyReviewApiResponse {
  week_start: string;
  week_end: string;
  wins: WeeklyReviewApiFinding[];
  insights: WeeklyReviewApiFinding[];
  risk_flags: WeeklyReviewApiRisk[];
  next_steps: WeeklyReviewApiRecommendation[];
  evidence: WeeklyReviewEvidence;
  generated_text: string;
}

export interface WeeklyReviewEvidence {
  summary?: {
    planned_total_minutes?: number;
    actual_total_minutes?: number;
    time_log_count?: number;
  };
  plan?: {
    planned_capacity_minutes?: number;
    planned_total_minutes?: number;
    planned_slack_minutes?: number;
    required_slack_minutes?: number;
    slack_status?: string;
    project_drift?: Array<{
      project_id?: number;
      project_title?: string;
      planned_minutes?: number;
      actual_minutes?: number;
      difference_minutes?: number;
      status?: string;
    }>;
  };
  activity?: {
    mix?: Partial<Record<"consuming" | "neutral" | "restore" | "destroy", number>>;
    total_minutes?: number;
    unlinked_minutes?: number;
  };
  dormancy?: {
    projects?: Array<{
      project_id?: number;
      project_title?: string;
      weekly_min_minutes?: number;
      actual_minutes?: number;
      inactive_days?: number;
      risk_level?: string;
      missed_weekly_minimum?: boolean;
    }>;
  };
  stage_health?: {
    projects?: Array<{
      project_id?: number;
      project_title?: string;
      status?: string;
      actual_minutes?: number;
      target_minutes?: number;
      stage?: string;
    }>;
  };
}

export interface AppReviewItem {
  id: string;
  title: string;
  severity?: SignalSeverity;
  reason: string;
  evidence: Array<{
    label: string;
    value: string;
  }>;
  action?: "Plan";
}

export interface AppSignalSummary {
  id: SignalId;
  label: string;
  severity: SignalSeverity;
  status: string;
  reason: string;
}

export interface AppSignalEvidence {
  id: string;
  signalId: SignalId;
  title: string;
  severity: SignalSeverity;
  reason: string;
  rows: Array<{
    label: string;
    value: string;
  }>;
  action?: string;
}

export interface AppWeekViewModel {
  review: {
    weekLabel: string;
    status: string;
    characterAlt: string;
    bubble: string;
    rhythm: readonly ("green" | "amber")[];
    narrative: string[];
    wins: AppReviewItem[];
    risks: AppReviewItem[];
  };
  signals: {
    summaries: AppSignalSummary[];
    evidence: AppSignalEvidence[];
  };
  track: {
    activities: ActivityTimer[];
  };
  plan: {
    initialState: PlanState;
  };
}

export function mapWeeklyReviewToAppWeek(response: WeeklyReviewApiResponse, fallback: AppWeekViewModel): AppWeekViewModel {
  const hasRisk = response.risk_flags.length > 0;
  const firstNextStep = response.next_steps[0];
  const plannedSlackMinutes = response.evidence.plan?.planned_slack_minutes;

  return {
    ...fallback,
    review: {
      ...fallback.review,
      weekLabel: formatWeekLabel(response.week_start, response.week_end),
      status: hasRisk ? "Needs attention" : "Steady",
      characterAlt: hasRisk ? "Week needs attention" : "Week is steady",
      bubble: buildBubble(response),
      rhythm: buildRhythm(response),
      narrative: buildNarrative(response),
      wins: response.wins.map((win, index) => ({
        id: `win-${index + 1}`,
        title: win.title,
        reason: win.evidence,
        evidence: evidenceRowsFromText(win.evidence)
      })),
      risks: response.risk_flags.map((risk, index) => ({
        id: `risk-${risk.type}-${index + 1}`,
        title: titleFromRiskType(risk.type),
        severity: mapRiskSeverity(risk.severity),
        reason: risk.evidence,
        evidence: evidenceRowsFromText(risk.evidence),
        action: "Plan"
      }))
    },
    signals: {
      summaries: buildSignalSummaries(response),
      evidence: buildSignalEvidence(response)
    },
    plan: {
      initialState: {
        suggestionStatus: firstNextStep ? "available" : "dismissed",
        focusProject: firstNextStep?.title ?? fallback.plan.initialState.focusProject,
        slackHours: typeof plannedSlackMinutes === "number" ? Math.max(0, Math.round(plannedSlackMinutes / 60)) : fallback.plan.initialState.slackHours,
        savedAt: null
      }
    },
    track: fallback.track
  };
}

function buildBubble(response: WeeklyReviewApiResponse): string {
  const win = response.wins[0]?.title;
  const next = response.next_steps[0]?.title;
  if (win && next) return `You moved ${win.toLowerCase()} forward. Next: ${next.toLowerCase()}.`;
  if (next) return `Your next useful move is ${next.toLowerCase()}.`;
  return "Your week has enough evidence for review.";
}

function buildNarrative(response: WeeklyReviewApiResponse): string[] {
  const insight = response.insights[0];
  const next = response.next_steps[0];
  return [
    insight ? `${insight.title}. ${insight.evidence}` : response.generated_text,
    next ? `${next.title}. ${next.reason}` : ""
  ].filter(Boolean);
}

function buildRhythm(response: WeeklyReviewApiResponse): readonly ("green" | "amber")[] {
  const hasRisk = response.risk_flags.length > 0;
  return ["green", "green", "green", hasRisk ? "amber" : "green", "green", "green", "green"];
}

function buildSignalSummaries(response: WeeklyReviewApiResponse): AppSignalSummary[] {
  const drift = response.evidence.plan?.project_drift?.find((row) => row.status && row.status !== "on_plan");
  const dormant = response.evidence.dormancy?.projects?.[0];
  const stage = response.evidence.stage_health?.projects?.find((row) => row.status && ["dormant", "wake_up_risk", "drift"].includes(row.status));
  const activity = response.evidence.activity;
  const restore = activity?.mix?.restore ?? 0;
  const consuming = activity?.mix?.consuming ?? 0;
  const destroy = activity?.mix?.destroy ?? 0;
  const hasAlignmentGap = response.risk_flags.some((risk) => risk.type === "alignment_gap");

  return [
    {
      id: "plan",
      label: "Plan",
      severity: drift ? "attention" : "normal",
      status: drift ? "Drift" : "Aligned",
      reason: drift ? `${drift.project_title ?? "Planned work"} moved away from plan.` : "Planned work stayed close enough."
    },
    {
      id: "stage",
      label: "Stage",
      severity: dormant || stage ? "severe" : "normal",
      status: dormant ? "Dormant" : stage ? "Drift" : "Healthy",
      reason: dormant
        ? `${dormant.project_title ?? "A project"} received no active block.`
        : stage
          ? `${stage.project_title ?? "A project"} needs stage attention.`
          : "Active projects have enough movement."
    },
    {
      id: "goal",
      label: "Goal",
      severity: hasAlignmentGap ? "attention" : "normal",
      status: hasAlignmentGap ? "Gap" : "Aligned",
      reason: response.risk_flags.find((risk) => risk.type === "alignment_gap")?.evidence ?? "The strongest work still supports the main goal."
    },
    {
      id: "energy",
      label: "Energy",
      severity: destroy > 0 || restore * 4 < consuming ? "attention" : "normal",
      status: destroy > 0 ? "Draining" : restore * 4 < consuming ? "Thin" : "Balanced",
      reason: destroy > 0 ? "Draining activity appeared this week." : "Recovery is compared against focus load."
    }
  ];
}

function buildSignalEvidence(response: WeeklyReviewApiResponse): AppSignalEvidence[] {
  const rows: AppSignalEvidence[] = [];
  const driftRows = response.evidence.plan?.project_drift ?? [];
  for (const drift of driftRows) {
    const hasDrift = Boolean(drift.status && drift.status !== "on_plan");
    rows.push({
      id: `plan-${drift.project_id ?? rows.length}`,
      signalId: "plan",
      title: drift.project_title ?? "Plan drift",
      severity: hasDrift ? "attention" : "normal",
      reason: hasDrift ? "Planned and actual time diverged." : "Plan stayed close enough.",
      rows: [
        { label: "Planned", value: formatMinutes(drift.planned_minutes) },
        { label: "Actual", value: formatMinutes(drift.actual_minutes) },
        { label: "Delta", value: formatSignedMinutes(drift.difference_minutes) }
      ],
      action: hasDrift ? "Plan" : undefined
    });
  }

  for (const dormant of response.evidence.dormancy?.projects ?? []) {
    rows.push({
      id: `stage-${dormant.project_id ?? rows.length}`,
      signalId: "stage",
      title: `${dormant.project_title ?? "Project"} dormant`,
      severity: dormant.risk_level === "high" ? "severe" : "attention",
      reason: "A planned project received no active block.",
      rows: [
        { label: "Minimum", value: formatMinutes(dormant.weekly_min_minutes) },
        { label: "Actual", value: formatMinutes(dormant.actual_minutes) },
        { label: "Inactive", value: typeof dormant.inactive_days === "number" ? `${dormant.inactive_days}d` : "-" }
      ],
      action: "Plan"
    });
  }

  const activity = response.evidence.activity;
  if (activity?.mix) {
    rows.push({
      id: "energy-mix",
      signalId: "energy",
      title: "Energy mix",
      severity: (activity.mix.destroy ?? 0) > 0 || (activity.mix.restore ?? 0) * 4 < (activity.mix.consuming ?? 0) ? "attention" : "normal",
      reason: "Energy balance is based on activity type minutes.",
      rows: [
        { label: "Focus", value: formatMinutes(activity.mix.consuming) },
        { label: "Restore", value: formatMinutes(activity.mix.restore) },
        { label: "Drain", value: formatMinutes(activity.mix.destroy) }
      ]
    });
  }

  if (rows.length === 0) {
    rows.push({
      id: "goal-summary",
      signalId: "goal",
      title: "Goal aligned",
      severity: "normal",
      reason: "No major evidence signal needs attention.",
      rows: [
        { label: "Logs", value: String(response.evidence.summary?.time_log_count ?? 0) },
        { label: "Actual", value: formatMinutes(response.evidence.summary?.actual_total_minutes) },
        { label: "Planned", value: formatMinutes(response.evidence.summary?.planned_total_minutes) }
      ]
    });
  }

  return rows;
}

function mapRiskSeverity(severity: RiskSeverity): SignalSeverity {
  if (severity === "high") return "severe";
  if (severity === "medium") return "attention";
  return "normal";
}

function titleFromRiskType(type: RiskType): string {
  const titles: Record<RiskType, string> = {
    alignment_gap: "Goal gap",
    plan_drift: "Plan drift",
    dormancy_risk: "Dormancy risk",
    overload_risk: "Overload risk",
    slack_risk: "Slack risk",
    destroy_pattern: "Drain pattern"
  };
  return titles[type];
}

function evidenceRowsFromText(text: string): Array<{ label: string; value: string }> {
  return [{ label: "Evidence", value: text }];
}

function formatWeekLabel(start: string, end: string): string {
  return `${formatMonthDay(start)} - ${formatMonthDay(end)}`;
}

function formatMonthDay(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function formatMinutes(minutes: number | undefined): string {
  if (typeof minutes !== "number") return "-";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}

function formatSignedMinutes(minutes: number | undefined): string {
  if (typeof minutes !== "number") return "-";
  if (minutes === 0) return "0m";
  return `${minutes > 0 ? "+" : "-"}${formatMinutes(Math.abs(minutes))}`;
}
