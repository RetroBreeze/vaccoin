import { afterEach, expect, it, vi } from "vitest";
import type { GameServices, LeaderboardEntry } from "@supagame/sdk-ts";
import { Leaderboard } from "../src/supagame";

const entry: LeaderboardEntry = {
  playerId: "player-1",
  displayName: "Mara",
  score: 800,
  rank: 12,
  achievedAt: "2026-11-10T00:00:00Z",
};
function fixture() {
  const game = {
    players: {
      ensureAnonymousSession: vi.fn(async () => ({ userId: "player-1" })),
      getMe: vi.fn(async () => ({
        playerId: "player-1",
        displayName: "Mara",
        createdAt: entry.achievedAt,
      })),
      updateMe: vi.fn(async ({ displayName }: { displayName: string }) => ({
        playerId: "player-1",
        displayName,
        createdAt: entry.achievedAt,
      })),
    },
    leaderboards: {
      submit: vi.fn(async (_board: string, score: number, _key?: string) => ({
        outcome: "best" as const,
        score,
        bestScore: Math.max(800, score),
      })),
      getTop: vi.fn(async () => ({ entries: [entry], nextCursor: null })),
      getMine: vi.fn(async () => entry as typeof entry | null),
    },
  } satisfies GameServices;
  const board = new Leaderboard(undefined, game);
  return { game, board };
}
const run = { id: "round-1", score: 437, durationMs: 60000 };
afterEach(() => vi.useRealTimers());

it("restores identity and skips an unchanged display name across rounds", async () => {
  const { game, board } = fixture();
  await Promise.all([board.connect("Mara"), board.connect("Mara")]);
  await board.connect("Mara");
  expect(game.players.ensureAnonymousSession).toHaveBeenCalledTimes(1);
  expect(game.players.updateMe).not.toHaveBeenCalled();
  await board.complete(run);
  await board.complete({ ...run, id: "round-2" });
  expect(game.players.ensureAnonymousSession).toHaveBeenCalledTimes(1);
  expect(board.rank).toBe(12);
  expect(board.personalBest).toBe(800);
  expect(board.entries).toEqual([{ rank: 12, name: "Mara", score: 800 }]);
  expect(game.leaderboards.getTop).toHaveBeenCalledWith("vaccoin", {
    limit: 10,
  });
});

it("saves the confirmed name once and retries failed profile updates", async () => {
  const { game, board } = fixture();
  game.players.getMe.mockResolvedValue({
    playerId: "player-1",
    displayName: "Old",
    createdAt: entry.achievedAt,
  });
  game.players.updateMe.mockRejectedValueOnce(new Error("offline"));
  await board.connect("New Player");
  expect(board.status).toContain("UNAVAILABLE");
  await board.connect("New Player");
  await board.connect("New Player");
  expect(game.players.updateMe).toHaveBeenCalledTimes(2);
  expect(game.players.updateMe).toHaveBeenLastCalledWith({
    displayName: "New Player",
  });
});

it("submits the captured final score exactly once per round with a UUID", async () => {
  const { game, board } = fixture();
  await board.connect("Mara");
  await Promise.all([board.complete(run), board.complete(run)]);
  await board.complete(run);
  expect(game.leaderboards.submit).toHaveBeenCalledTimes(1);
  expect(game.leaderboards.submit).toHaveBeenCalledWith(
    "vaccoin",
    437,
    expect.stringMatching(/^[0-9a-f-]{36}$/),
  );
  await expect(board.complete({ ...run, score: 438 })).rejects.toThrow();
});

it("retries uncertain outcomes with the original score, identity and UUID", async () => {
  const { game, board } = fixture();
  await board.connect("Mara");
  game.leaderboards.submit.mockRejectedValueOnce(new Error("response lost"));
  expect((await board.complete(run)).submitted).toBe(false);
  expect(board.canRetry).toBe(true);
  await board.retry();
  expect(game.leaderboards.submit.mock.calls[0]).toEqual(
    game.leaderboards.submit.mock.calls[1],
  );
  expect(board.status).toContain("SUBMITTED");
  expect(board.canRetry).toBe(false);
});

it("keeps a timed-out request in flight so retry cannot duplicate it", async () => {
  vi.useFakeTimers();
  const { game, board } = fixture();
  await board.connect("Mara");
  let resolve!: (value: {
    outcome: "best";
    score: number;
    bestScore: number;
  }) => void;
  game.leaderboards.submit.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const pending = board.complete(run);
  await vi.advanceTimersByTimeAsync(5001);
  expect((await pending).submitted).toBe(false);
  const retry = board.retry();
  expect(game.leaderboards.submit).toHaveBeenCalledTimes(1);
  resolve({ outcome: "best", score: 437, bestScore: 800 });
  await retry;
  expect(board.status).toContain("SUBMITTED");
});

