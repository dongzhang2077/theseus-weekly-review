import type { ApiTimeLogRead } from "../../shared/api/timeLogs";
import type { PlanProject } from "../../shared/domain/plan";

export interface TimeRange {
  start: string;
  end: string;
}

export interface ProjectTimeBucket {
  key: string;
  projectId: number | null;
  title: string;
  seconds: number;
  percentage: number;
  recordIds: number[];
  members?: ProjectTimeBucket[];
}

export interface TimeRangeSummary {
  range: TimeRange;
  totalSeconds: number;
  recordIds: number[];
  buckets: ProjectTimeBucket[];
}

export interface TimeDaySummary extends TimeRangeSummary {
  date: string;
  status: "recorded" | "empty" | "unavailable";
}

export interface TimeWeekSummary extends TimeRangeSummary {
  days: TimeDaySummary[];
}

export type MonthIntensity = "none" | "low" | "medium" | "high";

export interface TimeMonthDaySummary extends TimeDaySummary {
  intensity: MonthIntensity;
}

export interface TimeMonthSummary extends TimeRangeSummary {
  days: TimeMonthDaySummary[];
  activeDayCount: number;
  averageActiveDaySeconds: number;
  hasEnoughDensity: boolean;
}

export const MONTH_MINIMUM_ACTIVE_DAYS = 7;
export const MONTH_LOW_MAX_SECONDS = 2 * 60 * 60;
export const MONTH_MEDIUM_MAX_SECONDS = 6 * 60 * 60;

export function aggregateProjectTime(
  logs: ApiTimeLogRead[],
  projects: PlanProject[],
  range: TimeRange
): TimeRangeSummary {
  assertIsoRange(range);
  const projectTitles = new Map(projects.map((project) => [project.id, project.title]));
  const matchingLogs = logs
    .filter((log) => isCountedLog(log, range))
    .sort(compareTimeLogs);
  const grouped = new Map<string, {
    projectId: number | null;
    title: string;
    seconds: number;
    recordIds: number[];
  }>();

  for (const log of matchingLogs) {
    const seconds = exactDurationSeconds(log);
    const identity = projectIdentity(log.project_id ?? null, projectTitles);
    const current = grouped.get(identity.key) ?? {
      projectId: identity.projectId,
      title: identity.title,
      seconds: 0,
      recordIds: [],
    };
    current.seconds += seconds;
    current.recordIds.push(log.id);
    grouped.set(identity.key, current);
  }

  const totalSeconds = [...grouped.values()].reduce(
    (total, bucket) => total + bucket.seconds,
    0
  );
  const buckets = [...grouped.entries()]
    .map(([key, bucket]) => ({
      key,
      ...bucket,
      percentage: percentageOf(bucket.seconds, totalSeconds),
    }))
    .sort(compareBuckets);

  return {
    range,
    totalSeconds,
    recordIds: matchingLogs.map((log) => log.id),
    buckets,
  };
}

export function aggregateTimeWeek(
  logs: ApiTimeLogRead[],
  projects: PlanProject[],
  weekStart: string,
  accountToday: string
): TimeWeekSummary {
  assertIsoDate(weekStart, "weekStart");
  assertIsoDate(accountToday, "accountToday");
  const dates = Array.from({ length: 7 }, (_, index) => addIsoDays(weekStart, index));
  const days = dates.map((date): TimeDaySummary => {
    if (date > accountToday) {
      return {
        date,
        status: "unavailable",
        range: { start: date, end: date },
        totalSeconds: 0,
        recordIds: [],
        buckets: [],
      };
    }
    const summary = aggregateProjectTime(logs, projects, { start: date, end: date });
    return {
      ...summary,
      date,
      status: summary.totalSeconds > 0 ? "recorded" : "empty",
    };
  });
  const totalSeconds = days.reduce((total, day) => total + day.totalSeconds, 0);
  const recordIds = days.flatMap((day) => day.recordIds);
  const buckets = combineBuckets(days.flatMap((day) => day.buckets), totalSeconds);

  return {
    range: { start: dates[0], end: dates[6] },
    totalSeconds,
    recordIds,
    buckets,
    days,
  };
}

export function aggregateTimeMonth(
  logs: ApiTimeLogRead[],
  projects: PlanProject[],
  monthStart: string,
  accountToday: string
): TimeMonthSummary {
  assertIsoDate(monthStart, "monthStart");
  assertIsoDate(accountToday, "accountToday");
  if (!monthStart.endsWith("-01")) {
    throw new RangeError("monthStart must be the first day of a calendar month");
  }
  const nextMonthStart = addIsoMonths(monthStart, 1);
  const monthEnd = addIsoDays(nextMonthStart, -1);
  const dayCount = Number(monthEnd.slice(-2));
  const days = Array.from({ length: dayCount }, (_, index): TimeMonthDaySummary => {
    const date = addIsoDays(monthStart, index);
    if (date > accountToday) {
      return {
        date,
        status: "unavailable",
        intensity: "none",
        range: { start: date, end: date },
        totalSeconds: 0,
        recordIds: [],
        buckets: [],
      };
    }
    const summary = aggregateProjectTime(logs, projects, { start: date, end: date });
    return {
      ...summary,
      date,
      status: summary.totalSeconds > 0 ? "recorded" : "empty",
      intensity: monthIntensity(summary.totalSeconds),
    };
  });
  const availableDays = days.filter((day) => day.status !== "unavailable");
  const activeDays = availableDays.filter((day) => day.status === "recorded");
  const totalSeconds = activeDays.reduce((total, day) => total + day.totalSeconds, 0);
  const recordIds = activeDays.flatMap((day) => day.recordIds);

  return {
    range: { start: monthStart, end: monthEnd },
    totalSeconds,
    recordIds,
    buckets: combineBuckets(activeDays.flatMap((day) => day.buckets), totalSeconds),
    days,
    activeDayCount: activeDays.length,
    averageActiveDaySeconds: activeDays.length > 0
      ? Math.round(totalSeconds / activeDays.length)
      : 0,
    hasEnoughDensity: activeDays.length >= MONTH_MINIMUM_ACTIVE_DAYS,
  };
}

