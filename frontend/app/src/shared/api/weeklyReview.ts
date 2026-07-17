import type {
  PlanDraft,
  PlanProject,
  PlanProjectStage,
  PlanSeed,
  PlanSuggestion
} from "../domain/plan";
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
    goal_count?: number;
    project_count?: number;
    time_log_count?: number;
  };
  goals?: Array<{
    id?: number;
    title?: string;
    priority?: number;
    active_status?: boolean;
    actual_minutes?: number;
    active_project_count?: number;
  }>;
  projects?: Array<{
    id?: number;
    title?: string;
    stage?: string;
    status?: string;
    weekly_min_minutes?: number;
    weekly_target_minutes?: number;
    planned_minutes?: number;
    actual_minutes?: number;
    plan_status?: string;
    inactive_days?: number;
  }>;
  plan?: {
    week_start?: string;
    week_end?: string;
    planned_capacity_minutes?: number;
    slack_target_percent?: number;
    planned_total_minutes?: number;
    planned_slack_minutes?: number;
    required_slack_minutes?: number;
    slack_status?: string;
    item_count?: number;
    project_drift?: Array<{
      project_id?: number;
      project_title?: string;
      planned_minutes?: number;
      actual_minutes?: number;
      difference_minutes?: number;
      difference_ratio?: number;
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
      min_minutes?: number;
      target_minutes?: number;
      max_minutes?: number;
      inactive_days?: number;
      stage?: string;
      reason?: string;
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
  trace?: EvidenceTrace;
  action?: "Plan";
}

export interface EvidenceTrace {
  range: string;
  source: string;
  relatedTo?: string;
  records?: string;
  judgement: string;
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
  status?: string;
  value?: string;
  reason: string;
  rows: Array<{
    label: string;
    value: string;
  }>;
  trace?: EvidenceTrace;
  action?: "Plan";
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
  } & PlanSeed;
}

export function mapWeeklyReviewToAppWeek(response: WeeklyReviewApiResponse, fallback: AppWeekViewModel): AppWeekViewModel {
  const hasRisk = response.risk_flags.length > 0;
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
        evidence: evidenceRowsFromText(win.evidence),
        trace: buildEvidenceTrace(response, {
          source: "Weekly review",
          relatedTo: "Win",
          judgement: "Generated from positive finding evidence."
        })
      })),
      risks: response.risk_flags.map((risk, index) => ({
        id: `risk-${risk.type}-${index + 1}`,
        title: titleFromRiskType(risk.type),
        severity: mapRiskSeverity(risk.severity),
        reason: risk.evidence,
        evidence: evidenceRowsFromText(risk.evidence),
        trace: buildEvidenceTrace(response, {
          source: risk.type,
          relatedTo: titleFromRiskType(risk.type),
          judgement: "Generated from deterministic risk checks."
        }),
        action: "Plan"
      }))
    },
    signals: {
      summaries: buildSignalSummaries(response),
      evidence: buildSignalEvidence(response)
    },
    plan: buildPlanSeed(response),
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

function buildPlanSeed(response: WeeklyReviewApiResponse): PlanSeed {
  const reviewWeek = { start: response.week_start, end: response.week_end };
  const targetWeek = {
    start: shiftIsoDate(response.week_start, 7),
    end: shiftIsoDate(response.week_end, 7)
  };
  const planEvidence = response.evidence.plan;
  const projectRows = response.evidence.projects ?? [];
  const projects = buildPlanProjects(response);
  const sourcePlan: PlanDraft = {
    id: null,
    week: reviewWeek,
    capacityMinutes: planEvidence?.planned_capacity_minutes ?? 0,
    slackTargetPercent: planEvidence?.slack_target_percent ?? 20,
    items: (planEvidence?.project_drift ?? [])
      .filter((item) => (item.planned_minutes ?? 0) > 0)
      .map((item, index) => ({
        projectId: item.project_id ?? null,
        title: item.project_title ?? "Planned block",
        plannedMinutes: item.planned_minutes ?? 0,
        priority: index + 1,
        isCompleted: false
      })),
    note: "Carried forward from weekly review evidence."
  };

  return {
    reviewWeek,
    targetWeek,
    sourcePlan,
    projects,
    suggestion: buildPlanSuggestion(response, projects, projectRows)
  };
}

