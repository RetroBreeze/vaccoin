import { it, expect, vi } from "vitest";
import { Leaderboard } from "../src/supagame";
import type { GameServices, LiveOptions } from "@supagame/sdk-ts";
it("consumes live snapshots, status, notifications and cleans up exactly once", () => {
  let callbacks: LiveOptions;
  const unsubscribe = vi.fn();
  const subscribe = vi.fn((_id, options) => {
    callbacks = options;
    return { unsubscribe };
  });
  const board = new Leaderboard(undefined, {
    leaderboards: { subscribe },
  } as unknown as GameServices);
  board.startLive();
  board.startLive();
  expect(subscribe).toHaveBeenCalledTimes(1);
  callbacks!.onUpdate({
    entries: [
      {
        playerId: "p",
        displayName: "PIXEL",
        score: 100,
        rank: 1,
        achievedAt: "2026-11-10T00:00:00Z",
      },
    ],
    nextCursor: null,
  });
  expect(board.liveEntries[0].name).toBe("PIXEL");
  callbacks!.onStatus?.("reconnecting");
  expect(board.liveStatus).toBe("RECONNECTING");
  callbacks!.onRankChange?.({
    type: "entered_top",
    boardId: "vaccoin",
    previousRank: 11,
    rank: 10,
    topN: 10,
  });
  expect(board.rankNotice).toContain("TOP 10");
  callbacks!.onError?.(new Error("API failed"));
  expect(board.liveStatus).toBe("REQUEST FAILED");
  board.stopLive();
  board.stopLive();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

it("renames an active player without replacing the live subscription and accepts remote renames", async () => {
  let callbacks: LiveOptions;
  const updateMe = vi.fn(async () => ({}));
  const subscribe = vi.fn((_id, options) => {
    callbacks = options;
    return { unsubscribe: vi.fn() };
  });
  const board = new Leaderboard(undefined, {
    players: {
      ensureAnonymousSession: async () => ({ userId: "p" }),
      getMe: async () => ({ displayName: "OLD" }),
      updateMe,
    },
    leaderboards: { subscribe },
  } as unknown as GameServices);
  await board.prepareLive();
  callbacks!.onUpdate({
    entries: [
      {
        playerId: "p",
        displayName: "OLD",
        score: 100,
        rank: 1,
        achievedAt: "2026-11-10T00:00:00Z",
      },
    ],
    nextCursor: null,
  });
  await board.rename("NEW");
  expect(updateMe).toHaveBeenCalledWith({ displayName: "NEW" });
  expect(board.liveEntries[0].name).toBe("NEW");
  expect(subscribe).toHaveBeenCalledTimes(1);
  callbacks!.onUpdate({
    entries: [
      {
        playerId: "p",
        displayName: "REMOTE",
        score: 100,
        rank: 1,
        achievedAt: "2026-11-10T00:00:00Z",
      },
    ],
    nextCursor: null,
  });
  expect(board.liveEntries[0].name).toBe("REMOTE");
});

it("retains the previous name and standings when rename fails", async () => {
  const board = new Leaderboard(undefined, {
    players: {
      ensureAnonymousSession: async () => ({ userId: "p" }),
      getMe: async () => ({ displayName: "OLD" }),
      updateMe: async () => {
        throw Error("offline");
      },
    },
  } as unknown as GameServices);
  board.name = "OLD";
  board.liveEntries = [{ name: "OLD", rank: 1, score: 100, isPlayer: true }];
  await expect(board.rename("NEW")).rejects.toThrow("offline");
  expect(board.name).toBe("OLD");
  expect(board.liveEntries[0].name).toBe("OLD");
});

it("times out a rename waiting on an unfinished initial profile request", async () => {
  vi.useFakeTimers();
  try {
    const board = new Leaderboard(undefined, {
      players: { ensureAnonymousSession: () => new Promise(() => {}) },
    } as unknown as GameServices);
    const connecting = board.connect("OLD");
    await vi.advanceTimersByTimeAsync(5000);
    await connecting;
    const rename = board.rename("NEW");
    const check = expect(rename).rejects.toThrow("timeout");
    await vi.advanceTimersByTimeAsync(5000);
    await check;
    expect(board.name).toBe("OLD");
  } finally {
    vi.useRealTimers();
  }
});
