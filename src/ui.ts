import type { Achievement } from "@supagame/sdk-ts";
import type { MenuUI } from "./menu-ui";
import { pixelText } from "./pixel-font";
import { Phase } from "./round";
import { Standing } from "./supagame";
export interface UIState {
  menuCovered?: boolean;
  achievementsOpen?: boolean;
  achievements?: Achievement[];
  achievementNotice?: Achievement | null;
  achievementStatus?: string;
  liveEntries?: Standing[];
  liveStatus?: string;
  rankNotice?: string;
  leaderboardOpen?: boolean;
  browseMode?: "top" | "around";
  browseEntries?: Standing[];
  browseStatus?: string;
  browseLoading?: boolean;
  browseCanRetry?: boolean;
  phase: Phase;
  controlHint?: string;
  mobile?: boolean;
  score: number;
  zone?: string;
  pickup?: string;
  remaining: number;
  countdown?: number;
  best: number;
  sucking: boolean;
  locked: boolean;
  time: number;
  muted: boolean;
  entries: Standing[];
  error: string;
  persisted: boolean;
  personalBest: number | null;
  rank: number | null;
  leaderboardStatus: string;
  leaderboardReadStatus: string;
  retryLabel: string;
  loading: boolean;
  canRetry: boolean;
}
const C = {
  white: "#fff2d2",
  gold: "#ffcf58",
  mint: "#8cf0d1",
  muted: "#96b6c2",
  dark: "#102837",
};
export class UI {
  readonly ctx: CanvasRenderingContext2D;
  w = 960;
  private scorePulse = 0;
  private lastScore = 0;
  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly menus?: MenuUI,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.resize();
  }
  resize() {
    this.w = Math.max(540, Math.round((540 * innerWidth) / innerHeight));
    this.canvas.width = this.w;
    this.canvas.height = 540;
    this.ctx.imageSmoothingEnabled = false;
  }
  private text(
    t: string,
    x: number,
    y: number,
    s = 2,
    color = C.white,
    align: "left" | "center" | "right" = "left",
  ) {
    pixelText(this.ctx, t, x, y, s, color, align);
  }
  private rect(x: number, y: number, w: number, h: number, c: string) {
    this.ctx.fillStyle = c;
    this.ctx.fillRect(
      Math.round(x),
      Math.round(y),
      Math.round(w),
      Math.round(h),
    );
  }
  draw(s: UIState, dt: number) {
    const c = this.ctx,
      w = this.w,
      cx = w / 2;
    c.clearRect(0, 0, w, 540);
    this.menus?.draw(s);
    if (s.phase === "playing") {
      if (s.score !== this.lastScore) {
        this.scorePulse = 0.12;
        this.lastScore = s.score;
      }
      this.scorePulse = Math.max(0, this.scorePulse - dt);
      const score = s.score.toLocaleString("en-US");
      this.text(score, 26, 28, 5, C.dark);
      this.text(score, 24, 26, 5, this.scorePulse > 0 ? "#fff8cf" : C.gold);
      this.text("POINTS", 24, 66, 1, C.muted);
      if (s.zone) this.text(s.zone, cx, 92, 2, C.gold, "center");
      if (s.pickup) this.text(s.pickup, cx, 320, 2, C.mint, "center");
      const time = String(Math.ceil(s.remaining)).padStart(2, "0");
      this.text(time, cx + 2, 28, 5, C.dark, "center");
      this.text(
        time,
        cx,
        26,
        5,
        s.remaining <= 10 && Math.sin(s.time * 9) > 0 ? "#ff9878" : C.white,
        "center",
      );
      this.rect(cx - 1, 269, 3, 3, C.white);
      if (s.countdown && s.locked) {
        this.rect(cx - 66, 202, 132, 122, "#102837e6");
        this.text(String(s.countdown), cx, 230, 12, C.gold, "center");
      }
      if (s.sucking) {
        this.rect(cx - 9, 269, 3, 1, C.mint);
        this.rect(cx + 7, 269, 3, 1, C.mint);
        this.rect(cx - 1, 261, 1, 3, C.mint);
        this.rect(cx - 1, 277, 1, 3, C.mint);
      }
    }
    if (s.error && s.phase === "playing") {
      this.rect(0, 510, w, 23, "#64363b");
      this.text(s.error, cx, 517, 1, C.white, "center");
    }
  }
}