function buildPlanProjects(response: WeeklyReviewApiResponse): PlanProject[] {
  const projects = (response.evidence.projects ?? [])
    .filter((project): project is typeof project & { id: number; title: string } =>
      typeof project.id === "number" && Boolean(project.title)
    )
    .map((project) => ({
      id: project.id,
      title: project.title,
      stage: normalizeProjectStage(project.stage),
      status: normalizeProjectStatus(project.status),
      weeklyMinMinutes: project.weekly_min_minutes ?? 0,
      weeklyTargetMinutes: project.weekly_target_minutes ?? 0
    }));
  if (projects.length > 0) return projects;

  return (response.evidence.stage_health?.projects ?? [])
    .filter((project): project is typeof project & { project_id: number; project_title: string } =>
      typeof project.project_id === "number" && Boolean(project.project_title)
    )
    .map((project) => ({
      id: project.project_id,
      title: project.project_title,
      stage: normalizeProjectStage(project.stage),
      status: "active" as const,
      weeklyMinMinutes: project.min_minutes ?? 0,
      weeklyTargetMinutes: project.target_minutes ?? 0
    }));
}

function buildPlanSuggestion(
  response: WeeklyReviewApiResponse,
  projects: PlanProject[],
  projectRows: NonNullable<WeeklyReviewEvidence["projects"]>
): PlanSuggestion | null {
  const recommendation = response.next_steps[0];
  if (!recommendation) return null;

  const riskTypes = new Set(response.risk_flags.map((risk) => risk.type));
  const shouldRestart = riskTypes.has("dormancy_risk") || riskTypes.has("alignment_gap");
  const shouldReduce = !shouldRestart && (
    riskTypes.has("plan_drift") ||
    riskTypes.has("overload_risk") ||
    riskTypes.has("slack_risk")
  );
  const planRows = response.evidence.plan?.project_drift ?? [];
  const riskyStage = [...(response.evidence.stage_health?.projects ?? [])]
    .filter((project) => ["wake_up_risk", "drift", "overheated"].includes(project.status ?? ""))
    .sort((a, b) => suggestionStageRank(b.status) - suggestionStageRank(a.status))[0];
  const dormant = [...(response.evidence.dormancy?.projects ?? [])]
    .filter((project) =>
      project.missed_weekly_minimum || ["medium", "high"].includes(project.risk_level ?? "")
    )
    .sort((a, b) => (b.inactive_days ?? 0) - (a.inactive_days ?? 0))[0];
  const unsupported = [...projectRows]
    .filter((project) => project.status === "active" && (project.actual_minutes ?? 0) === 0)
    .sort((a, b) => (b.weekly_min_minutes ?? 0) - (a.weekly_min_minutes ?? 0))[0];
  const strongest = [...projectRows]
    .filter((project) => project.status === "active")
    .sort((a, b) => (b.actual_minutes ?? 0) - (a.actual_minutes ?? 0))[0];
  const underPlan = [...planRows]
    .filter((item) => item.status === "under_plan")
    .sort((a, b) => (a.difference_minutes ?? 0) - (b.difference_minutes ?? 0))[0];
  const reducible = [...planRows]
    .filter((item) => (item.planned_minutes ?? 0) > 0)
    .sort((a, b) => (b.planned_minutes ?? 0) - (a.planned_minutes ?? 0))[0];
  const candidateId = shouldReduce
    ? (underPlan ?? reducible)?.project_id
    : shouldRestart
      ? riskyStage?.project_id ?? dormant?.project_id ?? unsupported?.id ?? underPlan?.project_id
      : strongest?.id ?? planRows[0]?.project_id;
  const candidate = projects.find((project) => project.id === candidateId) ?? null;
  const plannedMinutes = planRows.find((item) => item.project_id === candidateId)?.planned_minutes ?? 0;

  if (shouldReduce && plannedMinutes <= 0) return null;
  const deltaMinutes = shouldReduce
    ? -Math.min(60, plannedMinutes)
    : Math.min(120, Math.max(60, candidate?.weeklyMinMinutes ?? 0));

  return {
    title: recommendation.title,
    reason: recommendation.reason,
    kind: shouldReduce ? "reduce" : "add",
    projectId: candidateId ?? null,
    projectTitle: candidate?.title
      ?? riskyStage?.project_title
      ?? dormant?.project_title
      ?? unsupported?.title
      ?? strongest?.title
      ?? underPlan?.project_title
      ?? null,
    deltaMinutes
  };
}

