import { createOperationId } from '@supagame/sdk-ts';
export type Phase = "title" | "playing" | "results";
export class Round {
  phase: Phase = "title";
  score = 0;
  startedAt = 0;
  id = "";
  destroyed = 0;
  start(now: number) {
    this.phase = "playing";
    this.score = 0;
    this.destroyed = 0;
    this.startedAt = now;
    this.id = createOperationId();
  }
  remaining(now: number) {
    return Math.max(0, 60 - (now - this.startedAt) / 1000);
  }
  collect(count: number) {
    if (!Number.isSafeInteger(count) || count < 0)
      throw new Error("A coin is one whole point");
    if (this.phase === "playing") this.score += count;
  }
  tick(now: number) {
    if (this.phase === "playing" && this.remaining(now) <= 0) {
      this.phase = "results";
      return true;
    }
    return false;
  }
}
