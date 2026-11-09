import type { Phase } from "./round";
// The acquisition event is authoritative even on browsers whose request returns void.
export class PlayIntent {
  private pending: "play" | "restart" | null = null;
  request(restart: boolean) {
    this.pending = restart ? "restart" : "play";
  }
  cancel() {
    this.pending = null;
  }
  acquired(phase: Phase): "start" | "resume" | "none" {
    const pending = this.pending;
    this.pending = null;
    if (!pending) return "none";
    return pending === "restart" || phase !== "playing" ? "start" : "resume";
  }
}