function suggestionStageRank(status: string | undefined): number {
  if (status === "wake_up_risk") return 3;
  if (status === "drift" || status === "overheated") return 2;
  return 0;
}

function normalizeProjectStage(stage: string | undefined): PlanProjectStage {
  if (["startup", "stable", "sprint", "dormant", "wake_up"].includes(stage ?? "")) {
    return stage as PlanProjectStage;
  }
  return "startup";
}

function normalizeProjectStatus(status: string | undefined): PlanProject["status"] {
  if (status === "paused" || status === "archived") return status;
  return "active";
}

function shiftIsoDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildRhythm(response: WeeklyReviewApiResponse): readonly ("green" | "amber")[] {
  const hasRisk = response.risk_flags.length > 0;
  return ["green", "green", "green", hasRisk ? "amber" : "green", "green", "green", "green"];
}

function buildSignalSummaries(response: WeeklyReviewApiResponse): AppSignalSummary[] {
  const plan = response.evidence.plan;
  const planRows = plan?.project_drift ?? [];
  const drift = [...planRows]
    .filter((row) => isPlanDrift(row.status))
    .sort((a, b) => Math.abs(b.difference_minutes ?? 0) - Math.abs(a.difference_minutes ?? 0))[0];
  const planRisk = highestRisk(response, ["plan_drift", "overload_risk", "slack_risk"]);
  const hasPlanData = Boolean(
    plan &&
      (planRows.length > 0 ||
        typeof plan.planned_total_minutes === "number" ||
        typeof plan.planned_capacity_minutes === "number")
  );
  const planSeverity = hasPlanData
    ? maxSignalSeverity(drift ? "attention" : "normal", riskSeverity(planRisk))
    : "nodata";

  const stageRows = response.evidence.stage_health?.projects ?? [];
  const worstStage = [...stageRows].sort(
    (a, b) => signalSeverityRank[stageSeverity(b.status)] - signalSeverityRank[stageSeverity(a.status)]
  )[0];
  const dormancyRows = (response.evidence.dormancy?.projects ?? []).filter(
    (row) => row.missed_weekly_minimum || ["medium", "high"].includes(row.risk_level ?? "")
  );
  const fallbackDormancy = [...dormancyRows].sort(
    (a, b) => (b.inactive_days ?? 0) - (a.inactive_days ?? 0)
  )[0];
  const stageRisk = highestRisk(response, ["dormancy_risk"]);
  const hasStageData = stageRows.length > 0 || (response.evidence.dormancy?.projects?.length ?? 0) > 0;
  const stageSeverityValue = hasStageData
    ? maxSignalSeverity(
        worstStage ? stageSeverity(worstStage.status) : fallbackDormancy ? dormancySeverity(fallbackDormancy.risk_level) : "normal",
        riskSeverity(stageRisk)
      )
    : "nodata";

  const goals = response.evidence.goals ?? [];
  const activeGoals = goals.filter((goal) => goal.active_status !== false);
  const topGoal = [...activeGoals].sort(
    (a, b) => (a.priority ?? 99) - (b.priority ?? 99)
  )[0];
  const gapGoal = activeGoals.find((goal) => (goal.actual_minutes ?? 0) === 0);
  const goalRisk = highestRisk(response, ["alignment_gap"]);
  const hasGoalData = goals.length > 0;
  const goalSeverity = hasGoalData || goalRisk
    ? maxSignalSeverity(gapGoal ? "attention" : "normal", riskSeverity(goalRisk))
    : "nodata";

  const activity = response.evidence.activity;
  const consuming = activity?.mix?.consuming ?? 0;
  const restore = activity?.mix?.restore ?? 0;
  const destroy = activity?.mix?.destroy ?? 0;
  const neutral = activity?.mix?.neutral ?? 0;
  const activityTotal = activity?.total_minutes ?? consuming + restore + destroy + neutral;
  const energyRisk = highestRisk(response, ["destroy_pattern"]);
  const recoveryIsThin = consuming > 0 && restore * 4 < consuming;
  const energySeverity = activityTotal > 0
    ? maxSignalSeverity(destroy > 0 || recoveryIsThin ? "attention" : "normal", riskSeverity(energyRisk))
    : "nodata";

  return [
    {
      id: "plan",
      label: "Plan",
      severity: planSeverity,
      status: hasPlanData ? (drift ? "Drift" : planRisk ? "Attention" : "Aligned") : "No data",
      reason: drift
        ? planDriftReason(drift)
        : planRisk?.evidence ?? (hasPlanData ? planTotalsReason(response) : "No weekly plan evidence yet.")
    },
    {
      id: "stage",
      label: "Stage",
      severity: stageSeverityValue,
      status: worstStage
        ? stageStatus(worstStage.status)
        : fallbackDormancy
          ? fallbackDormancy.risk_level === "high" ? "Wake-up" : "Drift"
          : hasStageData ? "Healthy" : "No data",
      reason: worstStage
        ? stageReason(worstStage)
        : fallbackDormancy
          ? dormancyReason(fallbackDormancy)
          : stageRisk?.evidence ?? (hasStageData ? "Active projects are within their stage ranges." : "No project stage evidence yet.")
    },
    {
      id: "goal",
      label: "Goal",
      severity: goalSeverity,
      status: gapGoal || goalRisk ? "Gap" : hasGoalData ? "Aligned" : "No data",
      reason: gapGoal
        ? `${gapGoal.title ?? "A goal"} received ${formatMinutes(gapGoal.actual_minutes)} this week.`
        : goalRisk?.evidence
          ?? (topGoal
            ? `${topGoal.title ?? "Top goal"} received ${formatMinutes(topGoal.actual_minutes)} this week.`
            : "No goal evidence yet.")
    },
    {
      id: "energy",
      label: "Energy",
      severity: energySeverity,
      status: activityTotal > 0 ? (destroy > 0 ? "Draining" : recoveryIsThin ? "Thin" : "Balanced") : "No data",
      reason: activityTotal > 0
        ? `${formatMinutes(consuming)} focus, ${formatMinutes(restore)} restore, ${formatMinutes(destroy)} drain.`
        : "No activity mix evidence yet."
    }
  ];
}

