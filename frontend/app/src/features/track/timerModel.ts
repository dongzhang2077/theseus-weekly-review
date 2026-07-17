import type { ActivityTimer, EnergyKind } from "../../shared/domain/track";
export type { ActivityTimer, EnergyKind } from "../../shared/domain/track";

const energyRank: Record<EnergyKind, number> = {
  destroy: 4,
  consume: 3,
  neutral: 2,
  restore: 1
};

export function toggleActivity(activities: ActivityTimer[], activityId: string): ActivityTimer[] {
  return activities.map((activity) => {
    if (activity.id !== activityId) return activity;
    if (activity.running) {
      return {
        ...activity,
        todaySeconds: activity.todaySeconds + activity.sessionSeconds,
        sessionSeconds: 0,
        running: false
      };
    }

    return {
      ...activity,
      sessionSeconds: 0,
      running: true
    };
  });
}

export function tickActivities(activities: ActivityTimer[], seconds = 1): ActivityTimer[] {
  return activities.map((activity) =>
    activity.running ? { ...activity, sessionSeconds: activity.sessionSeconds + seconds } : activity
  );
}

export function chooseFocusActivity(
  activities: ActivityTimer[],
  options: { ignoredIds?: readonly string[]; preferredId?: string | null } = {}
): ActivityTimer {
  const running = activities.filter((activity) => activity.running);
  if (running.length > 0) return sortFocusCandidates(running)[0];

  const ignored = new Set(options.ignoredIds ?? []);
  const visible = activities.filter((activity) => !ignored.has(activity.id));
  const preferred = visible.find((activity) => activity.id === options.preferredId);
  if (preferred) return preferred;

  const candidates = visible.filter((activity) => activity.recommended);
  const pool = candidates.length > 0 ? candidates : visible.length > 0 ? visible : activities;

  return sortFocusCandidates(pool)[0];
}

function sortFocusCandidates(activities: ActivityTimer[]): ActivityTimer[] {
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

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
