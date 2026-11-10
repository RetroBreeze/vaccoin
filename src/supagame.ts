import type { GameServices } from "@supagame/sdk-ts";
import { TOTAL_COINS } from "./coin-counts";

export interface CompletedRun {
  id: string;
  score: number;
  durationMs: number;
}
export interface Standing {
  rank: number;
  name: string;
  score: number;
}
interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
interface Attempt {
  run: CompletedRun;
  key: string;
  userId?: string;
  submitted: boolean;
  pending?: Promise<void>;
}
const KEY = "vaccoin.personal-best.v1";
function browserStorage(): StorageLike | undefined {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}
async function deadline<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Leaderboard timeout")),
          5000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}

export class Leaderboard {
  persisted = false;
  best = 0;
  personalBest: number | null = null;
  rank: number | null = null;
  entries: Standing[] = [];
  status = "ONLINE UNAVAILABLE";
  name = "YOU";
  loading = false;
  canRetry = false;
  private identity?: Promise<string>;
  private readyName?: string;
  private userId?: string;
  private attempts = new Map<string, Attempt>();
  private current?: Attempt;
  private revision = 0;
  private refreshVersion = 0;

  constructor(
    private storage: StorageLike | undefined = browserStorage(),
    private game?: GameServices,
  ) {
    try {
      const value = Number(storage?.getItem(KEY) ?? 0);
      if (Number.isSafeInteger(value) && value >= 0 && value <= TOTAL_COINS) {
        this.best = value;
        this.persisted = !!storage;
      }
    } catch {
      // Storage is optional.
    }
  }

  private ensurePlayer(): Promise<string> {
    if (this.identity) return this.identity;
    if (this.readyName === this.name && this.userId)
      return Promise.resolve(this.userId);
    const name = this.name;
    const operation = (async () => {
      if (!this.game) throw new Error("Backend not configured");
      // The SDK only creates a session when none exists, never after auth errors.
      const { userId } = await this.game.players.ensureAnonymousSession();
      const profile = await this.game.players.getMe();
      if (profile.displayName !== name)
        await this.game.players.updateMe({ displayName: name });
      this.userId = userId;
      this.readyName = name;
      return userId;
    })();
    this.identity = operation;
    void operation
      .finally(() => {
        this.identity = undefined;
      })
      .catch(() => {});
    return operation;
  }

  async connect(name = this.name) {
    this.name = name;
    if (!this.game) return;
    const revision = this.revision;
    this.loading = true;
    this.status = "CONNECTING LEADERBOARD";
    try {
      await deadline(this.ensurePlayer());
      const ok = await deadline(this.refresh(revision));
      if (revision === this.revision) {
        this.status = ok
          ? "GLOBAL / MOST COINS COLLECTED"
          : "RANKINGS UNAVAILABLE";
        this.canRetry = !ok;
      }
    } catch {
      if (revision === this.revision) {
        this.status = "ONLINE UNAVAILABLE / PLAY IS READY";
        this.canRetry = true;
      }
    } finally {
      if (revision === this.revision) this.loading = false;
    }
  }

  private saveBest(score: number) {
    if (!Number.isSafeInteger(score) || score < 0 || score > TOTAL_COINS)
      return;
    this.best = Math.max(this.best, score);
    try {
      this.storage?.setItem(KEY, String(this.best));
      this.persisted = !!this.storage;
    } catch {
      this.persisted = false;
    }
  }

  private async refresh(revision: number): Promise<boolean> {
    const version = ++this.refreshVersion;
    const [top, mine] = await Promise.allSettled([
      this.game!.leaderboards.getTop("vaccoin", { limit: 10 }),
      this.game!.leaderboards.getMine("vaccoin"),
    ]);
    if (revision !== this.revision || version !== this.refreshVersion)
      return false;
    if (top.status === "fulfilled")
      this.entries = top.value.entries.slice(0, 10).map((e) => ({
        rank: e.rank,
        name: e.displayName || "ANONYMOUS",
        score: e.score,
      }));
    if (mine.status === "fulfilled") {
      this.personalBest = mine.value?.score ?? null;
      this.rank = mine.value?.rank ?? null;
      if (mine.value) this.saveBest(mine.value.score);
    } else {
      // Do not display a stale rank after an uncertain write.
      this.rank = null;
    }
    return top.status === "fulfilled" && mine.status === "fulfilled";
  }

