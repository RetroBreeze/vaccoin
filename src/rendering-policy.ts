export interface RenderViewport {
  width: number;
  height: number;
  devicePixelRatio: number;
  mobile: boolean;
  menu: boolean;
}

export function renderPixelRatio(view: RenderViewport, scale = 1): number {
  const width = Math.max(1, view.width);
  const height = Math.max(1, view.height);
  const dpr = view.devicePixelRatio || 1;
  return view.menu
    ? Math.min(dpr, 1, 960 / width, 540 / height)
    : Math.min(
        dpr,
        view.mobile ? 1.5 : 2,
        Math.sqrt((view.mobile ? 1280 * 720 : 1920 * 1080) / (width * height)),
      ) * scale;
}

// Frame intervals include CPU and GPU pressure. Require a full slow window to
// lower quality, and much longer recovery to avoid oscillating framebuffer sizes.
export class AdaptiveResolution {
  private tier = 0;
  private readonly scales = [1, 0.8, 0.65];
  private active = false;
  private previousLongFrame = false;
  private elapsed = 0;
  private frames = 0;
  private recoveryMs = 0;

  get scale() {
    return this.scales[this.tier];
  }

  observeFrame(frameMs: number, active: boolean): boolean {
    if (!active || !Number.isFinite(frameMs) || frameMs <= 0) {
      this.active = false;
      this.previousLongFrame = false;
      this.elapsed = this.frames = this.recoveryMs = 0;
      return false;
    }
    const longFrame = frameMs > 250;
    const repeatedLongFrame = longFrame && this.previousLongFrame;
    this.previousLongFrame = longFrame;
    if (longFrame && !repeatedLongFrame) {
      // Ignore one interruption. Repeated long active frames are sustained load,
      // so they must still lower quality instead of resetting sampling forever.
      this.active = false;
      this.elapsed = this.frames = this.recoveryMs = 0;
      return false;
    }
    frameMs = Math.min(frameMs, 250);
    // The interval preceding the first active frame may belong to a menu/tab.
    if (!this.active) {
      this.active = true;
      return false;
    }
    this.elapsed += frameMs;
    this.frames++;
    if (this.elapsed < 1000) return false;

    const average = this.elapsed / this.frames;
    this.recoveryMs = average < 18 ? this.recoveryMs + this.elapsed : 0;
    this.elapsed = this.frames = 0;
    if (average > 24 && this.tier < this.scales.length - 1) {
      this.tier++;
      return true;
    }
    if (this.recoveryMs >= 8000 && this.tier > 0) {
      this.tier--;
      this.recoveryMs = 0;
      return true;
    }
    return false;
  }
}
