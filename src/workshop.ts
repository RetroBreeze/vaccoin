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
export const RESET_SLOT = "vacuum-workshop-reset";
interface ResetMarker {
  token: string;
  phase: "deleting" | "ready";
  revision: number;
}
interface DeletionIntent {
  token: string;
  markerRevision?: number;
  published?: number;
  deleteRevision?: number;
  deletedRevision?: number;
}

interface PreparedWrite {
  id: string;
  revision: number;
  data: Progress;
  operations: string[];
}
export interface WorkshopRecord {
  resetToken?: string;
  resetBlocked?: boolean;
  deletion?: DeletionIntent;
  deletionOperations?: Record<string, string>;
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
  generation = "legacy";
  progress = emptyProgress();
  status = "RESTORING SHOP";
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
      this.generation = state.resetToken ?? state.deletion?.token ?? "legacy";
      this.ready = !state.resetBlocked && !state.deletion;
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
            ? "SAVE CONFLICT / REVIEW SHOP"
            : error instanceof ApiError
              ? `SYNC PAUSED / ${error.code}`
              : error instanceof Error
                ? error.message
                : "LOCAL SAVE UNAVAILABLE";
  }
  private recoveryKey(id: string) {
    return `vaccoin.workshop.run:${this.options.namespace}:${this.owner}:${id}`;
  }
  private clearRecovery() {
    if (typeof localStorage === "undefined") return;
    for (const key of Object.keys(localStorage))
      if (key.startsWith(this.recoveryKey(""))) localStorage.removeItem(key);
  }
  private async recoverRuns() {
    if (!this.ready) {
      this.clearRecovery();
      return;
    }
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
      throw new Error("SHOP NOT READY");
    const state = await this.options.store.update(this.key, (previous) => {
      const s = previous ?? blank();
      if (s.deletion || s.resetBlocked)
        throw new Error("START FRESH IN ACCOUNT SETTINGS");
      const snapshot = applyOperation(s.snapshot, op);
      if (Object.hasOwn(s.snapshot.applied, op.id)) return s;
      return { ...s, snapshot, pending: [...s.pending, op] };
    });
    this.show(state);
    this.status = "SAVED ON DEVICE";
    if (sync) await this.sync();
  }
  async complete(
    run: { id: string; score: number },
    owner = this.owner,
    generation = this.generation,
  ) {
    // A run belongs to its starting identity. Never transfer rewards on sign-out.
    if (owner !== null && owner !== this.owner) {
      this.status = "RUN KEPT WITH ORIGINAL PLAYER";
      return;
    }
    if (!this.ready || generation !== this.generation) return;
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
    if (this.accountPaused || !this.owner) return;
    if (this.running) return this.running;
    if (!this.options.saves || this.owner === "local-guest") {
      if (this.ready) this.status = "LOCAL SHOP / NO CLOUD SESSION";
      return;
    }
    const saves = this.options.saves;
    this.running = (async () => {
      try {
        if (!(await this.same())) return;
        for (let attempt = 0; attempt < 4; attempt++) {
          if (!(await this.checkReset())) return;
          let state = await this.current();
          if (!state.write) {
            let remote: Saved<Progress> | null;
            try {
              remote = await timed(saves.load<Progress>(WORKSHOP_SLOT));
              if (remote.schemaVersion !== 1)
                throw new Error("SHOP UPDATE REQUIRED");
              remote.data = validateProgress(remote.data);
              if (
                (remote.metadata?.resetToken ?? undefined) !== state.resetToken
              ) {
                if (!(await this.checkReset())) return;
                throw new Error(
                  "RESTORED CLOUD SAVE / DELETE AGAIN TO START FRESH",
                );
              }
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
                base: remote ?? (s.base?.deleted ? s.base : null),
                snapshot: data,
              };
              delete next.conflict;
              if (s.pending.length)
                next.write = {
                  id: createOperationId(),
                  revision: remote?.revision ?? s.base?.revision ?? 0,
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
                metadata: {
                  game: "vaccoin",
                  profile: "cosmetic-workshop",
                  ...(state.resetToken ? { resetToken: state.resetToken } : {}),
                },
              }),
            );
            if (!(await this.same())) return;
            state = await this.options.store.update(this.key, (previous) => {
              const s = previous ?? blank();
              if (s.deletion || s.resetBlocked || s.write?.id !== write.id)
                return s;
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
  private async resetMarker(): Promise<
    (Saved<ResetMarker> & { data: ResetMarker }) | null
  > {
    try {
      const marker = await timed(
        this.options.saves!.load<ResetMarker>(RESET_SLOT),
      );
      if (
        typeof marker.data?.token !== "string" ||
        !["deleting", "ready"].includes(marker.data.phase) ||
        !Number.isSafeInteger(marker.data.revision)
      )
        throw new Error("INVALID RESET MARKER / SYNC PAUSED");
      return marker as Saved<ResetMarker> & { data: ResetMarker };
    } catch (error) {
      if (error instanceof ApiError && error.code === "SAVE_NOT_FOUND")
        return null;
      throw error;
    }
  }
  private async checkReset() {
    const state = await this.current();
    if (state.deletion) {
      this.ready = false;
      this.status = "DELETION UNCONFIRMED / RETRY IN ACCOUNT";
      return false;
    }
    const marker = await this.resetMarker();
    if (!(await this.same())) return false;
    if (
      marker &&
      (marker.data.token !== state.resetToken ||
        marker.data.phase === "deleting")
    ) {
      await this.options.store.update(this.key, (current) =>
        current?.deletion
          ? current
          : {
              ...blank(),
              resetToken: marker.data.token,
              resetBlocked: true,
              base: {
                ...marker,
                slot: WORKSHOP_SLOT,
                revision: marker.data.revision,
                deleted: true,
                data: emptyProgress(),
              },
            },
      );
      this.clearRecovery();
      this.generation = marker.data.token;
      this.progress = emptyProgress();
      this.conflict = null;
      this.ready = false;
    }
    const current = await this.current();
    if (current.resetBlocked || current.deletion) {
      this.ready = false;
      this.status =
        marker?.data.phase === "deleting"
          ? "CLOUD DELETION IN PROGRESS / RETRY ON ORIGINAL DEVICE"
          : "CLOUD SAVE DELETED / START FRESH IN ACCOUNT";
      return false;
    }
    this.ready = true;
    return true;
  }
  /** Explicit confirmation is supplied by AccountUI. Intent survives reload/offline. */
  async deleteCloudSave() {
    if (
      !this.options.saves ||
      !(await this.same()) ||
      this.owner === "local-guest"
    )
      throw new Error("SIGN IN BEFORE DELETING CLOUD SAVE");
    this.accountPaused = true;
    this.ready = false;
    await this.localReady;
    const saves = this.options.saves;
    let state = await this.options.store.update(this.key, (previous) => ({
      ...(previous ?? blank()),
      deletion: previous?.deletion ?? { token: createOperationId() },
    }));
    this.clearRecovery();
    const intent = state.deletion!;
    this.generation = intent.token;
    await this.running;
    const persist = async () => {
      if (!(await this.same()))
        throw new Error("ACCOUNT CHANGED / DELETION PAUSED");
      state = await this.options.store.update(this.key, (previous) => ({
        ...(previous ?? blank()),
        deletion: { ...intent },
      }));
    };
    const settings = (operationId: string, expectedRevision: number) => ({
      operationId,
      expectedRevision,
      expectedPlayerId: this.owner!,
      backupExisting: false,
    });
    try {
      if (intent.markerRevision === undefined) {
        const old = await this.resetMarker();
        if (old?.data.phase === "deleting" && old.data.token !== intent.token)
          throw new Error("DELETION IN PROGRESS ON ANOTHER DEVICE");
        intent.markerRevision = old?.revision ?? 0;
        await persist();
      }
      if (intent.published === undefined) {
        let marker;
        try {
          marker = await timed(
            saves.save(
              RESET_SLOT,
              { token: intent.token, phase: "deleting", revision: 0 },
              settings(intent.token, intent.markerRevision),
            ),
          );
        } catch (error) {
          if (error instanceof SaveConflictError) {
            // No mutation committed for this intent: another reset won the CAS.
            await this.options.store.update(this.key, () => ({
              ...blank(),
              resetBlocked: true,
            }));
          }
          throw error;
        }
        intent.published = marker.revision;
        await persist();
      }
      for (let attempt = 0; intent.deletedRevision === undefined && attempt < 3; attempt++) {
        if (intent.deleteRevision === undefined) {
          try {
            intent.deleteRevision = (await timed(saves.load(WORKSHOP_SLOT))).revision;
          } catch (error) {
            if (!(error instanceof ApiError && error.code === "SAVE_NOT_FOUND"))
              throw error;
            // A delete with revision zero discovers an existing tombstone via CAS.
            intent.deleteRevision = 0;
          }
          await persist();
        }
        // Separate stable UUIDs are derived once and stored by revision in intent.
        const deletionId = await this.deletionOperation(
          "delete",
          intent.deleteRevision!,
        );
        try {
          const deleted = await timed(
            saves.delete(
              WORKSHOP_SLOT,
              settings(deletionId, intent.deleteRevision!),
            ),
          );
          intent.deletedRevision = deleted.revision;
        } catch (error) {
          if (error instanceof SaveConflictError && error.current?.deleted) {
            intent.deletedRevision = error.current.revision;
          } else if (
            error instanceof ApiError &&
            error.code === "SAVE_NOT_FOUND"
          ) {
            // Missing slots have no tombstone. Fence delayed first uploads by
            // creating an empty revision, then deleting that revision.
            const seedId = await this.deletionOperation("fence", intent.deleteRevision!);
            try {
              const seed = await timed(saves.save(WORKSHOP_SLOT, emptyProgress(), {
                ...settings(seedId, intent.deleteRevision!),
                metadata: {resetToken: intent.token},
              }));
              intent.deleteRevision = seed.revision;
            } catch (seedError) {
              if (!(seedError instanceof SaveConflictError)) throw seedError;
              if (seedError.current?.deleted) intent.deletedRevision = seedError.current.revision;
              else intent.deleteRevision = seedError.current?.revision ?? 0;
            }
          } else if (error instanceof SaveConflictError) {
            intent.deleteRevision = error.current?.revision ?? 0;
            await persist();
            throw new Error("SAVE CHANGED / RETRY DELETE CLOUD SAVE");
          } else throw error;
        }
        await persist();
      }
      if (intent.deletedRevision === undefined) throw new Error("SAVE CHANGED / RETRY DELETE CLOUD SAVE");
      const finishId = await this.deletionOperation(
        "finish",
        intent.published!,
      );
      await timed(
        saves.save(
          RESET_SLOT,
          {
            token: intent.token,
            phase: "ready",
            revision: intent.deletedRevision,
          },
          settings(finishId, intent.published!),
        ),
      );
      if (!(await this.same())) throw new Error("ACCOUNT CHANGED / RELOAD");
      await this.options.store.update(this.key, () => ({
        ...blank(),
        resetToken: intent.token,
        resetBlocked: true,
      }));
      this.clearRecovery();
      this.progress = emptyProgress();
      this.conflict = null;
      this.status = "CLOUD SAVE DELETED / HISTORY MAY REMAIN / START FRESH";
    } catch (error) {
      this.status = "DELETION UNCONFIRMED / UPLOADS PAUSED / RETRY DELETE";
      throw error;
    } finally {
      this.accountPaused = false;
    }
  }
  private async deletionOperation(phase: string, revision: number) {
    const state = await this.options.store.update(this.key, (previous) => {
      if (!previous?.deletion) throw new Error("DELETION INTENT MISSING");
      const key = `${phase}:${revision}`;
      return {
        ...previous,
        deletionOperations: {
          ...previous.deletionOperations,
          [key]: previous.deletionOperations?.[key] ?? createOperationId(),
        },
      };
    });
    return state.deletionOperations![`${phase}:${revision}`];
  }
  async startFresh() {
    if (!this.options.saves || !(await this.same()))
      throw new Error("SIGN IN TO START FRESH");
    await this.running;
    const state = await this.current();
    if (state.deletion) throw new Error("RETRY DELETE BEFORE STARTING FRESH");
    if (!state.resetBlocked)
      throw new Error("PROGRESS ALREADY ACTIVE / SYNC TO RESUME");
    const marker = await this.resetMarker();
    if (!marker || marker.data.phase !== "ready")
      throw new Error("CLOUD DELETION NOT FINISHED");
    if (!(await this.same())) throw new Error("ACCOUNT CHANGED");
    await this.options.store.update(this.key, () => ({
      ...blank(),
      resetToken: marker.data.token,
      base: {
        ...marker,
        slot: WORKSHOP_SLOT,
        revision: marker.data.revision,
        deleted: true,
        data: emptyProgress(),
      },
    }));
    this.generation = marker.data.token;
    this.clearRecovery();
    this.ready = true;
    this.progress = emptyProgress();
    await this.sync();
  }
  /** Explicit player choice: archive local progress before selecting cloud state. */
  async useCloud() {
    if (!this.ready) return;
    if (!(await this.same())) return;
    const state = await this.options.store.update(this.key, (previous) => {
      const s = previous ?? blank();
      if (!s.conflict?.data) return s;
      return {
        resetToken: s.resetToken,
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
    if (!this.ready || !await this.same()) throw new Error('RESTORE SHOP BEFORE SIGN IN');
    await this.recoverRuns();
    const state = await this.current();
    return {slot: WORKSHOP_SLOT, kind: 'json', data: validateProgress(state.snapshot), schemaVersion: 1, metadata: {game:'vaccoin',profile:'cosmetic-workshop'}};
  }
  /** Discard no pending operations: archive the old local queue before using target cloud. */
  async acceptAccountCloud() {
    await this.pauseForAccount();
    if (!this.options.saves || !await this.same()) throw new Error('RESTORE ACCOUNT FIRST');
    if ((await this.current()).deletion) throw new Error('FINISH CLOUD DELETION FIRST');
    const marker = await this.resetMarker();
    if (marker?.data.phase === "deleting") throw new Error("CLOUD DELETION IN PROGRESS");
    let cloud: Saved<Progress> | null;
    try { cloud = await timed(this.options.saves.load<Progress>(WORKSHOP_SLOT)); }
    catch (error) { if (error instanceof ApiError && error.code === 'SAVE_NOT_FOUND') cloud = null; else throw error; }
    if (!await this.same()) throw new Error('ACCOUNT CHANGED');
    const latestMarker = await this.resetMarker();
    if (latestMarker?.revision !== marker?.revision || latestMarker?.data.phase === "deleting")
      throw new Error("CLOUD RESET CHANGED / REVIEW ACCOUNT AGAIN");
    // Account review is an explicit choice to use/import this payload. Bind it
    // to the target account's generation, never the source account's marker.
    if (cloud && cloud.metadata?.resetToken !== marker?.data.token) {
      const metadata = {game: "vaccoin", profile: "cosmetic-workshop",
        ...(marker ? {resetToken: marker.data.token} : {})};
      const result = await timed(this.options.saves.save(WORKSHOP_SLOT, validateProgress(cloud.data), {
        expectedPlayerId: this.owner!, expectedRevision: cloud.revision,
        operationId: createOperationId(), schemaVersion: 1, metadata,
      }));
      cloud = {...result, data: cloud.data};
    }
    if (!await this.same()) throw new Error('ACCOUNT CHANGED');
    const snapshot = cloud && !cloud.deleted ? validateProgress(cloud.data) : emptyProgress();
    const state = await this.options.store.update(this.key, previous => ({
      base:cloud, snapshot, pending:[], resetToken:marker?.data.token,
      resetBlocked: !!marker && !cloud,
      archives: marker ? [] : [...(previous?.archives ?? []),{...(previous ?? blank()),archives:[]}],
    }));
    this.generation = marker?.data.token ?? "legacy";
    this.ready = !state.resetBlocked;
    this.show(state); this.accountPaused = false;
    this.status = state.resetBlocked ? "CLOUD SAVE DELETED / START FRESH IN ACCOUNT" : 'CLOUD SAVED / ACCOUNT PROGRESS SELECTED';
  }
  async exportRecovery() {
    return JSON.stringify(await this.current(), null, 2);
  }
}