function buildSignalEvidence(response: WeeklyReviewApiResponse): AppSignalEvidence[] {
  const rows: AppSignalEvidence[] = [];
  const plan = response.evidence.plan;
  const planRows = plan?.project_drift ?? [];
  const planRisk = highestRisk(response, ["plan_drift", "overload_risk", "slack_risk"]);
  for (const drift of planRows) {
    const hasDrift = isPlanDrift(drift.status);
    const severity = hasDrift
      ? maxSignalSeverity("attention", riskSeverity(planRisk))
      : "normal";
    rows.push({
      id: `plan-${drift.project_id ?? rows.length}`,
      signalId: "plan",
      title: drift.project_title ?? "Planned work",
      severity,
      status: planStatus(drift.status),
      value: formatSignedMinutes(drift.difference_minutes),
      reason: hasDrift ? planDriftReason(drift) : "Planned and actual time stayed close enough.",
      rows: [
        { label: "Planned", value: formatMinutes(drift.planned_minutes) },
        { label: "Actual", value: formatMinutes(drift.actual_minutes) },
        { label: "Delta", value: formatSignedMinutes(drift.difference_minutes) }
      ],
      trace: buildEvidenceTrace(response, {
        source: "Weekly plan",
        relatedTo: drift.project_title ?? "Planned work",
        judgement: hasDrift ? "Plan and actual time differ enough to need attention." : "Plan and actual time stayed within range."
      }),
      action: hasDrift ? "Plan" : undefined
    });
  }

  if (plan && planRows.length === 0) {
    const severity = planRisk ? riskSeverity(planRisk) : "normal";
    rows.push({
      id: "plan-overview",
      signalId: "plan",
      title: "Weekly plan",
      severity,
      status: plan.slack_status === "healthy" ? "Aligned" : "Attention",
      value: formatMinutes(plan.planned_total_minutes),
      reason: planRisk?.evidence ?? planTotalsReason(response),
      rows: [
        { label: "Planned", value: formatMinutes(plan.planned_total_minutes) },
        { label: "Actual", value: formatMinutes(response.evidence.summary?.actual_total_minutes) },
        { label: "Slack", value: formatMinutes(plan.planned_slack_minutes) }
      ],
      trace: buildEvidenceTrace(response, {
        source: "Weekly plan",
        relatedTo: "Week",
        judgement: planRisk ? "Weekly plan crossed a risk threshold." : "Weekly plan stayed inside the current threshold."
      }),
      action: severity === "severe" || severity === "attention" ? "Plan" : undefined
    });
  }

  const stageRows = response.evidence.stage_health?.projects ?? [];
  for (const project of stageRows) {
    const severity = stageSeverity(project.status);
    rows.push({
      id: `stage-${project.project_id ?? rows.length}`,
      signalId: "stage",
      title: project.project_title ?? "Project",
      severity,
      status: stageStatus(project.status),
      value: formatMinutes(project.actual_minutes),
      reason: project.reason ?? stageReason(project),
      rows: [
        { label: "Actual", value: formatMinutes(project.actual_minutes) },
        { label: "Target", value: formatMinutes(project.target_minutes) },
        { label: "Inactive", value: formatDays(project.inactive_days) }
      ],
      trace: buildEvidenceTrace(response, {
        source: "Project stage",
        relatedTo: project.project_title ?? "Project",
        judgement: project.reason ?? stageReason(project)
      }),
      action: severity === "severe" || severity === "attention" ? "Plan" : undefined
    });
  }

  if (stageRows.length === 0) {
    for (const project of (response.evidence.dormancy?.projects ?? []).filter(
      (row) => row.missed_weekly_minimum || ["medium", "high"].includes(row.risk_level ?? "")
    )) {
      const severity = dormancySeverity(project.risk_level);
      rows.push({
        id: `stage-${project.project_id ?? rows.length}`,
        signalId: "stage",
        title: project.project_title ?? "Project",
        severity,
        status: project.risk_level === "high" ? "Wake-up" : "Drift",
        value: formatDays(project.inactive_days),
        reason: dormancyReason(project),
        rows: [
          { label: "Minimum", value: formatMinutes(project.weekly_min_minutes) },
          { label: "Actual", value: formatMinutes(project.actual_minutes) },
          { label: "Inactive", value: formatDays(project.inactive_days) }
        ],
        trace: buildEvidenceTrace(response, {
          source: "Dormancy",
          relatedTo: project.project_title ?? "Project",
          judgement: dormancyReason(project)
        }),
        action: "Plan"
      });
    }
  }

  const goalRisk = highestRisk(response, ["alignment_gap"]);
  for (const goal of response.evidence.goals ?? []) {
    const hasGap = goal.active_status !== false && (goal.actual_minutes ?? 0) === 0;
    const severity = hasGap
      ? maxSignalSeverity("attention", riskSeverity(goalRisk))
      : "normal";
    rows.push({
      id: `goal-${goal.id ?? rows.length}`,
      signalId: "goal",
      title: goal.title ?? "Goal",
      severity,
      status: hasGap ? "No time" : "Supported",
      value: formatMinutes(goal.actual_minutes),
      reason: hasGap
        ? `${goal.title ?? "This goal"} received no goal-linked time this week.`
        : `${goal.title ?? "This goal"} received goal-linked activity this week.`,
      rows: [
        { label: "Priority", value: String(goal.priority ?? "-") },
        { label: "Actual", value: formatMinutes(goal.actual_minutes) },
        { label: "Projects", value: String(goal.active_project_count ?? 0) }
      ],
      trace: buildEvidenceTrace(response, {
        source: "Goal alignment",
        relatedTo: goal.title ?? "Goal",
        judgement: hasGap ? "Active goal received no linked time." : "Active goal has linked work this week."
      }),
      action: hasGap ? "Plan" : undefined
    });
  }

  if ((response.evidence.goals ?? []).length === 0 && goalRisk) {
    rows.push({
      id: "goal-alignment-gap",
      signalId: "goal",
      title: "Goal alignment",
      severity: riskSeverity(goalRisk),
      status: "Gap",
      reason: goalRisk.evidence,
      rows: [
        { label: "Actual", value: formatMinutes(response.evidence.summary?.actual_total_minutes) },
        { label: "Logs", value: String(response.evidence.summary?.time_log_count ?? 0) }
      ],
      trace: buildEvidenceTrace(response, {
        source: "Goal alignment",
        relatedTo: "Goals",
        judgement: goalRisk.evidence
      }),
      action: "Plan"
    });
  }

  const activity = response.evidence.activity;
  const activityTotal = activity?.total_minutes
    ?? Object.values(activity?.mix ?? {}).reduce((total, value) => total + (value ?? 0), 0);
  if (activity?.mix && activityTotal > 0) {
    const consuming = activity.mix.consuming ?? 0;
    const restore = activity.mix.restore ?? 0;
    const destroy = activity.mix.destroy ?? 0;
    const recoveryIsThin = consuming > 0 && restore * 4 < consuming;
    const energyRisk = highestRisk(response, ["destroy_pattern"]);
    const severity = maxSignalSeverity(
      destroy > 0 || recoveryIsThin ? "attention" : "normal",
      riskSeverity(energyRisk)
    );
    rows.push({
      id: "energy-mix",
      signalId: "energy",
      title: "Energy mix",
      severity,
      status: destroy > 0 ? "Draining" : recoveryIsThin ? "Thin" : "Balanced",
      value: formatMinutes(activityTotal),
      reason: "Energy balance is based on activity type minutes.",
      rows: [
        { label: "Focus", value: formatMinutes(consuming) },
        { label: "Restore", value: formatMinutes(restore) },
        { label: "Drain", value: formatMinutes(destroy) }
      ],
      trace: buildEvidenceTrace(response, {
        source: "Activity mix",
        relatedTo: "Week",
        judgement: "Energy signal is based on activity type minutes."
      })
    });
  }

  return rows;
}

