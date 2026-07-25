import { describe, expect, it } from "vitest";
import type { ActivityTimer } from "../../shared/domain/track";
import {
  persistTimerCheckpoint,
  restoreTimerCheckpoint,
  timerCheckpointKey
} from "./timerCheckpoint";

const baseActivity: ActivityTimer = {
  id: "build",
  projectId: 7,
  name: "Frontend build",
  category: "Project",
  energy: "consume",
  color: "#6f8f6b",
  todayDate: "2026-07-18",
  todaySeconds: 600,
  sessionSeconds: 30,
  sessionSecondsByDate: { "2026-07-18": 30 },
  runSeconds: 12,
  running: true
};

describe("timer checkpoint", () => {
  it("restores running elapsed time and splits a reload gap across local midnight", () => {
    const storage = new MemoryStorage();
    const savedAtMs = new Date("2026-07-19T06:59:58.000Z").getTime();
    persistTimerCheckpoint(storage, 4, [baseActivity], savedAtMs);

    const restored = restoreTimerCheckpoint(
      storage,
      4,
      [{ ...baseActivity, sessionSeconds: 0, sessionSecondsByDate: undefined, running: false }],
      "America/Los_Angeles",
      savedAtMs + 4_000
    );

    expect(restored[0]).toMatchObject({ running: true, sessionSeconds: 34, runSeconds: 16 });
    expect(restored[0].sessionSecondsByDate).toEqual({
      "2026-07-18": 32,
      "2026-07-19": 2
    });
  });

  it("keeps paused elapsed time frozen while the app is closed", () => {
    const storage = new MemoryStorage();
    persistTimerCheckpoint(storage, 9, [{ ...baseActivity, runSeconds: 0, running: false }], 1000);

    const restored = restoreTimerCheckpoint(storage, 9, [], "UTC", 61_000);

    expect(restored[0]).toMatchObject({ running: false, sessionSeconds: 30, runSeconds: 0 });
  });

  it("isolates checkpoints by account and removes the key after every session closes", () => {
    const storage = new MemoryStorage();
    persistTimerCheckpoint(storage, 1, [baseActivity], 1000);

    expect(restoreTimerCheckpoint(storage, 2, [], "UTC", 2000)).toEqual([]);
    persistTimerCheckpoint(
      storage,
      1,
      [{ ...baseActivity, running: false, sessionSeconds: 0, sessionSecondsByDate: undefined }],
      2000
    );
    expect(storage.getItem(timerCheckpointKey(1))).toBeNull();
  });

  it("discards malformed local state without breaking Focus", () => {
    const storage = new MemoryStorage();
    storage.setItem(timerCheckpointKey(3), "{bad-json");

    expect(restoreTimerCheckpoint(storage, 3, [baseActivity], "UTC", 2000)).toEqual([
      baseActivity
    ]);
    expect(storage.getItem(timerCheckpointKey(3))).toBeNull();
  });
});

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}
