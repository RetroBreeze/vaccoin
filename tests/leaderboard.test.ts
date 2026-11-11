import { TOTAL_POINTS } from "../src/coin-counts";
import { expect, it } from "vitest";
import { Leaderboard } from "../src/supagame";
it("keeps best only, never fabricates online standings", async () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
  const b = new Leaderboard(storage);
  expect(
    (await b.complete({ id: "a", score: 500, durationMs: 60000 })).submitted,
  ).toBe(false);
  await b.complete({ id: "b", score: 300, durationMs: 60000 });
  expect(b.best).toBe(500);
  expect(b.entries).toEqual([]);
  expect(new Leaderboard(storage).best).toBe(500);
});
it("survives storage failure and rejects incomplete or invalid rounds", async () => {
  const b = new Leaderboard({
    getItem: () => {
      throw Error();
    },
    setItem: () => {
      throw Error();
    },
  });
  await b.complete({ id: "x", score: 123, durationMs: 60000 });
  expect(b.best).toBe(123);
  await expect(
    b.complete({ id: "x", score: 140, durationMs: 59000 }),
  ).rejects.toThrow();
  await expect(
    b.complete({ id: "x", score: 1.2, durationMs: 60000 }),
  ).rejects.toThrow();
});
it("reports session-only best when storage writes fail", async () => {
  const b = new Leaderboard({
    getItem: () => null,
    setItem: () => {
      throw Error("blocked");
    },
  });
  await b.complete({ id: "a", score: 500, durationMs: 60000 });
  expect(b.persisted).toBe(false);
});
it("accepts the weighted treasure total and rejects impossible scores", async () => {
  const b = new Leaderboard({ getItem: () => null, setItem: () => {} });
  await b.complete({ id: "large-shower", score: TOTAL_POINTS, durationMs: 60000 });
  expect(b.best).toBe(TOTAL_POINTS);
  await expect(
    b.complete({ id: "too-many", score: (TOTAL_POINTS + 1), durationMs: 60000 }),
  ).rejects.toThrow();
});
