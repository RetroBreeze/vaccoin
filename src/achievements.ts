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
  private phase = "";
  constructor(private game?: GameServices) {}
  connect(): Promise<void> {
    if (!this.game?.achievements) return Promise.resolve();
    if (!this.connecting) {
      this.queue ??= createAchievementQueue(this.game.achievements, {
        paused: true,
        durationMs: 4000,
      });
      this.phase = "";
      this.connecting = this.load();
    }
    return this.connecting;
  }
  async load() {
    if (!this.game?.achievements) return;
    this.status = "LOADING ACHIEVEMENTS";
    try {
      this.rows = await this.game.achievements.getPlayerAchievements();
      this.status = "SINGLE RUN / PERMANENT UNLOCKS";
    } catch {
      this.status = "ACHIEVEMENTS UNAVAILABLE / TRY AGAIN";
    }
  }
  update(phase: string, hidden = false) {
    const mode = hidden || phase === "playing" ? "paused" : "visible";
    if (mode === this.phase) return;
    this.phase = mode;
    if (mode === "paused") this.queue?.pause();
    else this.queue?.resume();
  }
  dispose() {
    this.queue?.dispose();
    this.queue = undefined;
    this.connecting = undefined;
    this.phase = "";
  }
}
