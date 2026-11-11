import {
  createAchievementQueue,
  type Achievement,
  type AchievementQueue,
  type GameServices,
} from "@supagame/sdk-ts";
import definitions from "./achievement-definitions.json";
export class RunAchievements {
  rows: Achievement[] = definitions.map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    icon: d.icon,
    category: d.category,
    metadata: d.metadata,
    progress: { current: 0, threshold: d.condition.threshold },
    unlocked: false,
    unlockedAt: null,
    historical: false,
  }));
  status = "CONNECT TO CHECK YOUR ACHIEVEMENTS";
  queue?: AchievementQueue;
  private connecting?: Promise<void>;
  private loading = 0;
  private phase = "";
  private notify?: (achievement: Achievement) => void;
  private unsubscribe?: () => void;
  private announced = new Set<string>();
  private ready: boolean;
  constructor(private game?: GameServices) {
    this.ready = !game?.achievements;
  }
  useOffline() {
    this.ready = true;
    this.status = "ACHIEVEMENTS UNAVAILABLE / TRY AGAIN";
  }
  private ensureQueue() {
    this.queue ??= createAchievementQueue(
      {
        onUnlocked: (listener) => {
          this.notify = listener;
          return {
            ready: Promise.resolve(),
            unsubscribe: () => {
              this.notify = undefined;
            },
          };
        },
      },
      { paused: true, durationMs: 4000 },
    );
  }
  connect(): Promise<void> {
    this.ensureQueue();
    if (!this.game?.achievements) return Promise.resolve();
    if (!this.connecting) {
      const subscription = this.game.achievements.onUnlocked((a) =>
        this.notify?.(a),
      );
      this.unsubscribe = () => subscription.unsubscribe();
      this.connecting = this.load();
    }
    return this.connecting;
  }
  async load() {
    if (!this.game?.achievements) return;
    this.loading++;
    this.status = "LOADING ACHIEVEMENTS";
    try {
      this.rows = await this.game.achievements.getPlayerAchievements();
      this.status = "SINGLE RUN / PERMANENT UNLOCKS";
    } catch {
      this.status = "ACHIEVEMENTS UNAVAILABLE / TRY AGAIN";
    } finally {
      this.loading--;
      this.ready = true;
    }
  }
  update(phase: string, hidden = false, score = 0) {
    this.ensureQueue();
    const mode = hidden ? "paused" : "visible";
    if (mode !== this.phase) {
      this.phase = mode;
      if (mode === "paused") this.queue?.pause();
      else this.queue?.resume();
    }
    if (phase !== "playing" || !this.ready || this.loading > 0) return;
    for (const definition of definitions) {
      const row = this.rows.find((a) => a.id === definition.id);
      if (
        !row ||
        row.unlocked ||
        this.announced.has(row.id) ||
        score < definition.condition.threshold
      )
        continue;
      this.announced.add(row.id);
      // Celebrate immediately; permanent rows still come from accepted scores.
      // The shared queue deduplicates the later server confirmation by ID.
      this.notify?.({
        ...row,
        unlocked: true,
        historical: false,
        progress: { current: score, threshold: definition.condition.threshold },
      });
    }
  }
  dispose() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.queue?.dispose();
    this.queue = undefined;
    this.connecting = undefined;
    this.phase = "";
    this.announced.clear();
  }
}
