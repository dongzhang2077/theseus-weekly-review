import type { ActivityTimer } from "../../shared/domain/track";
import { splitElapsedSecondsByDate } from "../../shared/api/timeLogs";
import { reconcileFocusActivities, tickActivitiesByDate } from "./timerModel";

interface TimerStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface TimerCheckpoint {
  version: 1;
  savedAtMs: number;
  activities: ActivityTimer[];
}

const storagePrefix = "theseus.focus.timer.v1";

export function persistTimerCheckpoint(
  storage: TimerStorage,
  userId: number,
  activities: ActivityTimer[],
  savedAtMs = Date.now()
): void {
  const key = timerCheckpointKey(userId);
  const openActivities = activities.filter(
    (activity) => activity.running || activity.sessionSeconds > 0
  );
  try {
    if (openActivities.length === 0) {
      storage.removeItem(key);
      return;
    }
    const checkpoint: TimerCheckpoint = {
      version: 1,
      savedAtMs,
      activities: openActivities
    };
    storage.setItem(key, JSON.stringify(checkpoint));
  } catch {
    // A blocked or full browser store must not interrupt an active timer.
  }
}

export function restoreTimerCheckpoint(
  storage: TimerStorage,
  userId: number,
  incoming: ActivityTimer[],
  timeZone?: string,
  nowMs = Date.now()
): ActivityTimer[] {
  const checkpoint = readTimerCheckpoint(storage, userId);
  if (!checkpoint) return incoming;

  const elapsedSeconds = Math.max(0, Math.floor((nowMs - checkpoint.savedAtMs) / 1000));
  const restored = elapsedSeconds > 0
    ? tickActivitiesByDate(
        checkpoint.activities,
        splitElapsedSecondsByDate(checkpoint.savedAtMs, elapsedSeconds, timeZone)
      )
    : checkpoint.activities;
  return reconcileFocusActivities(incoming, restored);
}

export function timerCheckpointKey(userId: number): string {
  return `${storagePrefix}.${userId}`;
}

function readTimerCheckpoint(storage: TimerStorage, userId: number): TimerCheckpoint | null {
  try {
    const raw = storage.getItem(timerCheckpointKey(userId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<TimerCheckpoint>;
    if (
      value.version !== 1 ||
      typeof value.savedAtMs !== "number" ||
      !Number.isFinite(value.savedAtMs) ||
      !Array.isArray(value.activities) ||
      !value.activities.every(isActivityTimer)
    ) {
      storage.removeItem(timerCheckpointKey(userId));
      return null;
    }
    return value as TimerCheckpoint;
  } catch {
    try {
      storage.removeItem(timerCheckpointKey(userId));
    } catch {
      // Ignore unavailable browser storage.
    }
    return null;
  }
}

function isActivityTimer(value: unknown): value is ActivityTimer {
  if (!value || typeof value !== "object") return false;
  const activity = value as Partial<ActivityTimer>;
  return (
    typeof activity.id === "string" &&
    typeof activity.name === "string" &&
    typeof activity.category === "string" &&
    typeof activity.color === "string" &&
    typeof activity.todaySeconds === "number" &&
    typeof activity.sessionSeconds === "number" &&
    (activity.runSeconds === undefined ||
      (typeof activity.runSeconds === "number" &&
        Number.isFinite(activity.runSeconds) &&
        activity.runSeconds >= 0)) &&
    typeof activity.running === "boolean" &&
    ["destroy", "consume", "neutral", "restore"].includes(activity.energy ?? "")
  );
}
