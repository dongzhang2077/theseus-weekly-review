import type { ActivityTimer, EnergyKind } from "../../shared/domain/track";
export type { ActivityTimer, EnergyKind } from "../../shared/domain/track";

const energyRank: Record<EnergyKind, number> = {
  destroy: 4,
  consume: 3,
  neutral: 2,
  restore: 1
};

export function tickActivities(activities: ActivityTimer[], seconds = 1): ActivityTimer[] {
  return activities.map((activity) =>
    activity.running
      ? {
          ...activity,
          sessionSeconds: activity.sessionSeconds + seconds,
          runSeconds: currentRunSeconds(activity) + seconds
        }
      : activity
  );
}

export function tickActivitiesByDate(
  activities: ActivityTimer[],
  elapsedByDate: Readonly<Record<string, number>>
): ActivityTimer[] {
  const elapsedSeconds = Object.values(elapsedByDate).reduce(
    (total, seconds) => total + Math.max(0, Math.floor(seconds)),
    0
  );
  if (elapsedSeconds <= 0) return activities;

  return activities.map((activity) => {
    if (!activity.running) return activity;
    const currentByDate = activity.sessionSecondsByDate ?? {};
    const sessionSecondsByDate = { ...currentByDate };
    for (const [date, seconds] of Object.entries(elapsedByDate)) {
      const wholeSeconds = Math.max(0, Math.floor(seconds));
      if (wholeSeconds > 0) {
        sessionSecondsByDate[date] = (sessionSecondsByDate[date] ?? 0) + wholeSeconds;
      }
    }
    return {
      ...activity,
      sessionSeconds: activity.sessionSeconds + elapsedSeconds,
      sessionSecondsByDate,
      runSeconds: currentRunSeconds(activity) + elapsedSeconds
    };
  });
}

export function startActivity(activities: ActivityTimer[], activityId: string): ActivityTimer[] {
  return activities.map((activity) => {
    if (activity.id !== activityId || activity.running) return activity;
    return { ...activity, running: true, runSeconds: 0 };
  });
}

export function pauseActivity(activities: ActivityTimer[], activityId: string): ActivityTimer[] {
  return activities.map((activity) =>
    activity.id === activityId ? { ...activity, running: false, runSeconds: 0 } : activity
  );
}

export function completeActivity(
  activities: ActivityTimer[],
  activityId: string,
  todayDate?: string
): ActivityTimer[] {
  return activities.map((activity) =>
    activity.id === activityId
      ? {
          ...activity,
          todayDate: todayDate ?? activity.todayDate,
          todaySeconds:
            (!todayDate || !activity.todayDate || activity.todayDate === todayDate
              ? activity.todaySeconds
              : 0) + sessionSecondsForDate(activity, todayDate),
          sessionSeconds: 0,
          sessionSecondsByDate: undefined,
          runSeconds: 0,
          running: false
        }
      : activity
  );
}

export function reconcileFocusActivities(
  incoming: ActivityTimer[],
  current: ActivityTimer[]
): ActivityTimer[] {
  const matchedCurrentIds = new Set<string>();
  const reconciled = incoming.map((activity) => {
    const previous = current.find((candidate) => {
      if (activity.activityId !== undefined || candidate.activityId !== undefined) {
        return activity.activityId !== undefined &&
          activity.activityId === candidate.activityId;
      }
      if (activity.id === candidate.id) return true;
      if (activity.projectId && candidate.projectId) {
        return activity.projectId === candidate.projectId;
      }
      return activity.focusContext?.source === "persisted_log" &&
        activity.name === candidate.name;
    });
    if (!previous) return activity;
    matchedCurrentIds.add(previous.id);
    return {
      ...activity,
      sessionSeconds: previous.sessionSeconds,
      sessionSecondsByDate: previous.sessionSecondsByDate,
      runSeconds: previous.runSeconds,
      running: previous.running
    };
  });

  const localActivities = current.filter(
    (activity) =>
      !matchedCurrentIds.has(activity.id) &&
      (activity.running ||
        activity.sessionSeconds > 0 ||
        activity.focusContext?.source === "manual" ||
        activity.focusContext?.source === "persisted_plan")
  );
  return [...reconciled, ...localActivities];
}

export function chooseFocusActivity(
  activities: ActivityTimer[],
  options: { ignoredIds?: readonly string[]; preferredId?: string | null } = {}
): ActivityTimer | null {
  const ignored = new Set(options.ignoredIds ?? []);
  const preferred = activities.find(
    (activity) => activity.id === options.preferredId && !ignored.has(activity.id)
  );
  if (preferred) return preferred;

  const running = activities.filter((activity) => activity.running);
  if (running.length > 0) return rankActivities(running)[0];

  const resumable = activities.filter((activity) => activity.sessionSeconds > 0);
  if (resumable.length > 0) return rankActivities(resumable)[0];

  const visible = activities.filter((activity) => !ignored.has(activity.id));
  const candidates = visible.filter((activity) => activity.recommended);
  const pool = candidates.length > 0 ? candidates : visible;

  return pool.length > 0 ? rankActivities(pool)[0] : null;
}

export function sessionSecondsForDate(activity: ActivityTimer, date?: string): number {
  if (activity.sessionSecondsByDate) {
    return date ? activity.sessionSecondsByDate[date] ?? 0 : activity.sessionSeconds;
  }
  return activity.sessionSeconds;
}

export function todayActivitySeconds(activity: ActivityTimer, date: string): number {
  const persistedToday = !activity.todayDate || activity.todayDate === date
    ? activity.todaySeconds
    : 0;
  return persistedToday + sessionSecondsForDate(activity, date);
}

export function currentRunSeconds(activity: ActivityTimer): number {
  if (!activity.running) return 0;
  return activity.runSeconds ?? activity.sessionSeconds;
}

export function nextFocusActivityId(
  activities: ActivityTimer[],
  currentId: string,
  ignoredIds: readonly string[] = []
): string | null {
  const ignored = new Set(ignoredIds);
  const visible = activities.filter((activity) => !ignored.has(activity.id));
  if (visible.length < 2 && visible.some((activity) => activity.id === currentId)) {
    return null;
  }
  if (visible.length === 0) return null;

  const currentIndex = visible.findIndex((activity) => activity.id === currentId);
  if (currentIndex < 0) return visible[0].id;
  return visible[(currentIndex + 1) % visible.length].id;
}

function rankActivities(activities: ActivityTimer[]): ActivityTimer[] {
  return [...activities].sort((a, b) => {
    const energyDelta = energyRank[b.energy] - energyRank[a.energy];
    if (energyDelta !== 0) return energyDelta;
    return currentRunSeconds(b) - currentRunSeconds(a);
  });
}

export function formatClock(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return [hours, minutes, rest].map((part) => String(part).padStart(2, "0")).join(":");
}

export function formatCompactClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function formatLiveClock(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const rest = String(seconds % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${minutes}:${rest}` : `${minutes}:${rest}`;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