const signalSeverityRank: Record<SignalSeverity, number> = {
  severe: 3,
  attention: 2,
  normal: 1,
  nodata: 0
};

function highestRisk(
  response: WeeklyReviewApiResponse,
  types: RiskType[]
): WeeklyReviewApiRisk | null {
  return [...response.risk_flags]
    .filter((risk) => types.includes(risk.type))
    .sort(
      (a, b) => signalSeverityRank[mapRiskSeverity(b.severity)] - signalSeverityRank[mapRiskSeverity(a.severity)]
    )[0] ?? null;
}

function riskSeverity(risk: WeeklyReviewApiRisk | null): SignalSeverity {
  return risk ? mapRiskSeverity(risk.severity) : "nodata";
}

function maxSignalSeverity(...values: SignalSeverity[]): SignalSeverity {
  return values.reduce((highest, current) =>
    signalSeverityRank[current] > signalSeverityRank[highest] ? current : highest
  , "nodata");
}

function isPlanDrift(status: string | undefined): boolean {
  return ["under_plan", "over_plan", "unplanned"].includes(status ?? "");
}

function planStatus(status: string | undefined): string {
  if (status === "under_plan") return "Under plan";
  if (status === "over_plan") return "Over plan";
  if (status === "unplanned") return "Unplanned";
  if (status === "not_planned") return "Not planned";
  return "On track";
}

