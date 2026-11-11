import { expect, it, vi } from "vitest";
import {
  ApiError,
  NetworkError,
  SaveConflictError,
  type Saves,
  type LocalStore,
} from "@supagame/sdk-ts";
import { Workshop, WORKSHOP_SLOT, type WorkshopRecord } from "../src/workshop";

function fixture() {
  const slots = new Map<string, any>();
  const receipts = new Map<string, any>();
  let offline = false;
  let loseDeleteResponse = false;
  const saved = (
    slot: string,
    data: unknown,
    revision: number,
    deleted = false,
  ) => ({
    slot,
    data,
    revision,
    deleted,
    schemaVersion: 1,
    kind: "json",
    metadata: {},
    sizeBytes: 1,
    objectPath: null,
    createdAt: "",
    updatedAt: "",
  });
  const saves = {
    load: vi.fn(async (slot: string) => {
      if (offline) throw new NetworkError();
      const s = slots.get(slot);
      if (!s || s.deleted) throw new ApiError(404, "SAVE_NOT_FOUND", "missing");
      return structuredClone(s);
    }),
    save: vi.fn(async (slot: string, data: unknown, o: any) =>
      mutate(slot, data, o, false),
    ),
    delete: vi.fn(async (slot: string, o: any) => {
      const result = mutate(slot, null, o, true);
      if (loseDeleteResponse) {
        loseDeleteResponse = false;
        throw new NetworkError();
      }
      return result;
    }),
  } as unknown as Saves;
  function mutate(slot: string, data: unknown, o: any, deleted: boolean) {
    if (offline) throw new NetworkError();
    if (receipts.has(o.operationId)) return receipts.get(o.operationId);
    const old = slots.get(slot);
    if ((old?.revision ?? 0) !== o.expectedRevision)
      throw new SaveConflictError(old ?? null);
    if (deleted && (!old || old.deleted))
      throw new ApiError(404, "SAVE_NOT_FOUND", "missing");
    const s = {
      ...saved(slot, data, (old?.revision ?? 0) + 1, deleted),
      metadata: o.metadata ?? {},
    };
    slots.set(slot, s);
    receipts.set(o.operationId, s);
    return structuredClone(s);
  }
  function device() {
    const entries = new Map<string, WorkshopRecord>();
    const store: LocalStore<WorkshopRecord> = {
      async read(k) {
        return structuredClone(entries.get(k) ?? null);
      },
      async update(k, fn) {
        const s = fn(structuredClone(entries.get(k) ?? null));
        entries.set(k, structuredClone(s));
        return s;
      },
    };
    const make = () =>
      new Workshop({
        saves,
        store,
        namespace: "test",
        identity: async () => "authenticated-player",
      });
    return { make, entries };
  }
  return {
    device,
    slots,
    saves,
    offline: (v: boolean) => (offline = v),
    loseResponse: () => (loseDeleteResponse = true),
  };
}
it("deletes gameplay, stays empty through reload/autosync, and starts fresh explicitly", async () => {
  const f = fixture(),
    d = f.device(),
    w = d.make();
  await w.initialize();
  await w.complete({ id: "old", score: 6000 });
  await w.purchase("chrome");
  await w.deleteCloudSave();
  expect(f.slots.get(WORKSHOP_SLOT).deleted).toBe(true);
  expect(w.progress.wallet).toBe(0);
  expect(w.progress.owned).toEqual(["default"]);
  const reload = d.make();
  await reload.initialize();
  await reload.complete({ id: "stale-run", score: 900 });
  await reload.sync();
  expect(f.slots.get(WORKSHOP_SLOT).deleted).toBe(true);
  await reload.startFresh();
  await reload.complete({ id: "new", score: 25 });
  expect(f.slots.get(WORKSHOP_SLOT).data.wallet).toBe(25);
});
it("discards a second authenticated device queue after deletion and fresh progress", async () => {
  const f = fixture(),
    a = f.device().make(),
    b = f.device().make();
  await a.initialize();
  await a.complete({ id: "old", score: 100 });
  await b.initialize();
  f.offline(true);
  await b.complete({ id: "offline-run", score: 900 });
  f.offline(false);
  await a.deleteCloudSave();
  await a.startFresh();
  await a.complete({ id: "new", score: 30 });
  await b.sync();
  expect(b.progress.wallet).toBe(0);
  expect(f.slots.get(WORKSHOP_SLOT).data.wallet).toBe(30);
  await b.startFresh();
  expect(b.progress.wallet).toBe(30);
});
it("persists an offline deletion intent and retries a lost delete response after reload", async () => {
  const f = fixture(),
    d = f.device(),
    w = d.make();
  await w.initialize();
  await w.complete({ id: "old", score: 100 });
  f.offline(true);
  await expect(w.deleteCloudSave()).rejects.toThrow();
  const reload = d.make();
  await reload.initialize();
  await reload.complete({ id: "bad", score: 1000 });
  f.offline(false);
  f.loseResponse();
  await expect(reload.deleteCloudSave()).rejects.toThrow();
  const retry = d.make();
  await retry.initialize();
  await retry.deleteCloudSave();
  expect(f.slots.get(WORKSHOP_SLOT).deleted).toBe(true);
  expect(retry.progress.wallet).toBe(0);
  const calls = vi.mocked(f.saves.delete).mock.calls;
  expect(calls.at(-1)?.[1]?.operationId).toBe(calls.at(-2)?.[1]?.operationId);
});
it("rejects stale replay when deletion happens between marker check and gameplay load", async () => {
  const f = fixture(),
    a = f.device().make(),
    b = f.device().make();
  await a.initialize();
  await a.complete({ id: "old", score: 100 });
  await b.initialize();
  f.offline(true);
  await b.complete({ id: "offline", score: 900 });
  f.offline(false);
  // Remove the prepared write via a CAS conflict, so replay must load cloud again.
  await a.complete({ id: "advance", score: 1 });
  const original = vi.mocked(f.saves.load).getMockImplementation()!;
  let entered!: () => void, release!: () => void;
  const waiting = new Promise<void>((resolve) => (entered = resolve));
  const gate = new Promise<void>((resolve) => (release = resolve));
  let once = true;
  vi.mocked(f.saves.load).mockImplementation(async (slot: string) => {
    if (slot === WORKSHOP_SLOT && once) {
      once = false;
      entered();
      await gate;
    }
    return original(slot);
  });
  const sync = b.sync();
  await waiting;
  await a.deleteCloudSave();
  await a.startFresh();
  await a.complete({ id: "fresh", score: 30 });
  release();
  await sync;
  expect(f.slots.get(WORKSHOP_SLOT).data.wallet).toBe(30);
  expect(b.ready).toBe(false);
});
it("does not accept an old round reward after explicit fresh start", async () => {
  const f = fixture(),
    w = f.device().make();
  await w.initialize();
  const generation = w.generation;
  await w.complete({ id: "old", score: 1 });
  await w.deleteCloudSave();
  await w.startFresh();
  await w.complete({ id: "old-round", score: 900 }, w.owner, generation);
  expect(f.slots.get(WORKSHOP_SLOT).deleted).toBe(true);
});
it("does not silently restore an old historical payload into fresh progress", async () => {
  const f = fixture(),
    w = f.device().make();
  await w.initialize();
  await w.complete({ id: "old", score: 100 });
  const backup = structuredClone(f.slots.get(WORKSHOP_SLOT));
  await w.deleteCloudSave();
  await w.startFresh();
  f.slots.set(WORKSHOP_SLOT, {
    ...backup,
    revision: f.slots.get(WORKSHOP_SLOT).revision + 1,
  });
  await w.sync();
  expect(w.progress.wallet).toBe(0);
  expect(w.status).toContain("RESTORED CLOUD SAVE");
});
it("rejects start fresh once reset is acknowledged, preserving new offline earnings", async () => {
  const f = fixture(),
    w = f.device().make();
  await w.initialize();
  await w.deleteCloudSave();
  await w.startFresh();
  f.offline(true);
  await w.complete({ id: "fresh-offline", score: 75 });
  f.offline(false);
  await expect(w.startFresh()).rejects.toThrow("ALREADY ACTIVE");
  await w.sync();
  expect(f.slots.get(WORKSHOP_SLOT).data.wallet).toBe(75);
});
it('persists confirmed deletion before waiting for an in-flight upload', async () => {
  const f = fixture(), d = f.device(), w = d.make(); await w.initialize();
  let release!: () => void, entered!: () => void;
  const waiting = new Promise<void>(resolve => entered = resolve);
  const gate = new Promise<void>(resolve => release = resolve);
  const original = vi.mocked(f.saves.save).getMockImplementation()!;
  vi.mocked(f.saves.save).mockImplementationOnce(async (...args) => {entered(); await gate; return original(...args);});
  const run = w.complete({id:'in-flight',score:50}); await waiting;
  const deletion = w.deleteCloudSave();
  await vi.waitFor(() => expect([...d.entries.values()][0].deletion).toBeDefined());
  const reload = d.make(); await reload.initialize(); expect(reload.ready).toBe(false);
  release(); await run; await deletion;
  expect(f.slots.get(WORKSHOP_SLOT).deleted).toBe(true);
});
it('finishes account cloud selection while retaining the reset acknowledgement requirement', async () => {
  const f = fixture(), a = f.device().make(); await a.initialize(); await a.deleteCloudSave();
  const b = f.device().make(); await b.initialize(); await b.acceptAccountCloud();
  expect(b.ready).toBe(false); await b.startFresh(); expect(b.ready).toBe(true);
});
it('recovers the losing device after concurrent confirmed deletions', async () => {
  const f = fixture(), a = f.device().make(), b = f.device().make();
  await a.initialize(); await a.complete({id:'old',score:10}); await b.initialize();
  const results = await Promise.allSettled([a.deleteCloudSave(), b.deleteCloudSave()]);
  expect(results.some(result => result.status === 'fulfilled')).toBe(true);
  const loser = results[0].status === 'rejected' ? a : b;
  await loser.sync(); await loser.startFresh();
  expect(loser.ready).toBe(true);
});
it('fences a delayed first upload even when the deleted slot never existed', async () => {
  const f = fixture(), a = f.device().make(), b = f.device().make();
  await a.initialize(); await b.initialize();
  const original = vi.mocked(f.saves.save).getMockImplementation()!;
  let release!: () => void, entered!: () => void;
  const waiting = new Promise<void>(resolve => entered = resolve);
  const gate = new Promise<void>(resolve => release = resolve);
  vi.mocked(f.saves.save).mockImplementationOnce(async (...args) => {entered(); await gate; return original(...args);});
  const pending = b.complete({id:'stale-first',score:1000}); await waiting;
  await a.deleteCloudSave();
  expect(f.slots.get(WORKSHOP_SLOT).deleted).toBe(true);
  release(); await pending;
  expect(f.slots.get(WORKSHOP_SLOT).deleted).toBe(true);
});
it('keeps the reset generation after explicitly accepting account cloud progress', async () => {
  const f = fixture(), a = f.device().make(); await a.initialize(); await a.deleteCloudSave(); await a.startFresh();
  await a.complete({id:'fresh',score:10});
  const b = f.device().make(); await b.initialize(); await b.acceptAccountCloud();
  await b.complete({id:'another',score:20}); expect(f.slots.get(WORKSHOP_SLOT).data.wallet).toBe(30);
});
it('does not retag fresh progress when reset changes during account selection', async () => {
  const f = fixture(), a = f.device().make(), b = f.device().make();
  await a.initialize(); await a.deleteCloudSave(); await a.startFresh(); await a.complete({id:'first',score:1});
  await b.initialize(); await b.startFresh();
  const original = vi.mocked(f.saves.load).getMockImplementation()!;
  let entered!: () => void, release!: () => void;
  const waiting = new Promise<void>(resolve => entered = resolve), gate = new Promise<void>(resolve => release = resolve);
  let once = true;
  vi.mocked(f.saves.load).mockImplementation(async slot => {
    if (slot === WORKSHOP_SLOT && once) {once=false; entered(); await gate;}
    return original(slot);
  });
  const selection = b.acceptAccountCloud();
  const rejected = expect(selection).rejects.toThrow('RESET CHANGED');
  await waiting; await a.deleteCloudSave(); await a.startFresh(); await a.complete({id:'second',score:2});
  const fresh = structuredClone(f.slots.get(WORKSHOP_SLOT));
  release(); await rejected;
  expect(f.slots.get(WORKSHOP_SLOT)).toEqual(fresh);
});
for (const phase of ['deleting', 'ready']) {
  it(`retries a lost ${phase} marker response after reload`, async () => {
    const f = fixture(), d = f.device(), w = d.make(); await w.initialize(); await w.complete({id:'old',score:5});
    const original = vi.mocked(f.saves.save).getMockImplementation()!;
    let once = true;
    vi.mocked(f.saves.save).mockImplementation(async (...args) => {
      const result = await original(...args);
      if (once && (args[1] as {phase?:string}).phase === phase) {once=false; throw new NetworkError();}
      return result;
    });
    await expect(w.deleteCloudSave()).rejects.toThrow();
    const reload = d.make(); await reload.initialize(); expect(reload.ready).toBe(false);
    await reload.deleteCloudSave(); expect(f.slots.get(WORKSHOP_SLOT).deleted).toBe(true);
    await reload.startFresh(); await reload.complete({id:'new',score:1});
    expect(f.slots.get(WORKSHOP_SLOT).data.wallet).toBe(1);
  });
}
