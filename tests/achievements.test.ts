import { describe, it, expect, vi } from "vitest";
import { RunAchievements } from "../src/achievements";
import definitions from "../src/achievement-definitions.json";
import type { GameServices, Achievement } from "@supagame/sdk-ts";
describe("Vaccoin achievements", () => {
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
  it("pauses simultaneous awards in play and displays them FIFO at results", async () => {
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
    expect(model.queue?.current).toBeNull();
    model.update("results");
    expect(model.queue?.current?.id).toBe("run-coins-500");
    await vi.advanceTimersByTimeAsync(4000);
    expect(model.queue?.current?.id).toBe("run-coins-1000");
    model.dispose();
    expect(off).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