it("retains accepted submission when standings fail and retries reads only", async () => {
  const { game, board } = fixture();
  await board.connect("Mara");
  game.leaderboards.getMine.mockRejectedValueOnce(new Error("offline"));
  expect((await board.complete(run)).submitted).toBe(true);
  expect(board.status).toContain("RANKINGS UNAVAILABLE");
  await board.retry();
  expect(game.leaderboards.submit).toHaveBeenCalledTimes(1);
  expect(board.rank).toBe(12);
});

it("keeps offline scores locally and can reconnect without blocking a round", async () => {
  const { game, board } = fixture();
  game.players.ensureAnonymousSession.mockRejectedValueOnce(
    new Error("auth unavailable"),
  );
  await board.connect("Mara");
  game.players.ensureAnonymousSession.mockRejectedValueOnce(
    new Error("auth unavailable"),
  );
  expect((await board.complete(run)).submitted).toBe(false);
  expect(board.best).toBe(437);
  expect(game.leaderboards.submit).not.toHaveBeenCalled();
  await board.retry();
  expect(game.leaderboards.submit).toHaveBeenCalledTimes(1);
});

it("does not send a pending attempt under a different restored identity", async () => {
  const { game, board } = fixture();
  await board.connect("Mara");
  game.leaderboards.submit.mockRejectedValueOnce(new Error("auth failed"));
  await board.complete(run);
  game.players.ensureAnonymousSession.mockResolvedValue({ userId: "player-2" });
  await board.retry();
  expect(game.leaderboards.submit).toHaveBeenCalledTimes(1);
  expect(board.status).toContain("UNAVAILABLE");
});

it.each([NaN, Infinity, -1, 1.2, Number.MAX_SAFE_INTEGER + 1, 19201])(
  "rejects invalid coin total %s without requests",
  async (score) => {
    const { game, board } = fixture();
    await expect(board.complete({ ...run, score })).rejects.toThrow();
    expect(game.leaderboards.submit).not.toHaveBeenCalled();
  },
);

it("displays an unranked player and fallback names without inventing rankings", async () => {
  const { game, board } = fixture();
  game.leaderboards.getMine.mockResolvedValue(null);
  game.leaderboards.getTop.mockResolvedValue({
    entries: [{ ...entry, displayName: null }],
    nextCursor: null,
  });
  await board.connect("Mara");
  expect(board.rank).toBeNull();
  expect(board.personalBest).toBeNull();
  expect(board.entries[0].name).toBe("ANONYMOUS");
});

it("does not treat repeated completion after failure as an explicit retry", async () => {
  const { game, board } = fixture();
  await board.connect("Mara");
  game.leaderboards.submit.mockRejectedValue(new Error("offline"));
  await board.complete(run);
  await board.complete(run);
  expect(game.leaderboards.submit).toHaveBeenCalledTimes(1);
});

it("does not let late previous-round responses overwrite the latest results", async () => {
  const { game, board } = fixture();
  await board.connect("Mara");
  let reject!: (reason: Error) => void;
  game.leaderboards.submit.mockImplementationOnce(
    () =>
      new Promise((_r, fail) => {
        reject = fail;
      }),
  );
  const previous = board.complete(run);
  await vi.waitFor(() =>
    expect(game.leaderboards.submit).toHaveBeenCalledTimes(1),
  );
  await board.complete({ id: "next-round", score: 912, durationMs: 60000 });
  reject(new Error("previous response lost"));
  await previous;
  expect(board.status).toBe("SCORE SUBMITTED");
  expect(board.canRetry).toBe(false);
});

it("keeps offline completion playable when secure UUIDs are unavailable", async () => {
  vi.stubGlobal("crypto", undefined);
  try {
    const board = new Leaderboard();
    expect((await board.complete(run)).submitted).toBe(false);
    expect(board.best).toBe(437);
  } finally {
    vi.unstubAllGlobals();
  }
});

it("can retry rankings when an accepted submission is followed by a hanging read", async () => {
  vi.useFakeTimers();
  const { game, board } = fixture();
  await board.connect("Mara");
  game.leaderboards.getMine.mockImplementationOnce(() => new Promise(() => {}));
  const completed = board.complete(run);
  await vi.advanceTimersByTimeAsync(5001);
  expect((await completed).submitted).toBe(true);
  const retry = board.retry();
  await vi.advanceTimersByTimeAsync(5001);
  await retry;
  expect(board.status).toBe("SCORE SUBMITTED");
  expect(board.rank).toBe(12);
  expect(game.leaderboards.submit).toHaveBeenCalledTimes(1);
});
