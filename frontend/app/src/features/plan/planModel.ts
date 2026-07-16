import type {
  PlanBalanceStatus,
  PlanDateRange,
  PlanDraft,
  PlanItem,
  PlanProject,
  PlanSeed,
  PlanSuggestion,
  SuggestionStatus
} from "../../shared/domain/plan";

export type {
  PlanBalanceStatus,
  PlanDateRange,
  PlanDraft,
  PlanItem,
  PlanProject,
  PlanSeed,
  PlanSuggestion,
  SuggestionStatus
} from "../../shared/domain/plan";

export interface PlanWorkspace {
  draft: PlanDraft;
  persistedPlan: PlanDraft | null;
  projects: PlanProject[];
  suggestion: PlanSuggestion | null;
  suggestionStatus: SuggestionStatus;
}

export interface PlanLiveRecords {
  plans: PlanDraft[];
  projects: PlanProject[];
}

export interface PlanMetrics {
  plannedMinutes: number;
  capacityMinutes: number;
  slackMinutes: number | null;
  requiredSlackMinutes: number | null;
  loadRatio: number | null;
  status: PlanBalanceStatus;
}

export interface PlanProposal {
  suggestion: PlanSuggestion;
  after: PlanDraft;
  beforeProjectMinutes: number;
  afterProjectMinutes: number;
  beforeMetrics: PlanMetrics;
  afterMetrics: PlanMetrics;
}

export function createPlanWorkspace(
  seed: PlanSeed,
  liveRecords?: PlanLiveRecords
): PlanWorkspace {
  const plans = liveRecords?.plans ?? [];
  const projects = liveRecords ? liveRecords.projects : seed.projects;
  const targetPlan = plans.find((plan) => sameWeek(plan.week, seed.targetWeek)) ?? null;
  const reviewedPlan = plans.find((plan) => sameWeek(plan.week, seed.reviewWeek)) ?? null;
  const source = targetPlan ?? reviewedPlan ?? seed.sourcePlan;
  const draft = targetPlan
    ? clonePlan(targetPlan, seed.targetWeek, true)
    : clonePlan(source, seed.targetWeek, false);
  const suggestion = resolveSuggestion(seed.suggestion, projects, draft);

  return {
    draft,
    persistedPlan: targetPlan,
    projects,
    suggestion,
    suggestionStatus: suggestion ? "available" : "dismissed"
  };
}

export function createUpcomingPlanSeed(reference: Date = new Date()): PlanSeed {
  const targetWeek = nextMondayWeek(reference);
  const reviewWeek = {
    start: shiftIsoDate(targetWeek.start, -7),
    end: shiftIsoDate(targetWeek.end, -7)
  };
  return {
    reviewWeek,
    targetWeek,
    sourcePlan: {
      id: null,
      week: reviewWeek,
      capacityMinutes: 0,
      slackTargetPercent: 20,
      items: [],
      note: ""
    },
    projects: [],
    suggestion: null
  };
}

export function calculatePlanMetrics(plan: PlanDraft): PlanMetrics {
  const plannedMinutes = plan.items.reduce(
    (total, item) => total + item.plannedMinutes,
    0
  );
  if (plan.capacityMinutes <= 0) {
    return {
      plannedMinutes,
      capacityMinutes: plan.capacityMinutes,
      slackMinutes: null,
      requiredSlackMinutes: null,
      loadRatio: null,
      status: "unknown"
    };
  }

  const slackMinutes = plan.capacityMinutes - plannedMinutes;
  const requiredSlackMinutes = Math.round(
    plan.capacityMinutes * (plan.slackTargetPercent / 100)
  );
  return {
    plannedMinutes,
    capacityMinutes: plan.capacityMinutes,
    slackMinutes,
    requiredSlackMinutes,
    loadRatio: plannedMinutes / plan.capacityMinutes,
    status:
      slackMinutes < 0
        ? "overloaded"
        : slackMinutes < requiredSlackMinutes
          ? "tight"
          : "balanced"
  };
}

export function buildPlanProposal(workspace: PlanWorkspace): PlanProposal | null {
  if (!workspace.suggestion || workspace.suggestionStatus !== "available") return null;
  const after = applyPlanSuggestion(workspace.draft, workspace.suggestion);
  const beforeProjectMinutes = projectMinutes(
    workspace.draft.items,
    workspace.suggestion.projectId
  );
  const afterProjectMinutes = projectMinutes(after.items, workspace.suggestion.projectId);
  if (samePlanItems(workspace.draft.items, after.items)) return null;

  return {
    suggestion: workspace.suggestion,
    after,
    beforeProjectMinutes,
    afterProjectMinutes,
    beforeMetrics: calculatePlanMetrics(workspace.draft),
    afterMetrics: calculatePlanMetrics(after)
  };
}