function planDriftReason(row: {
  project_title?: string;
  difference_minutes?: number;
}): string {
  const difference = row.difference_minutes ?? 0;
  const direction = difference < 0 ? "below" : "above";
  return `${row.project_title ?? "Planned work"} logged ${formatMinutes(Math.abs(difference))} ${direction} plan.`;
}

function planTotalsReason(response: WeeklyReviewApiResponse): string {
  return `${formatMinutes(response.evidence.plan?.planned_total_minutes)} planned, ${formatMinutes(response.evidence.summary?.actual_total_minutes)} logged.`;
}

function stageSeverity(status: string | undefined): SignalSeverity {
  if (status === "wake_up_risk") return "severe";
  if (status === "drift" || status === "overheated") return "attention";
  return status ? "normal" : "nodata";
}

function dormancySeverity(riskLevel: string | undefined): SignalSeverity {
  if (riskLevel === "high") return "severe";
  if (riskLevel === "medium") return "attention";
  return "normal";
}

function stageStatus(status: string | undefined): string {
  if (status === "wake_up_risk") return "Wake-up";
  if (status === "overheated") return "Overheated";
  if (status === "drift") return "Drift";
  if (status === "maintenance") return "Maintenance";
  if (status === "dormant") return "Dormant";
  if (status === "healthy") return "Healthy";
  return "No data";
}

