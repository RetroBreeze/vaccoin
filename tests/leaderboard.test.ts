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
it("handles a failed real bridge without claiming submission", async () => {
  const b = new Leaderboard(undefined, {
    connect: async () => {
      throw Error("offline");
    },
    submit: async () => {
      throw Error("offline");
    },
    standings: async () => [],
  });
  await b.connect();
  expect(b.status).toContain("unavailable");
  const r = await b.complete({ id: "a", score: 3, durationMs: 60000 });
  expect(r.submitted).toBe(false);
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
it("accepts the larger physical coin total and rejects impossible scores", async () => {
  const b = new Leaderboard({ getItem: () => null, setItem: () => {} });
  await b.complete({ id: "large-shower", score: 19200, durationMs: 60000 });
  expect(b.best).toBe(19200);
  await expect(
    b.complete({ id: "too-many", score: 19201, durationMs: 60000 }),
  ).rejects.toThrow();
});
