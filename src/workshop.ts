import {
  ApiError,
  GameServicesError,
  NetworkError,
  SaveConflictError,
  createOperationId,
  type Saves,
  type Saved,
  type LocalStore,
  type TransferSave,
} from "@supagame/sdk-ts";
import {
  applyOperation,
  emptyProgress,
  validateProgress,
  type Progress,
  type WorkshopOperation,
} from "./workshop-state";
export const WORKSHOP_SLOT = "vacuum-workshop";
interface PreparedWrite {
  id: string;
  revision: number;
  data: Progress;
  operations: string[];
}
export interface WorkshopRecord {
  base: Saved<Progress> | null;
  snapshot: Progress;
  pending: WorkshopOperation[];
  write?: PreparedWrite;
  conflict?: Saved<Progress> | null;
  archives?: WorkshopRecord[];
}
interface Options {
  saves?: Saves;
  store: LocalStore<WorkshopRecord>;
  identity: () => Promise<string | null>;
  namespace: string;
}
function blank(): WorkshopRecord {
  return { base: null, snapshot: emptyProgress(), pending: [] };
}
async function timed<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("SYNC TIMED OUT")), 8000);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
export class Workshop {
  progress = emptyProgress();
  status = "RESTORING WORKSHOP";
  ready = false;
  owner: string | null = null;
  conflict: Saved<Progress> | null = null;
  private key = "";
  private accountPaused = false;
  private running?: Promise<void>;
  private localReady?: Promise<void>;
  constructor(private options: Options) {}
  private show(state: WorkshopRecord) {
    this.progress = validateProgress(state.snapshot);
    this.conflict = state.conflict ?? null;
  }
  private async current() {
    return (await this.options.store.read(this.key)) ?? blank();
  }
  private async same() {
    const player = await this.options.identity();
    if ((player ?? "local-guest") !== this.owner) {
      this.progress = emptyProgress();
      this.ready = false;
      this.conflict = null;
      this.status = "PLAYER CHANGED / RELOAD";
      return false;
    }
    return true;
  }
  async initialize() {
    this.localReady = (async () => {
      this.owner = (await this.options.identity()) ?? "local-guest";
      this.key = JSON.stringify([
        this.options.namespace,
        this.owner,
        WORKSHOP_SLOT,
      ]);
      const state = await this.current();
      this.show(state);
      this.ready = true;
      this.status = "SAVED ON DEVICE";
    })();
    try {
      await this.localReady;
      await this.recoverRuns();
      await this.sync();
    } catch (error) {
      this.report(error);
    }
  }
  private report(error: unknown) {
    this.status =
      error instanceof NetworkError
        ? "OFFLINE / SAVED ON DEVICE"
        : error instanceof GameServicesError && error.kind === "authentication"
          ? "SIGN IN TO SYNC / LOCAL SAVE SAFE"
          : error instanceof Error && error.message === "NOT ENOUGH COINS"
            ? "SAVE CONFLICT / REVIEW WORKSHOP"
            : error instanceof ApiError
              ? `SYNC PAUSED / ${error.code}`
              : error instanceof Error
                ? error.message
                : "LOCAL SAVE UNAVAILABLE";
  }
  private recoveryKey(id: string) {
    return `vaccoin.workshop.run:${this.options.namespace}:${this.owner}:${id}`;
  }
  private async recoverRuns() {
    if (typeof localStorage === "undefined") return;
    const prefix = this.recoveryKey("");
    for (const key of Object.keys(localStorage).filter((k) =>
      k.startsWith(prefix),
    )) {
      const run = JSON.parse(localStorage.getItem(key)!);
      await this.record(run, false);
      localStorage.removeItem(key);
    }
  }
  private async record(op: WorkshopOperation, sync = true) {
    await this.localReady;
    if (!this.ready || !(await this.same()))
      throw new Error("WORKSHOP NOT READY");
    const state = await this.options.store.update(this.key, (previous) => {
      const s = previous ?? blank();
      const snapshot = applyOperation(s.snapshot, op);
      if (Object.hasOwn(s.snapshot.applied, op.id)) return s;
      return { ...s, snapshot, pending: [...s.pending, op] };
    });
    this.show(state);
    this.status = "SAVED ON DEVICE";
    if (sync) await this.sync();
  }
  async complete(run: { id: string; score: number }, owner = this.owner) {
    // A run belongs to its starting identity. Never transfer rewards on sign-out.
    if (owner !== null && owner !== this.owner) {
      this.status = "RUN KEPT WITH ORIGINAL PLAYER";
      return;
    }
    const op: WorkshopOperation = { id: run.id, type: "run", coins: run.score };
    let recovery = false;
    try {
      if (typeof localStorage !== "undefined" && this.owner) {
        localStorage.setItem(this.recoveryKey(run.id), JSON.stringify(op));
        recovery = true;
      }
    } catch {
      this.status = "DEVICE STORAGE UNAVAILABLE";
    }
    try {
      await this.record(op, false);
      if (recovery) localStorage.removeItem(this.recoveryKey(run.id));
      await this.sync();
    } catch (error) {
      this.report(error);
    }
  }
  async purchase(cosmetic: string) {
    try {
      await this.record({
        id: createOperationId(),
        type: "purchase",
        cosmetic,
      });
    } catch (error) {
      this.report(error);
    }
  }
  async equip(cosmetic: string) {
    try {
      await this.record({ id: createOperationId(), type: "equip", cosmetic });
    } catch (error) {
      this.report(error);
    }
  }
  async mute(muted: boolean) {
    try {
      await this.record({ id: createOperationId(), type: "preference", muted });
    } catch (error) {
      this.report(error);
    }
  }
  async sync() {
    if (this.accountPaused) return;
    if (this.running) return this.running;
    if (!this.ready || !this.options.saves || this.owner === "local-guest") {
      if (this.ready) this.status = "LOCAL WORKSHOP / NO CLOUD SESSION";
      return;
    }
    const saves = this.options.saves;
    this.running = (async () => {
      try {
        if (!(await this.same())) return;
        for (let attempt = 0; attempt < 4; attempt++) {
          let state = await this.current();
          if (!state.write) {
            let remote: Saved<Progress> | null;
            try {
              remote = await timed(saves.load<Progress>(WORKSHOP_SLOT));
              if (remote.schemaVersion !== 1)
                throw new Error("WORKSHOP UPDATE REQUIRED");
              remote.data = validateProgress(remote.data);
            } catch (error) {
              if (error instanceof ApiError && error.code === "SAVE_NOT_FOUND")
                remote = null;
              else throw error;
            }
            if (!(await this.same())) return;
            let replayError: unknown;
            state = await this.options.store.update(this.key, (previous) => {
              const s = previous ?? blank();
              let data = remote?.data ?? emptyProgress();
              try {
                for (const op of s.pending) data = applyOperation(data, op);
              } catch (error) {
                replayError = error;
                return { ...s, conflict: remote };
              }
              const next: WorkshopRecord = {
                ...s,
                base: remote,
                snapshot: data,
              };
              delete next.conflict;
              if (s.pending.length)
                next.write = {
                  id: createOperationId(),
                  revision: remote?.revision ?? 0,
                  data,
                  operations: s.pending.map((o) => o.id),
                };
              return next;
            });
            this.show(state);
            if (replayError) throw replayError;
            if (!state.write) {
              this.status = "CLOUD SAVED";
              return;
            }
          }
          const write = state.write!;
          try {
            const saved = await timed(
              saves.save(WORKSHOP_SLOT, write.data, {
                expectedPlayerId: this.owner!,
                expectedRevision: write.revision,
                operationId: write.id,
                schemaVersion: 1,
                metadata: { game: "vaccoin", profile: "cosmetic-workshop" },
              }),
            );
            if (!(await this.same())) return;
            state = await this.options.store.update(this.key, (previous) => {
              const s = previous ?? blank();
              if (s.write?.id !== write.id) return s;
              const pending = s.pending.filter(
                (op) => !write.operations.includes(op.id),
              );
              let snapshot = write.data;
              for (const op of pending) snapshot = applyOperation(snapshot, op);
              const next: WorkshopRecord = {
                ...s,
                base: { ...saved, data: write.data },
                snapshot,
                pending,
              };
              delete next.write;
              delete next.conflict;
              return next;
            });
            this.show(state);
            this.status = "CLOUD SAVED";
            if (!state.pending.length) return;
          } catch (error) {
            if (!(error instanceof SaveConflictError)) throw error;
            await this.options.store.update(this.key, (previous) => {
              const s = previous ?? blank();
              const next = {
                ...s,
                conflict: error.current as Saved<Progress> | null,
              };
              delete next.write;
              return next;
            });
            // Semantic replay next iteration. No arbitrary JSON merge or discarded op.
          }
        }
        this.status = "SAVE CONFLICT / TRY SYNC AGAIN";
      } catch (error) {
        this.report(error);
      }
    })();
    try {
      await this.running;
    } finally {
      this.running = undefined;
    }
  }
  /** Explicit player choice: archive local progress before selecting cloud state. */
  async useCloud() {
    if (!(await this.same())) return;
    const state = await this.options.store.update(this.key, (previous) => {
      const s = previous ?? blank();
      if (!s.conflict?.data) return s;
      return {
        base: s.conflict,
        snapshot: validateProgress(s.conflict.data),
        pending: [],
        archives: [...(s.archives ?? []), { ...s, archives: [] }],
      };
    });
    this.show(state);
    this.status = "CLOUD SELECTED / LOCAL COPY ARCHIVED";
  }
  async pauseForAccount() {
    this.accountPaused = true;
    await this.running;
  }
  resumeAfterAccount() { this.accountPaused = false; }
  async prepareAccountSnapshot(): Promise<TransferSave> {
    await this.pauseForAccount();
    await this.localReady;
    if (!this.ready || !await this.same()) throw new Error('RESTORE WORKSHOP BEFORE SIGN IN');
    await this.recoverRuns();
    const state = await this.current();
    return {slot: WORKSHOP_SLOT, kind: 'json', data: validateProgress(state.snapshot), schemaVersion: 1, metadata: {game:'vaccoin',profile:'cosmetic-workshop'}};
  }
  /** Discard no pending operations: archive the old local queue before using target cloud. */
  async acceptAccountCloud() {
    await this.pauseForAccount();
    if (!this.options.saves || !await this.same()) throw new Error('RESTORE ACCOUNT FIRST');
    let cloud: Saved<Progress> | null;
    try { cloud = await this.options.saves.load<Progress>(WORKSHOP_SLOT); }
    catch (error) { if (error instanceof ApiError && error.code === 'SAVE_NOT_FOUND') cloud = null; else throw error; }
    if (!await this.same()) throw new Error('ACCOUNT CHANGED');
    const snapshot = cloud && !cloud.deleted ? validateProgress(cloud.data) : emptyProgress();
    const state = await this.options.store.update(this.key, previous => ({base:cloud,snapshot,pending:[],archives:[...(previous?.archives ?? []),{...(previous ?? blank()),archives:[]}]}));
    this.show(state); this.accountPaused = false; this.status = 'CLOUD SAVED / PREVIOUS LOCAL COPY ARCHIVED';
  }
  async exportRecovery() {
    return JSON.stringify(await this.current(), null, 2);
  }
}
