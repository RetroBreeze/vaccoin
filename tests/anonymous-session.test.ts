import { expect, it, vi, afterEach } from "vitest";
import { createGameServices, type GameServicesOptions } from "@supagame/sdk-ts";
import { Leaderboard } from "../src/supagame";
import { configuredGameServices } from "../src/game-services";

const id = "11111111-1111-4111-8111-111111111111";
function fixture(existing = false) {
  const session = {
    access_token: "test-token",
    expires_at: Date.now() / 1000 + 3600,
    user: { id },
  };
  let saved = existing ? session : null;
  const auth = {
    getSession: vi.fn(async () => ({
      data: { session: saved },
      error: null as Error | null,
    })),
    getUser: vi.fn(async () => ({
      data: { user: { id } },
      error: null as Error | null,
    })),
    signInAnonymously: vi.fn(async () => {
      saved = session;
      return { data: { session, user: { id } }, error: null };
    }),
    signOut: vi.fn(),
  };
  let displayName: string | null = null;
  const invoke = vi.fn(
    async (
      path: string,
      options: { method: string; body?: { displayName: string } },
    ) => {
      let data: unknown;
      if (path.endsWith("/players/me")) {
        if (options.body) displayName = options.body.displayName;
        data = { playerId: id, displayName, createdAt: "2026-11-10T00:00:00Z" };
      } else if (path.includes("/entries"))
        data = { entries: [], nextCursor: null };
      else data = null;
      return {
        data,
        error: null,
        response: new Response(JSON.stringify(data), {
          headers: { "content-type": "application/json" },
        }),
      };
    },
  );
  const supabase = {
    auth,
    functions: { invoke },
  } as unknown as GameServicesOptions["supabase"];
  return { auth, invoke, game: createGameServices({ supabase }) };
}
afterEach(() => vi.unstubAllEnvs());
it("initialises anonymous auth through the installed SDK and persists the confirmed profile", async () => {
  const { auth, invoke, game } = fixture();
  const first = new Leaderboard(undefined, game);
  await first.connect("Mara");
  expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  const returning = new Leaderboard(undefined, game);
  await returning.connect("Mara");
  expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  expect(auth.getUser).toHaveBeenCalled();
  expect(
    invoke.mock.calls.filter(([, options]) => options.method === "PATCH"),
  ).toHaveLength(1);
  expect(returning.status).toContain("GLOBAL");
  expect(auth.signOut).not.toHaveBeenCalled();
});
it.each(["session", "user"])(
  "never replaces an identity after a %s auth failure",
  async (failure) => {
    const { auth, game } = fixture(true);
    if (failure === "session")
      auth.getSession.mockResolvedValue({
        data: { session: null },
        error: Error("auth failed"),
      });
    else
      auth.getUser.mockResolvedValue({
        data: { user: { id } },
        error: Error("identity rejected"),
      });
    const board = new Leaderboard(undefined, game);
    await board.connect("Mara");
    expect(board.status).toContain("UNAVAILABLE");
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
  },
);
it("allows offline play when client config is missing or invalid", () => {
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
  expect(configuredGameServices()).toBeUndefined();
  vi.stubEnv("VITE_SUPABASE_URL", "invalid-url");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  expect(configuredGameServices()).toBeUndefined();
});