export function monthIntensity(seconds: number): MonthIntensity {
  if (seconds <= 0) return "none";
  if (seconds < MONTH_LOW_MAX_SECONDS) return "low";
  if (seconds < MONTH_MEDIUM_MAX_SECONDS) return "medium";
  return "high";
}

export function collapseProjectBuckets(
  buckets: ProjectTimeBucket[],
  maximumVisible = 4
): ProjectTimeBucket[] {
  if (!Number.isInteger(maximumVisible) || maximumVisible < 2) {
    throw new RangeError("maximumVisible must be an integer of at least 2");
  }
  if (buckets.length <= maximumVisible) return buckets.map(copyBucket);

  const ordered = buckets.map(copyBucket).sort(compareBuckets);
  const visible = ordered.slice(0, maximumVisible - 1);
  const members = ordered.slice(maximumVisible - 1);
  const totalSeconds = ordered.reduce((total, bucket) => total + bucket.seconds, 0);
  const otherSeconds = members.reduce((total, bucket) => total + bucket.seconds, 0);
  const otherRecordIds = members.flatMap((bucket) => bucket.recordIds);

  return [
    ...visible,
    {
      key: "other",
      projectId: null,
      title: "Other",
      seconds: otherSeconds,
      percentage: percentageOf(otherSeconds, totalSeconds),
      recordIds: otherRecordIds,
      members,
    },
  ];
}

function combineBuckets(
  buckets: ProjectTimeBucket[],
  totalSeconds: number
): ProjectTimeBucket[] {
  const combined = new Map<string, ProjectTimeBucket>();
  for (const bucket of buckets) {
    const current = combined.get(bucket.key) ?? {
      key: bucket.key,
      projectId: bucket.projectId,
      title: bucket.title,
      seconds: 0,
      percentage: 0,
      recordIds: [],
    };
    current.seconds += bucket.seconds;
    current.recordIds.push(...bucket.recordIds);
    combined.set(bucket.key, current);
  }
  return [...combined.values()]
    .map((bucket) => ({
      ...bucket,
      percentage: percentageOf(bucket.seconds, totalSeconds),
    }))
    .sort(compareBuckets);
}

function isCountedLog(log: ApiTimeLogRead, range: TimeRange): boolean {
  return log.deleted_at === null
    && log.date >= range.start
    && log.date <= range.end
    && exactDurationSeconds(log) > 0;
}

function exactDurationSeconds(log: ApiTimeLogRead): number {
  return Number.isFinite(log.duration_seconds)
    ? Math.max(0, Math.trunc(log.duration_seconds))
    : 0;
}

function projectIdentity(
  projectId: number | null,
  projectTitles: Map<number, string>
): { key: string; projectId: number | null; title: string } {
  if (projectId === null) {
    return { key: "unassigned", projectId: null, title: "Unassigned" };
  }
  return {
    key: `project:${projectId}`,
    projectId,
    title: projectTitles.get(projectId) ?? "Unknown project",
  };
}

function compareTimeLogs(left: ApiTimeLogRead, right: ApiTimeLogRead): number {
  return left.date.localeCompare(right.date)
    || (left.start_time ?? "").localeCompare(right.start_time ?? "")
    || left.id - right.id;
}

function compareBuckets(left: ProjectTimeBucket, right: ProjectTimeBucket): number {
  return right.seconds - left.seconds
    || left.title.localeCompare(right.title)
    || (left.projectId ?? -1) - (right.projectId ?? -1)
    || left.key.localeCompare(right.key);
}

function percentageOf(seconds: number, totalSeconds: number): number {
  return totalSeconds > 0 ? Math.round((seconds / totalSeconds) * 1000) / 10 : 0;
}

function copyBucket(bucket: ProjectTimeBucket): ProjectTimeBucket {
  return {
    ...bucket,
    recordIds: [...bucket.recordIds],
    ...(bucket.members ? { members: bucket.members.map(copyBucket) } : {}),
  };
}

function assertIsoRange(range: TimeRange): void {
  assertIsoDate(range.start, "range.start");
  assertIsoDate(range.end, "range.end");
  if (range.end < range.start) throw new RangeError("range.end must not precede range.start");
}

function assertIsoDate(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError(`${label} must use YYYY-MM-DD`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw new RangeError(`${label} must be a real calendar date`);
  }
}

function addIsoDays(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function addIsoMonths(value: string, months: number): string {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + months, 1)).toISOString().slice(0, 10);
}
