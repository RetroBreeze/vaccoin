import { it, expect, vi } from "vitest";
import { Accounts } from "../src/accounts";
import { emptyProgress } from "../src/workshop-state";
function setup() {
  const values = new Map<string, string>();
  const game = {
    players: {
      getAuthStatus: vi.fn(async () => ({
        userId: "guest",
        isAnonymous: true,
        providers: [],
      })),
      signInWithProvider: vi.fn(async () => ({
        url: "https://provider.example",
        flowId: "flow",
      })),
      linkProvider: vi.fn(async () => ({
        url: "https://provider.example/link",
        flowId: "link",
      })),
      handleAuthCallback: vi.fn(),
      signOut: vi.fn(),
    },
    saves: {
      prepareAccountSwitch: vi.fn(async () => ({
        id: "transition",
        sourcePlayerId: "guest",
      })),
      inspectAccountSwitch: vi.fn(),
      resolveAccountSwitch: vi.fn(async () => ({ status: "complete" })),
    },
  };
  const workshop = {
    pauseForAccount: vi.fn(),
    prepareAccountSnapshot: vi.fn(async () => ({
      slot: "vacuum-workshop",
      kind: "json",
      data: emptyProgress(),
    })),
    resumeAfterAccount: vi.fn(),
    acceptAccountCloud: vi.fn(),
  };
  const environment = {
    url: () => "https://game.example/",
    navigate: vi.fn(),
    replace: vi.fn(),
    storage: {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => {
        values.set(k, v);
      },
      removeItem: (k: string) => {
        values.delete(k);
      },
    },
  };
  return {
    game,
    workshop,
    environment,
    account: new Accounts(
      game as never,
      workshop as never,
      "project",
      environment,
    ),
  };
}
it("links without staging or replacing identity", async () => {
  const f = setup();
  await f.account.start("link");
  expect(f.game.players.linkProvider).toHaveBeenCalled();
  expect(f.game.players.signInWithProvider).not.toHaveBeenCalled();
  expect(f.game.saves.prepareAccountSwitch).not.toHaveBeenCalled();
});
it("stages pending Workshop before navigating to sign in", async () => {
  const f = setup();
  await f.account.start("signIn");
  expect(f.game.saves.prepareAccountSwitch).toHaveBeenCalledWith({
    local: [expect.objectContaining({ slot: "vacuum-workshop" })],
  });
  expect(f.environment.navigate).toHaveBeenCalledWith(
    "https://provider.example",
  );
});
it("does not navigate when durable preparation fails", async () => {
  const f = setup();
  f.game.saves.prepareAccountSwitch.mockRejectedValue(Error("storage full"));
  await f.account.start("signIn");
  expect(f.environment.navigate).not.toHaveBeenCalled();
  expect(f.account.message).toContain("storage full");
});
it("requires confirmation before replacement and archives local state only after successful resolution", async () => {
  const f = setup();
  f.account.transition = { id: "transition", sourcePlayerId: "guest" };
  f.account.review = { targetPlayerId: "target", slots: [] };
  await f.account.resolve("keepGuest", false);
  expect(f.game.saves.resolveAccountSwitch).not.toHaveBeenCalled();
  await f.account.resolve("keepCloud", true);
  expect(f.workshop.acceptAccountCloud).toHaveBeenCalledOnce();
});
it("resets local best cache across accounts and keeps each account isolated", async () => {
  const { Leaderboard } = await import("../src/supagame");
  const data = new Map<string, string>();
  const board = new Leaderboard({
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
  });
  board.setAccountScope("project:one");
  await board.complete({ id: "one-run", score: 50, durationMs: 60000 });
  board.setAccountScope("project:two");
  expect(board.best).toBe(0);
  board.setAccountScope("project:one");
  expect(board.best).toBe(50);
});
it("can review a newer cloud revision after an import conflict", async () => {
  const f = setup();
  f.environment.storage.setItem(
    "vaccoin.account-flow:project",
    JSON.stringify({ flowId: "flow" }),
  );
  f.account.transition = { id: "transition", sourcePlayerId: "guest" };
  f.game.saves.inspectAccountSwitch.mockResolvedValue({
    targetPlayerId: "target",
    slots: [],
  });
  await f.account.reviewLatest();
  expect(f.game.saves.inspectAccountSwitch).toHaveBeenCalledWith(
    f.account.transition,
    { flowId: "flow", restart: true },
  );
});
