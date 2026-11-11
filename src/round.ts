import { createOperationId } from '@supagame/sdk-ts';
export type Phase = "title" | "playing" | "results";
export class Round {
  phase: Phase = "title";
  score = 0;
  startedAt = 0;
  id = "";
  destroyed = 0;
  private hasCountdown = false;
  start(now: number, countdownSeconds = 0) {
    this.phase = "playing";
    this.score = 0;
    this.destroyed = 0;
    this.hasCountdown = countdownSeconds > 0;
    this.startedAt = now + countdownSeconds * 1000;
    this.id = createOperationId();
  }
  remaining(now: number) {
    return Math.min(60, Math.max(0, 60 - (now - this.startedAt) / 1000));
  }
  countdown(now: number) {
    return this.phase === "playing" && this.hasCountdown
      ? Math.max(0, Math.ceil((this.startedAt - now) / 1000))
      : 0;
  }
  collect(count: number, now = performance.now()) {
    if (!Number.isSafeInteger(count) || count < 0)
      throw new Error("Score must be a nonnegative whole number");
    if (this.phase === "playing" && this.countdown(now) === 0) this.score += count;
  }
  tick(now: number) {
    if (this.phase === "playing" && this.remaining(now) <= 0) {
      this.phase = "results";
      return true;
    }
    return false;
  }
}
