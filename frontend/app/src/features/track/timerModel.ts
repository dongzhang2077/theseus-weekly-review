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

export function chooseFocusActivity(activities: ActivityTimer[]): ActivityTimer {
  const running = activities.filter((activity) => activity.running);
  const candidates = running.length > 0 ? running : activities.filter((activity) => activity.recommended);
  const pool = candidates.length > 0 ? candidates : activities;

  return [...pool].sort((a, b) => {
    const energyDelta = energyRank[b.energy] - energyRank[a.energy];
    if (energyDelta !== 0) return energyDelta;
    return b.sessionSeconds - a.sessionSeconds;
  })[0];
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
