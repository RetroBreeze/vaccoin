import { it, expect, vi } from "vitest";
import { Workshop, type WorkshopRecord } from "../src/workshop";
import { emptyProgress, applyOperation } from "../src/workshop-state";
import {
  ApiError,
  NetworkError,
  SaveConflictError,
  type LocalStore,
  type Saves,
} from "@supagame/sdk-ts";
const cloud = (data = emptyProgress(), revision = 1) => ({
  slot: "vacuum-workshop",
  revision,
  schemaVersion: 1,
  kind: "json" as const,
  data,
  metadata: {},
  sizeBytes: 10,
  deleted: false,
  objectPath: null,
  createdAt: "2026-11-10T00:00:00Z",
  updatedAt: "2026-11-10T00:00:00Z",
});
function fixture() {
  const entries = new Map<string, WorkshopRecord>();
  let player = "one";
  const store: LocalStore<WorkshopRecord> = {
    async read(k) {
      return structuredClone(entries.get(k) ?? null);
    },
    async update(k, fn) {
      const n = fn(structuredClone(entries.get(k) ?? null));
      entries.set(k, structuredClone(n));
      return n;
    },
  };
  let remote = cloud(),
    operationIds = new Map();
  const saves = {
    load: vi.fn(async () => remote),
    save: vi.fn(async (_slot, data, options) => {
      if (operationIds.has(options.operationId))
        return operationIds.get(options.operationId);
      if (options.expectedRevision !== remote.revision)
        throw new SaveConflictError(remote);
      remote = cloud(data, remote.revision + 1);
      operationIds.set(options.operationId, remote);
      return remote;
    }),
  } as unknown as Saves;
  const make = () =>
    new Workshop({
      saves,
      store,
      identity: async () => player,
      namespace: "test",
    });
  return {
    store,
    saves,
    make,
    remote: () => remote,
    setRemote: (r: ReturnType<typeof cloud>) => {
      remote = r;
    },
    switch: () => {
      player = "two";
    },
  };
}
it("hydrates before saving and restores cloud cosmetics", async () => {
  const f = fixture();
  f.setRemote(
    cloud(
      applyOperation(
        applyOperation(emptyProgress(), {
          id: "old",
          type: "run",
          coins: 6000,
        }),
        { id: "buy", type: "purchase", cosmetic: "chrome" },
      ),
    ),
  );
  const w = f.make();
  await w.initialize();
  expect(w.progress.equipped).toBe("chrome");
  expect(f.saves.save).not.toHaveBeenCalled();
});
it("durably stages rewards exactly once across reload and a network outage", async () => {
  const f = fixture(),
    w = f.make();
  await w.initialize();
  vi.mocked(f.saves.save).mockRejectedValue(new NetworkError());
  await w.complete({ id: "run", score: 12000 });
  await w.complete({ id: "run", score: 12000 });
  expect(w.progress.wallet).toBe(12000);
  const reload = f.make();
  await reload.initialize();
  expect(reload.progress.wallet).toBe(12000);
  expect(reload.progress.completedRuns).toBe(1);
});
it("rebases disjoint purchases and rewards on conflict without double charging", async () => {
  const f = fixture();
  f.setRemote(
    cloud(
      applyOperation(emptyProgress(), {
        id: "earn",
        type: "run",
        coins: 12000,
      }),
    ),
  );
  const w = f.make();
  await w.initialize();
  f.setRemote(
    cloud(
      applyOperation(f.remote().data, {
        id: "red",
        type: "purchase",
        cosmetic: "brick-red",
      }),
      2,
    ),
  );
  await w.purchase("chrome");
  await w.sync();
  expect(w.progress.owned).toEqual(["default", "brick-red", "chrome"]);
  expect(w.progress.wallet).toBe(3500);
  expect(f.remote().data.wallet).toBe(3500);
});
it("retains both copies and a locally purchased cosmetic when a conflicting wallet cannot afford replay", async () => {
  const f = fixture();
  f.setRemote(
    cloud(
      applyOperation(emptyProgress(), {
        id: "earn",
        type: "run",
        coins: 12000,
      }),
    ),
  );
  const w = f.make();
  await w.initialize();
  f.setRemote(
    cloud(
      applyOperation(f.remote().data, {
        id: "hazard",
        type: "purchase",
        cosmetic: "hazard",
      }),
      2,
    ),
  );
  await w.purchase("chrome");
  await w.sync();
  expect(w.status).toContain("CONFLICT");
  expect(w.progress.owned).toContain("chrome");
  expect(w.conflict).not.toBeNull();
  expect(f.remote().data.owned).toContain("hazard");
});
it("an API outage keeps durable progression and an account switch cannot upload it", async () => {
  const f = fixture(),
    w = f.make();
  await w.initialize();
  vi.mocked(f.saves.save).mockRejectedValue(
    new ApiError(503, "STORAGE_UNAVAILABLE", "Unavailable"),
  );
  await w.complete({ id: "run", score: 10 });
  expect(w.progress.wallet).toBe(10);
  expect(w.status).not.toContain("OFFLINE");
  f.switch();
  await w.sync();
  expect(w.progress.wallet).toBe(0);
  expect(w.status).toContain("PLAYER CHANGED");
});
it("does not replace remote progress with defaults when a run finishes before hydration", async () => {
  const f = fixture();
  let release!: (value: ReturnType<typeof cloud>) => void;
  vi.mocked(f.saves.load).mockReturnValueOnce(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  const w = f.make(),
    initial = w.initialize();
  await vi.waitFor(() => expect(w.ready).toBe(true));
  const complete = w.complete({ id: "new", score: 100 });
  await vi.waitFor(() => expect(w.progress.wallet).toBe(100));
  f.setRemote(
    cloud(
      applyOperation(emptyProgress(), { id: "old", type: "run", coins: 5000 }),
    ),
  );
  release(f.remote());
  await initial;
  await complete;
  expect(w.progress.wallet).toBe(5100);
  expect(w.progress.completedRuns).toBe(2);
});
