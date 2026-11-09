import { TOTAL_COINS } from "./coin-counts";
// Application boundary, NOT a proposed Supagame SDK API. The actual sibling
// packages/sdk-ts contains only .gitkeep. Supply a bridge once that SDK exists.
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
export interface SupagameBridge {
  connect(): Promise<{ name: string; personalBest: number }>;
  submit(run: CompletedRun): Promise<{ personalBest: number }>;
  standings(): Promise<Standing[]>;
}
interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
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
  entries: Standing[] = [];
  status = "ONLINE UNAVAILABLE / SDK NOT CONNECTED";
  name = "YOU";
  private connected = false;
  constructor(
    private storage: StorageLike | undefined = browserStorage(),
    private bridge?: SupagameBridge,
  ) {
    try {
      const value = Number(storage?.getItem(KEY) ?? 0);
      if (Number.isSafeInteger(value) && value >= 0 && value <= TOTAL_COINS) {
        this.best = value;
        this.persisted = !!storage;
      }
    } catch {
      /* Storage is optional. */
    }
  }
  async connect() {
    if (!this.bridge) return;
    try {
      const profile = await deadline(this.bridge.connect());
      this.name = profile.name;
      this.saveBest(profile.personalBest);
      this.connected = true;
      this.entries = await deadline(this.bridge.standings());
      this.status = "GLOBAL / MOST COINS COLLECTED";
    } catch {
      this.connected = false;
      this.status = "Online unavailable / connection failed";
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
  async complete(run: CompletedRun) {
    if (
      !Number.isSafeInteger(run.score) ||
      run.score < 0 ||
      run.score > TOTAL_COINS ||
      run.durationMs < 60000 ||
      !run.id
    )
      throw new Error("Only valid completed rounds can be saved");
    this.saveBest(run.score);
    if (!this.bridge || !this.connected) return { submitted: false };
    try {
      const result = await deadline(this.bridge.submit(run));
      this.saveBest(result.personalBest);
      this.status = "SCORE SUBMITTED";
      try {
        this.entries = await deadline(this.bridge.standings());
      } catch {
        this.status = "SCORE SUBMITTED / RANKINGS UNAVAILABLE";
      }
      return { submitted: true };
    } catch {
      this.status = "ONLINE UNAVAILABLE / SCORE SAVED LOCALLY";
      return { submitted: false };
    }
  }
}
