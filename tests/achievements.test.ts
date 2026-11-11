import { afterEach, describe, it, expect, vi } from "vitest";
import { RunAchievements } from "../src/achievements";
import definitions from "../src/achievement-definitions.json";
import type { GameServices, Achievement } from "@supagame/sdk-ts";
describe("Vaccoin achievements", () => {
  afterEach(() => vi.useRealTimers());
  it("defines six single-run thresholds on the existing board", () => {
    expect(definitions.map((a) => a.condition.threshold)).toEqual([
      500, 1000, 5000, 10000, 15000, 20000,
    ]);
    expect(
      definitions.every(
        (a) =>
          a.condition.leaderboardId === "vaccoin" &&
          a.description.includes("one run"),
      ),
    ).toBe(true);
    expect(new Set(definitions.map((a) => a.id)).size).toBe(6);
  });
  it("shows all locked definitions offline without inventing unlocks", () => {
    const model = new RunAchievements();
    expect(model.rows).toHaveLength(6);
    expect(model.rows.every((a) => !a.unlocked)).toBe(true);
  });
  it("displays simultaneous server awards immediately during play in FIFO order", async () => {
    vi.useFakeTimers();
    let emit!: (a: Achievement) => void;
    const off = vi.fn();
    const model = new RunAchievements({
      achievements: {
        getPlayerAchievements: async () => new RunAchievements().rows,
        onUnlocked: (cb: (a: Achievement) => void) => {
          emit = cb;
          return { ready: Promise.resolve(), unsubscribe: off };
        },
      },
    } as unknown as GameServices);
    await model.connect();
    model.update("playing");
    for (const row of model.rows.slice(0, 4))
      emit({ ...row, unlocked: true, unlockedAt: "2026-11-10T00:00:00Z" });

    expect(model.queue?.current?.id).toBe("run-coins-500");
    await vi.advanceTimersByTimeAsync(4000);
    expect(model.queue?.current?.id).toBe("run-coins-1000");
    model.dispose();
    expect(off).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
  it("announces live thresholds before submission, once each, even offline", async () => {
    vi.useFakeTimers();
    const model = new RunAchievements();
    model.update("playing", false, 499);
    expect(model.queue?.current).toBeNull();
    model.update("playing", false, 500);
    expect(model.queue?.current?.id).toBe("run-coins-500");
    model.update("playing", false, 12000);
    model.update("playing", false, 12000);
    expect(model.queue?.pending).toBe(3);
    for (const id of ["run-coins-1000", "run-coins-5000", "run-coins-10000"]) {
      await vi.advanceTimersByTimeAsync(4000);
      expect(model.queue?.current?.id).toBe(id);
    }
    await vi.advanceTimersByTimeAsync(4000);
    model.update("results", false, 12000);
    model.update("playing", false, 500);
    expect(model.queue?.current).toBeNull();
    expect(model.rows.every((a) => !a.unlocked)).toBe(true);
    model.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("skips saved unlocks and suppresses server confirmations of live notices", async () => {
    vi.useFakeTimers();
    let emit!: (a: Achievement) => void;
    const rows = new RunAchievements().rows;
    rows[0] = { ...rows[0], unlocked: true, historical: true };
    const model = new RunAchievements({
      achievements: {
        getPlayerAchievements: async () => rows,
        onUnlocked: (cb: (a: Achievement) => void) => {
          emit = cb;
          return { ready: Promise.resolve(), unsubscribe: vi.fn() };
        },
      },
    } as unknown as GameServices);
    await model.connect();
    model.update("playing", false, 1000);
    expect(model.queue?.current?.id).toBe("run-coins-1000");
    emit({ ...rows[1], unlocked: true, unlockedAt: "2026-11-10T00:00:00Z" });
    expect(model.queue?.pending).toBe(0);
    await vi.advanceTimersByTimeAsync(4000);
    expect(model.queue?.current).toBeNull();
    model.dispose();
  });
  it("holds live notices while hidden and resumes them during gameplay", async () => {
    vi.useFakeTimers();
    const model = new RunAchievements();
    model.update("playing", true, 1000);
    expect(model.queue?.current).toBeNull();
    await vi.advanceTimersByTimeAsync(8000);
    model.update("playing", false, 1000);
    expect(model.queue?.current?.id).toBe("run-coins-500");
    model.update("playing", true, 1000);
    await vi.advanceTimersByTimeAsync(8000);
    expect(model.queue?.current?.id).toBe("run-coins-500");
    model.update("playing", false, 1000);
    await vi.advanceTimersByTimeAsync(4000);
    expect(model.queue?.current?.id).toBe("run-coins-1000");
    model.dispose();
  });
  it("waits for saved achievements before announcing live milestones", async () => {
    vi.useFakeTimers();
    let resolve!: (rows: Achievement[]) => void;
    const model = new RunAchievements({
      achievements: {
        getPlayerAchievements: () =>
          new Promise<Achievement[]>((done) => {
            resolve = done;
          }),
        onUnlocked: () => ({ ready: Promise.resolve(), unsubscribe: vi.fn() }),
      },
    } as unknown as GameServices);
    model.update("playing", false, 1000);
    expect(model.queue?.current).toBeNull();
    const connected = model.connect();
    model.update("playing", false, 1000);
    expect(model.queue?.current).toBeNull();
    const rows = new RunAchievements().rows;
    rows[0] = { ...rows[0], unlocked: true };
    resolve(rows);
    await connected;
    model.update("playing", false, 1000);
    expect(model.queue?.current?.id).toBe("run-coins-1000");
    model.dispose();
  });
  it("allows live celebrations after a failed achievement fetch", async () => {
    vi.useFakeTimers();
    const model = new RunAchievements({
      achievements: {
        getPlayerAchievements: async () => {
          throw new Error("Offline");
        },
        onUnlocked: () => ({ ready: Promise.resolve(), unsubscribe: vi.fn() }),
      },
    } as unknown as GameServices);
    await model.connect();
    model.update("playing", false, 500);
    expect(model.queue?.current?.id).toBe("run-coins-500");
    model.dispose();
  });
  it("enables offline milestones when player setup fails before connecting", () => {
    vi.useFakeTimers();
    const model = new RunAchievements({ achievements: {} } as GameServices);
    model.update("playing", false, 500);
    expect(model.queue?.current).toBeNull();
    model.useOffline();
    model.update("playing", false, 500);
    expect(model.queue?.current?.id).toBe("run-coins-500");
    model.dispose();
  });
});