export function applyPlanSuggestion(
  draft: PlanDraft,
  suggestion: PlanSuggestion
): PlanDraft {
  const items = draft.items.map((item) => ({ ...item }));
  if (suggestion.deltaMinutes > 0) {
    const matchingIndex = items.findIndex(
      (item) => item.projectId === suggestion.projectId
    );
    if (matchingIndex >= 0) {
      items[matchingIndex] = {
        ...items[matchingIndex],
        plannedMinutes: items[matchingIndex].plannedMinutes + suggestion.deltaMinutes
      };
    } else {
      items.push({
        projectId: suggestion.projectId,
        title: suggestion.title,
        plannedMinutes: suggestion.deltaMinutes,
        priority: Math.max(0, ...items.map((item) => item.priority)) + 1,
        isCompleted: false
      });
    }
  } else {
    let remaining = Math.abs(suggestion.deltaMinutes);
    const candidates = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) =>
        suggestion.projectId === null || item.projectId === suggestion.projectId
      )
      .sort((a, b) => b.item.priority - a.item.priority || b.index - a.index);
    for (const candidate of candidates) {
      if (remaining <= 0) break;
      const reduction = Math.min(candidate.item.plannedMinutes, remaining);
      items[candidate.index].plannedMinutes -= reduction;
      remaining -= reduction;
    }
  }

  return {
    ...draft,
    items: items.filter((item) => item.plannedMinutes > 0)
  };
}

export function dismissPlanSuggestion(workspace: PlanWorkspace): PlanWorkspace {
  return { ...workspace, suggestionStatus: "dismissed" };
}

export function formatPlanWeek(week: PlanDateRange): string {
  return `${formatMonthDay(week.start)} - ${formatMonthDay(week.end)}`;
}

function clonePlan(
  source: PlanDraft,
  week: PlanDateRange,
  preserveIdentity: boolean
): PlanDraft {
  return {
    ...source,
    id: preserveIdentity ? source.id : null,
    week: { ...week },
    items: source.items.map((item) => ({
      ...item,
      ...(preserveIdentity ? {} : { id: undefined }),
      isCompleted: preserveIdentity ? item.isCompleted : false
    })),
    ...(preserveIdentity
      ? {}
      : { userId: undefined, createdAt: undefined, updatedAt: undefined })
  };
}

function resolveSuggestion(
  suggestion: PlanSuggestion | null,
  projects: PlanProject[],
  draft: PlanDraft
): PlanSuggestion | null {
  if (!suggestion) return null;
  const exactProject = projects.find((project) => project.id === suggestion.projectId);
  if (exactProject) {
    return { ...suggestion, projectTitle: exactProject.title };
  }

  if (suggestion.kind === "reduce") {
    const candidate = [...draft.items]
      .sort((a, b) => b.priority - a.priority)
      .find((item) => item.plannedMinutes > 0);
    if (!candidate) return null;
    const project = projects.find((item) => item.id === candidate.projectId);
    return {
      ...suggestion,
      projectId: candidate.projectId,
      projectTitle: project?.title ?? candidate.title,
      deltaMinutes: -Math.min(Math.abs(suggestion.deltaMinutes), candidate.plannedMinutes)
    };
  }

  const project = [...projects]
    .filter((item) => item.status === "active")
    .sort((a, b) => stageRank(a.stage) - stageRank(b.stage) || a.id - b.id)[0];
  return project
    ? { ...suggestion, projectId: project.id, projectTitle: project.title }
    : suggestion;
}

function projectMinutes(items: PlanItem[], projectId: number | null): number {
  return items
    .filter((item) => item.projectId === projectId)
    .reduce((total, item) => total + item.plannedMinutes, 0);
}

function samePlanItems(before: PlanItem[], after: PlanItem[]): boolean {
  return JSON.stringify(before) === JSON.stringify(after);
}

function sameWeek(left: PlanDateRange, right: PlanDateRange): boolean {
  return left.start === right.start && left.end === right.end;
}

function nextMondayWeek(reference: Date): PlanDateRange {
  const cursor = new Date(Date.UTC(
    reference.getUTCFullYear(),
    reference.getUTCMonth(),
    reference.getUTCDate()
  ));
  const day = cursor.getUTCDay();
  cursor.setUTCDate(cursor.getUTCDate() + (day === 0 ? 1 : 8 - day));
  const start = cursor.toISOString().slice(0, 10);
  cursor.setUTCDate(cursor.getUTCDate() + 6);
  return { start, end: cursor.toISOString().slice(0, 10) };
}

function shiftIsoDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatMonthDay(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
}

function stageRank(stage: PlanProject["stage"]): number {
  if (stage === "wake_up") return 0;
  if (stage === "startup") return 1;
  if (stage === "sprint") return 2;
  if (stage === "stable") return 3;
  return 4;
}
