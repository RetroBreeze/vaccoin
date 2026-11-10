import { GameServicesError, type GameServices } from "@supagame/sdk-ts";
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
  isPlayer?: boolean;
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
  stage: string;
}
function submissionKey(): string {
  const crypto = globalThis.crypto;
  if (crypto?.randomUUID) return crypto.randomUUID();
  if (!crypto?.getRandomValues) return "";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function failure(error: unknown): string {
  if (error instanceof GameServicesError) {
    switch (error.kind) {
      case "authentication":
        return "AUTHENTICATION ERROR";
      case "network":
        return typeof navigator !== "undefined" && navigator.onLine === false
          ? "OFFLINE"
          : "NETWORK ERROR";
      case "api":
        return `API ERROR / ${"code" in error ? error.code : "UNKNOWN"}`;
      case "unexpected_response":
        return "INVALID API RESPONSE";
      case "invalid_parameter":
        return "INVALID REQUEST";
    }
  }
  if (error instanceof Error && error.message === "Leaderboard timeout")
    return "REQUEST TIMED OUT";
  if (error instanceof Error && error.message === "Secure UUID unavailable")
    return "SECURE RANDOMNESS UNAVAILABLE";
  return "REQUEST FAILED";
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
  browseMode: "top" | "around" = "top";
  browseEntries: Standing[] = [];
  browseStatus = "LEADERBOARD NOT LOADED";
  browseLoading = false;
  browseCanRetry = false;
  private browseVersion = 0;
  persisted = false;
  best = 0;
  personalBest: number | null = null;
  rank: number | null = null;
  entries: Standing[] = [];
  status = "BACKEND NOT CONFIGURED";
  topStatus = "LEADERBOARD NOT LOADED";
  retryLabel = "RETRY SESSION";
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

  async browse(mode: "top" | "around", hasProfile = true) {
    const version = ++this.browseVersion;
    this.browseMode = mode;
    this.browseEntries = [];
    this.browseLoading = false;
    this.browseCanRetry = false;
    if (!this.game) {
      this.browseStatus = "BACKEND NOT CONFIGURED";
      return;
    }
    if (mode === "around" && !hasProfile) {
      this.browseStatus = "PLAY A ROUND TO GET RANKED";
      return;
    }
    this.browseLoading = true;
    this.browseStatus = "LOADING LEADERBOARD";
    try {
      const result = await deadline(
        (async () => {
          if (mode === "top") {
            const page = await this.game!.leaderboards.getTop("vaccoin", {
              limit: 10,
            });
            return page.entries.slice(0, 10).map((e) => ({
              rank: e.rank,
              name: e.displayName || "ANONYMOUS",
              score: e.score,
              ...(e.playerId === this.userId ? { isPlayer: true } : {}),
            }));
          }
          await this.ensurePlayer();
          if (version !== this.browseVersion) return [];
          const mine = await this.game!.leaderboards.getMine("vaccoin");
          if (version !== this.browseVersion) return [];
          if (!mine) return null;
          const neighbors: Standing[] = [];
          let found = false,
            following = 0;
          let cursor: string | undefined;
          const cursors = new Set<string>();
          do {
            const page = await this.game!.leaderboards.getTop("vaccoin", {
              limit: 100,
              ...(cursor ? { cursor } : {}),
            });
            if (version !== this.browseVersion) return [];
            for (const e of page.entries) {
              const isPlayer = e.playerId === mine.playerId;
              neighbors.push({
                rank: e.rank,
                name: e.displayName || "ANONYMOUS",
                score: e.score,
                isPlayer,
              });
              if (isPlayer) found = true;
              else if (found && ++following === 5) return neighbors;
              if (!found && neighbors.length > 5) neighbors.shift();
            }
            if (!page.nextCursor) break;
            if (cursors.has(page.nextCursor))
              throw new Error("Repeated leaderboard cursor");
            cursors.add(page.nextCursor);
            cursor = page.nextCursor;
          } while (version === this.browseVersion);
          // A score can disappear or move while walking pages; never show unrelated rows.
          if (!found) throw new Error("Player missing from leaderboard");
          return neighbors;
        })(),
      );
      if (version !== this.browseVersion) return;
      this.browseEntries = result ?? [];
      this.browseStatus =
        result === null
          ? "PLAY A ROUND TO GET RANKED"
          : result.length
            ? "GLOBAL / MOST COINS COLLECTED"
            : "NO SCORES YET";
    } catch (error) {
      if (version !== this.browseVersion) return;
      this.browseStatus = `LEADERBOARD UNAVAILABLE / ${failure(error)}`;
      this.browseCanRetry = true;
    } finally {
      if (version === this.browseVersion) {
        this.browseLoading = false;
        // Stop pagination and discard late responses after a timeout.
        this.browseVersion++;
      }
    }
  }

  async connect(name = this.name) {
    this.name = name;
    if (!this.game) return;
    const revision = this.revision;
    this.loading = true;
    this.status = "CONNECTING LEADERBOARD";
    let stage = "PLAYER SESSION";
    try {
      await deadline(this.ensurePlayer());
      stage = "RANKINGS";
      const issue = await deadline(this.refresh(revision));
      if (revision === this.revision) {
        this.status = issue ?? "GLOBAL / MOST COINS COLLECTED";
        this.canRetry = issue !== null;
        this.retryLabel = "RETRY RANKINGS";
      }
    } catch (error) {
      if (revision === this.revision) {
        this.status = `${stage} UNAVAILABLE / ${failure(error)}`;
        this.retryLabel =
          stage === "PLAYER SESSION" ? "RETRY SESSION" : "RETRY RANKINGS";
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

  private async refresh(revision: number): Promise<string | null> {
    const version = ++this.refreshVersion;
    const [top, mine] = await Promise.allSettled([
      this.game!.leaderboards.getTop("vaccoin", { limit: 10 }),
      this.game!.leaderboards.getMine("vaccoin"),
    ]);
    if (revision !== this.revision || version !== this.refreshVersion)
      return null;
    this.topStatus =
      top.status === "fulfilled" ? "NO SCORES YET" : "LEADERBOARD UNAVAILABLE";
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
    // Both reads failed: report rankings as a whole with the first cause.
    // Avoid repeating operation names beyond the narrow Canvas width.
    if (top.status === "rejected" && mine.status === "rejected")
      return `RANKINGS UNAVAILABLE / ${failure(top.reason)}`;
    const issues: string[] = [];
    if (top.status === "rejected")
      issues.push(`LEADERBOARD UNAVAILABLE / ${failure(top.reason)}`);
    if (mine.status === "rejected")
      issues.push(`PERSONAL BEST UNAVAILABLE / ${failure(mine.reason)}`);
    return issues.length ? issues.join(" / ") : null;
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
        key: submissionKey(),
        stage: "PLAYER SESSION",
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
      this.status = "BACKEND NOT CONFIGURED / SCORE SAVED LOCALLY";
      return { submitted: false };
    }
    const revision = this.revision;
    this.loading = true;
    this.canRetry = false;
    this.status = attempt.submitted ? "LOADING RANKINGS" : "SUBMITTING SCORE";
    if (!attempt.pending) {
      const operation = (async () => {
        if (!attempt.submitted) {
          attempt.stage = "PLAYER SESSION";
          const userId = await this.ensurePlayer();
          if (attempt.userId && attempt.userId !== userId)
            throw new Error("Submission belongs to another identity");
          attempt.userId = userId;
          attempt.stage = "SUBMISSION";
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
        attempt.stage = "RANKINGS";
        // Bound reads separately so an accepted write can retry hung rankings.
        const issue = await deadline(this.refresh(revision));
        if (revision === this.revision) {
          this.status = issue
            ? `SCORE SUBMITTED / ${issue}`
            : "SCORE SUBMITTED";
          this.canRetry = issue !== null;
          this.retryLabel = "RETRY RANKINGS";
        }
      })();
      attempt.pending = operation;
      void operation
        .catch((error) => {
          // Revalidate the same identity on a deliberate retry. Never sign out.
          this.readyName = undefined;
          if (revision === this.revision) {
            this.reportAttemptFailure(attempt, error);
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
    } catch (error) {
      if (revision === this.revision) {
        this.loading = false;
        this.canRetry = true;
        this.reportAttemptFailure(attempt, error);
      }
    }
    return { submitted: attempt.submitted };
  }

  private reportAttemptFailure(attempt: Attempt, error: unknown) {
    this.status = attempt.submitted
      ? `SCORE SUBMITTED / RANKINGS UNAVAILABLE / ${failure(error)}`
      : `${attempt.stage} UNAVAILABLE / ${failure(error)}`;
    this.retryLabel = attempt.submitted ? "RETRY RANKINGS" : "RETRY SCORE";
  }

  async retry() {
    if (this.current) return this.send(this.current);
    await this.connect();
    return { submitted: false };
  }
}
