import { afterEach, expect, it, vi } from "vitest";
import {
  AuthenticationError,
  ApiError,
  NetworkError,
  UnexpectedResponseError,
  type GameServices,
  type LeaderboardEntry,
  type LeaderboardPage,
} from "@supagame/sdk-ts";
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
    saves: { prepareAccountSwitch:vi.fn(), pendingAccountSwitch:vi.fn(), inspectAccountSwitch:vi.fn(), resolveAccountSwitch:vi.fn(), getAccountSwitchRecovery:vi.fn(), discardAccountSwitch:vi.fn(), save:vi.fn(), load:vi.fn(), list:vi.fn(), delete:vi.fn(), saveBinary:vi.fn(), loadBinary:vi.fn(), abortBinary:vi.fn(), cleanup:vi.fn() },
    achievements: {
      listAchievements: vi.fn(async () => []),
      getPlayerAchievements: vi.fn(async () => []),
      getAchievement: vi.fn(async () => null),
      onUnlocked: vi.fn(() => ({
        ready: Promise.resolve(),
        unsubscribe: vi.fn(),
      })),
      dispose: vi.fn(),
    },
    players: {
      getAuthStatus:vi.fn(), restoreSession:vi.fn(), linkProvider:vi.fn(), signInWithProvider:vi.fn(), handleAuthCallback:vi.fn(), signOut:vi.fn(), onAuthStateChange:vi.fn(),
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
      subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
      submit: vi.fn(async (_board: string, score: number, _key?: string) => ({
        outcome: "best" as const,
        score,
        bestScore: Math.max(800, score),
      })),
      getTop: vi.fn(async (): Promise<LeaderboardPage> => ({
        entries: [entry],
        nextCursor: null,
      })),
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
  expect(board.status).toContain("PERSONAL BEST UNAVAILABLE");
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

it("submits on insecure origins using secure random bytes and reuses the UUID on retry", async () => {
  const getRandomValues = globalThis.crypto.getRandomValues.bind(
    globalThis.crypto,
  );
  vi.stubGlobal("crypto", { getRandomValues });
  try {
    const { board, game } = fixture();
    await board.connect("Mara");
    game.leaderboards.submit.mockRejectedValueOnce(new NetworkError());
    await board.complete(run);
    await board.retry();
    expect(game.leaderboards.submit).toHaveBeenCalledTimes(2);
    const key = game.leaderboards.submit.mock.calls[0][2];
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(game.leaderboards.submit.mock.calls[1][2]).toBe(key);
    expect(board.status).toBe("SCORE SUBMITTED");
  } finally {
    vi.unstubAllGlobals();
  }
});

it.each([
  [new AuthenticationError(), "AUTHENTICATION ERROR"],
  [new ApiError(429, "RATE_LIMITED", "Slow down"), "API ERROR / RATE_LIMITED"],
  [new UnexpectedResponseError(), "INVALID API RESPONSE"],
  [new NetworkError(), "NETWORK ERROR"],
])(
  "reports a submission failure without calling a successful leaderboard offline: %s",
  async (error, message) => {
    const { board, game } = fixture();
    await board.connect("Mara");
    game.leaderboards.submit.mockRejectedValue(error);
    await board.complete(run);
    expect(board.status).toContain(message);
    expect(board.status).not.toContain("OFFLINE");
    expect(board.entries).toHaveLength(1);
    expect(board.retryLabel).toBe("RETRY SCORE");
  },
);

it("reports actual offline transport failures separately", async () => {
  vi.stubGlobal("navigator", { onLine: false });
  try {
    const { board, game } = fixture();
    await board.connect("Mara");
    game.leaderboards.submit.mockRejectedValue(new NetworkError());
    await board.complete(run);
    expect(board.status).toContain("OFFLINE");
    expect(board.best).toBe(800);
  } finally {
    vi.unstubAllGlobals();
  }
});

it("identifies personal-best failures while retaining successful top-ten reads", async () => {
  const { board, game } = fixture();
  game.leaderboards.getMine.mockRejectedValue(new UnexpectedResponseError());
  await board.connect("Mara");
  expect(board.entries).toHaveLength(1);
  expect(board.status).toContain(
    "PERSONAL BEST UNAVAILABLE / INVALID API RESPONSE",
  );
  expect(board.status).not.toContain("OFFLINE");
  expect(board.retryLabel).toBe("RETRY RANKINGS");
});

it("reports a missing secure generator as a local submission issue with standings still available", async () => {
  vi.stubGlobal("crypto", undefined);
  try {
    const { board, game } = fixture();
    await board.connect("Mara");
    await board.complete(run);
    expect(board.status).toContain("SECURE RANDOMNESS UNAVAILABLE");
    expect(board.status).not.toContain("OFFLINE");
    expect(board.entries).toHaveLength(1);
    expect(game.leaderboards.submit).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});

it("identifies session failures and recovers through deliberate session retry", async () => {
  const { board, game } = fixture();
  game.players.ensureAnonymousSession.mockRejectedValueOnce(
    new AuthenticationError(),
  );
  await board.connect("Mara");
  expect(board.status).toContain(
    "PLAYER SESSION UNAVAILABLE / AUTHENTICATION ERROR",
  );
  expect(board.retryLabel).toBe("RETRY SESSION");
  await board.retry();
  expect(board.status).toContain("GLOBAL");
  expect(board.canRetry).toBe(false);
});

it("keeps personal best when the public leaderboard API fails", async () => {
  const { board, game } = fixture();
  game.leaderboards.getTop.mockRejectedValueOnce(
    new ApiError(503, "UNAVAILABLE", "Try later"),
  );
  await board.connect("Mara");
  expect(board.personalBest).toBe(800);
  expect(board.topStatus).toBe("LEADERBOARD UNAVAILABLE");
  expect(board.status).toContain("API ERROR / UNAVAILABLE");
  expect(board.status).not.toContain("OFFLINE");
  await board.retry();
  expect(board.entries).toHaveLength(1);
  expect(board.canRetry).toBe(false);
});

it("keeps simultaneous read errors readable on the minimum results width", async () => {
  const { textWidth } = await import("../src/pixel-font");
  const { board, game } = fixture();
  await board.connect("Mara");
  game.leaderboards.getTop.mockRejectedValue(new NetworkError());
  game.leaderboards.getMine.mockRejectedValue(new AuthenticationError());
  await board.complete(run);
  expect(board.status).toContain("SCORE SUBMITTED / RANKINGS UNAVAILABLE");
  expect(board.status).toContain("NETWORK ERROR");
  expect(textWidth(board.status, 1)).toBeLessThanOrEqual(500);
  expect(textWidth(board.topStatus, 2)).toBeLessThanOrEqual(500);
});

it("fits a personal-best API error after submission on the minimum results width", async () => {
  const { textWidth } = await import("../src/pixel-font");
  const { board, game } = fixture();
  await board.connect("Mara");
  game.leaderboards.getMine.mockRejectedValue(
    new ApiError(404, "LEADERBOARD_NOT_FOUND", "Missing board"),
  );
  await board.complete(run);
  expect(board.status).toContain("SCORE SUBMITTED / PERSONAL BEST UNAVAILABLE");
  expect(board.status).toContain("LEADERBOARD_NOT_FOUND");
  expect(textWidth(board.status, 1)).toBeLessThanOrEqual(500);
});

it("browses public top ten without creating a player session", async () => {
  const { board, game } = fixture();
  await board.browse("top", false);
  expect(board.browseEntries).toEqual([{ rank: 12, name: "Mara", score: 800 }]);
  expect(game.players.ensureAnonymousSession).not.toHaveBeenCalled();
  expect(game.leaderboards.submit).not.toHaveBeenCalled();
});

it("finds five neighbors on either side across pages, including tied ranks", async () => {
  const { board, game } = fixture();
  const rows = Array.from({ length: 18 }, (_, i) => ({
    ...entry,
    playerId: i === 9 ? entry.playerId : `other-${i}`,
    displayName: `Person ${i + 1}`,
    rank: i >= 6 && i <= 10 ? 7 : i + 1,
  }));
  game.leaderboards.getTop
    .mockResolvedValueOnce({ entries: rows.slice(0, 8), nextCursor: "page2" })
    .mockResolvedValueOnce({ entries: rows.slice(8), nextCursor: null });
  await board.browse("around");
  expect(board.browseEntries.map((e) => e.name)).toEqual([
    "Person 5",
    "Person 6",
    "Person 7",
    "Person 8",
    "Person 9",
    "Person 10",
    "Person 11",
    "Person 12",
    "Person 13",
    "Person 14",
    "Person 15",
  ]);
  expect(board.browseEntries[5].isPlayer).toBe(true);
  expect(game.leaderboards.getTop).toHaveBeenLastCalledWith("vaccoin", {
    limit: 100,
    cursor: "page2",
  });
});

it.each([0, 7])(
  "clips nearby standings at the board boundary (index %s)",
  async (index) => {
    const { board, game } = fixture();
    game.leaderboards.getTop.mockResolvedValue({
      entries: Array.from({ length: 8 }, (_, i) => ({
        ...entry,
        playerId: i === index ? entry.playerId : `other-${i}`,
        rank: i + 1,
      })),
      nextCursor: null,
    });
    await board.browse("around");
    expect(board.browseEntries.map((e) => e.rank)).toEqual(
      index === 0 ? [1, 2, 3, 4, 5, 6] : [3, 4, 5, 6, 7, 8],
    );
  },
);

it("explains an unranked player without scanning scores", async () => {
  const { board, game } = fixture();
  game.leaderboards.getMine.mockResolvedValue(null);
  await board.browse("around");
  expect(board.browseEntries).toEqual([]);
  expect(board.browseStatus).toContain("PLAY A ROUND");
  expect(game.leaderboards.getTop).not.toHaveBeenCalled();
});

it("keeps a late nearby read from replacing a newer top ten view", async () => {
  const { board, game } = fixture();
  let resolve!: (value: typeof entry | null) => void;
  game.leaderboards.getMine.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const around = board.browse("around");
  await vi.waitFor(() => expect(game.leaderboards.getMine).toHaveBeenCalled());
  await board.browse("top");
  resolve(null);
  await around;
  expect(board.browseEntries).toHaveLength(1);
  expect(board.browseMode).toBe("top");
  expect(board.browseStatus).not.toContain("PLAY A ROUND");
});

it("bounds nearby reads and allows retry without accepting late data", async () => {
  vi.useFakeTimers();
  const { board, game } = fixture();
  game.leaderboards.getTop.mockImplementationOnce(() => new Promise(() => {}));
  const pending = board.browse("around");
  await vi.advanceTimersByTimeAsync(5001);
  await pending;
  expect(board.browseLoading).toBe(false);
  expect(board.browseCanRetry).toBe(true);
  expect(board.browseStatus).toContain("TIMED OUT");
  await board.browse("top");
  expect(board.browseEntries).toHaveLength(1);
  expect(board.browseCanRetry).toBe(false);
});