function stageReason(row: {
  project_title?: string;
  status?: string;
  actual_minutes?: number;
  inactive_days?: number;
}): string {
  if (row.status === "wake_up_risk" && typeof row.inactive_days === "number") {
    return `${row.project_title ?? "A project"} has been inactive ${row.inactive_days}d.`;
  }
  return `${row.project_title ?? "A project"}: ${stageStatus(row.status).toLowerCase()} with ${formatMinutes(row.actual_minutes)} logged.`;
}

function dormancyReason(row: {
  project_title?: string;
  inactive_days?: number;
  actual_minutes?: number;
}): string {
  if (typeof row.inactive_days === "number") {
    return `${row.project_title ?? "A project"} has been inactive ${row.inactive_days}d.`;
  }
  return `${row.project_title ?? "A project"} logged ${formatMinutes(row.actual_minutes)} this week.`;
}

function formatDays(days: number | undefined): string {
  return typeof days === "number" ? `${days}d` : "-";
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

function buildEvidenceTrace(
  response: WeeklyReviewApiResponse,
  options: {
    source: string;
    judgement: string;
    relatedTo?: string;
  }
): EvidenceTrace {
  const summary = response.evidence.summary;
  const recordCount = summary?.time_log_count;
  return {
    range: formatWeekLabel(response.week_start, response.week_end),
    source: options.source,
    relatedTo: options.relatedTo,
    records: typeof recordCount === "number" ? `${recordCount} time logs` : undefined,
    judgement: options.judgement
  };
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
