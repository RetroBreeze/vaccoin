import { pixelText } from "./pixel-font";
import { Phase } from "./round";
import { Standing } from "./supagame";
export interface UIState {
  phase: Phase;
  score: number;
  remaining: number;
  best: number;
  sucking: boolean;
  locked: boolean;
  time: number;
  muted: boolean;
  entries: Standing[];
  error: string;
  persisted: boolean;
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
  private hovered = false;
  private scorePulse = 0;
  private lastScore = 0;
  constructor(
    readonly canvas: HTMLCanvasElement,
    private button: HTMLButtonElement,
    private sound: HTMLButtonElement,
  ) {
    this.ctx = canvas.getContext("2d")!;
    button.addEventListener("mouseenter", () => (this.hovered = true));
    button.addEventListener("mouseleave", () => (this.hovered = false));
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
  private playButton(label: string, x: number, y: number, w: number) {
    this.rect(x + 4, y + 5, w, 48, "#061b28");
    this.rect(x, y, w, 48, this.hovered ? "#ffe6a0" : C.gold);
    this.rect(x, y, w, 3, "#fff3c2");
    this.text(label, x + w / 2, y + 14, 3, C.dark, "center");
    this.button.style.display = "block";
    this.button.style.left = `${(x / this.w) * 100}%`;
    this.button.style.top = `${(y / 540) * 100}%`;
    this.button.style.width = `${(w / this.w) * 100}%`;
    this.button.style.height = `${(48 / 540) * 100}%`;
    this.button.textContent = label;
    this.button.setAttribute("aria-label", label);
  }
  draw(s: UIState, dt: number) {
    const c = this.ctx,
      w = this.w,
      cx = w / 2;
    c.clearRect(0, 0, w, 540);
    this.button.style.display = "none";
    this.sound.style.display = s.phase === "playing" ? "none" : "block";
    this.sound.style.left = `${((w - 48) / w) * 100}%`;
    this.sound.setAttribute(
      "aria-label",
      s.muted ? "Unmute sound" : "Mute sound",
    );

    if (s.phase === "playing") {
      if (s.score !== this.lastScore) {
        this.scorePulse = 0.12;
        this.lastScore = s.score;
      }
      this.scorePulse = Math.max(0, this.scorePulse - dt);
      const score = s.score.toLocaleString("en-US");
      this.text(score, 26, 28, 5, C.dark);
      this.text(score, 24, 26, 5, this.scorePulse > 0 ? "#fff8cf" : C.gold);
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
      if (s.sucking) {
        this.rect(cx - 9, 269, 3, 1, C.mint);
        this.rect(cx + 7, 269, 3, 1, C.mint);
        this.rect(cx - 1, 261, 1, 3, C.mint);
        this.rect(cx - 1, 277, 1, 3, C.mint);
      }
      if (!s.locked) {
        this.rect(0, 90, w, 450, "#06192577");
        this.playButton("RESUME", cx - 115, 246, 230);
      }
    } else if (s.phase === "title") {
      this.rect(0, 0, w, 540, "#10283766");
      this.text("VACCOIN", cx + 5, 186, 10, "#493f35", "center");
      this.text("VACCOIN", cx, 180, 10, C.gold, "center");
      this.playButton("PLAY", cx - 128, 302, 256);
    } else {
      this.rect(0, 0, w, 540, "#0b2036bd");
      this.text(s.score.toLocaleString("en-US"), cx, 158, 9, C.gold, "center");
      this.text(
        "BEST " + s.best.toLocaleString("en-US"),
        cx,
        247,
        2,
        C.white,
        "center",
      );
      this.playButton("PLAY AGAIN", cx - 158, 300, 316);
      if (s.entries.length) {
        for (let i = 0; i < Math.min(3, s.entries.length); i++) {
          const e = s.entries[i];
          this.text(
            `${e.rank}. ${e.name.slice(0, 16)}`,
            cx - 150,
            380 + i * 19,
            1,
            C.muted,
          );
          this.text(
            String(e.score),
            cx + 150,
            380 + i * 19,
            1,
            C.gold,
            "right",
          );
        }
      } else {
        this.text("LEADERBOARD OFFLINE", cx, 380, 1, C.muted, "center");
      }
      if (!s.persisted)
        this.text("BEST KEPT THIS SESSION", cx, 450, 1, C.muted, "center");
    }
    if (s.phase !== "playing") {
      // A small speaker icon replaces the old sound-status lettering.
      const x = w - 40,
        y = 514;
      this.rect(x, y + 3, 4, 6, C.muted);
      this.rect(x + 4, y + 1, 3, 10, C.muted);
      this.rect(x + 7, y, 2, 12, C.muted);
      if (s.muted) {
        for (let i = 0; i < 5; i++)
          this.rect(x + 12 + i, y + 3 + i, 1, 1, C.muted);
        for (let i = 0; i < 5; i++)
          this.rect(x + 16 - i, y + 3 + i, 1, 1, C.muted);
      } else {
        this.rect(x + 12, y + 3, 2, 6, C.muted);
      }
    }
    if (s.error) {
      this.rect(0, 510, w, 23, "#64363b");
      this.text(s.error, cx, 517, 1, C.white, "center");
    }
  }
}