  async complete(run: CompletedRun): Promise<{ submitted: boolean }> {
    if (
      !Number.isSafeInteger(run.score) ||
      run.score < 0 ||
      run.score > TOTAL_COINS ||
      !Number.isFinite(run.durationMs) ||
      run.durationMs < 60000 ||
      !run.id
    )
      throw new Error("Only valid completed rounds can be saved");
    let attempt = this.attempts.get(run.id);
    if (
      attempt &&
      (attempt.run.score !== run.score ||
        attempt.run.durationMs !== run.durationMs)
    )
      throw new Error("A completed round cannot change");
    const existing = !!attempt;
    if (!attempt) {
      attempt = {
        run: { ...run },
        key: globalThis.crypto?.randomUUID?.() ?? "",
        submitted: false,
      };
      this.attempts.set(run.id, attempt);
      this.current = attempt;
      this.revision++;
      this.saveBest(run.score);
      this.rank = null;
    }
    // Repeated completion notifications never initiate a second attempt.
    if (existing && !attempt.pending) return { submitted: attempt.submitted };
    return this.send(attempt);
  }

  private async send(attempt: Attempt): Promise<{ submitted: boolean }> {
    if (!this.game) {
      this.status = "ONLINE UNAVAILABLE / SCORE SAVED LOCALLY";
      return { submitted: false };
    }
    const revision = this.revision;
    this.loading = true;
    this.canRetry = false;
    this.status = attempt.submitted ? "LOADING RANKINGS" : "SUBMITTING SCORE";
    if (!attempt.pending) {
      const operation = (async () => {
        if (!attempt.submitted) {
          const userId = await this.ensurePlayer();
          if (attempt.userId && attempt.userId !== userId)
            throw new Error("Submission belongs to another identity");
          attempt.userId = userId;
          if (!attempt.key) throw new Error("Secure UUID unavailable");
          const result = await this.game!.leaderboards.submit(
            "vaccoin",
            attempt.run.score,
            attempt.key,
          );
          attempt.submitted = true;
          if (revision === this.revision) {
            this.personalBest = result.bestScore;
            this.saveBest(result.bestScore);
          }
        }
        // Bound reads separately so an accepted write can retry hung rankings.
        const ok = await deadline(this.refresh(revision));
        if (revision === this.revision) {
          this.status = ok
            ? "SCORE SUBMITTED"
            : "SCORE SUBMITTED / RANKINGS UNAVAILABLE";
          this.canRetry = !ok;
        }
      })();
      attempt.pending = operation;
      void operation
        .catch(() => {
          // Revalidate the same identity on a deliberate retry. Never sign out.
          this.readyName = undefined;
          if (revision === this.revision) {
            this.status = attempt.submitted
              ? "SCORE SUBMITTED / RANKINGS UNAVAILABLE"
              : "ONLINE UNAVAILABLE / RETRY SCORE";
            this.canRetry = true;
          }
        })
        .finally(() => {
          attempt.pending = undefined;
          if (revision === this.revision) this.loading = false;
        });
    }
    try {
      await deadline(attempt.pending);
    } catch {
      if (revision === this.revision) {
        this.loading = false;
        this.canRetry = true;
        this.status = attempt.submitted
          ? "SCORE SUBMITTED / RANKINGS UNAVAILABLE"
          : "ONLINE UNAVAILABLE / RETRY SCORE";
      }
    }
    return { submitted: attempt.submitted };
  }

  async retry() {
    if (this.current) return this.send(this.current);
    await this.connect();
    return { submitted: false };
  }
}
