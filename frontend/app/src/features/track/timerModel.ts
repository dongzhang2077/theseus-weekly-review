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
    activity.running ? { ...activity, sessionSeconds: activity.sessionSeconds + seconds } : activity
  );
}

export function startActivity(activities: ActivityTimer[], activityId: string): ActivityTimer[] {
  const conflictingSession = activities.some(
    (activity) => activity.id !== activityId && (activity.running || activity.sessionSeconds > 0)
  );
  if (conflictingSession) return activities;

  return activities.map((activity) => ({
    ...activity,
    running: activity.id === activityId
  }));
}

export function pauseActivity(activities: ActivityTimer[], activityId: string): ActivityTimer[] {
  return activities.map((activity) =>
    activity.id === activityId ? { ...activity, running: false } : activity
  );
}

export function completeActivity(activities: ActivityTimer[], activityId: string): ActivityTimer[] {
  return activities.map((activity) =>
    activity.id === activityId
      ? {
          ...activity,
          todaySeconds: activity.todaySeconds + activity.sessionSeconds,
          sessionSeconds: 0,
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
    const previous = current.find((candidate) =>
      activity.projectId && candidate.projectId
        ? activity.projectId === candidate.projectId
        : activity.id === candidate.id ||
          (activity.focusContext?.source === "persisted_log" && activity.name === candidate.name)
    );
    if (!previous) return activity;
    matchedCurrentIds.add(previous.id);
    return {
      ...activity,
      sessionSeconds: previous.sessionSeconds,
      running: previous.running
    };
  });

  const localActivities = current.filter(
    (activity) =>
      !matchedCurrentIds.has(activity.id) &&
      (activity.focusContext?.source === "manual" || activity.focusContext?.source === "persisted_plan")
  );
  return [...reconciled, ...localActivities];
}

export function chooseFocusActivity(
  activities: ActivityTimer[],
  options: { ignoredIds?: readonly string[]; preferredId?: string | null } = {}
): ActivityTimer | null {
  const running = activities.filter((activity) => activity.running);
  if (running.length > 0) return rankActivities(running)[0];

  const resumable = activities.filter((activity) => activity.sessionSeconds > 0);
  if (resumable.length > 0) return rankActivities(resumable)[0];

  const ignored = new Set(options.ignoredIds ?? []);
  const visible = activities.filter((activity) => !ignored.has(activity.id));
  const preferred = visible.find((activity) => activity.id === options.preferredId);
  if (preferred) return preferred;

  const candidates = visible.filter((activity) => activity.recommended);
  const pool = candidates.length > 0 ? candidates : visible;

  return pool.length > 0 ? rankActivities(pool)[0] : null;
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
    return b.sessionSeconds - a.sessionSeconds;
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

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
