import { drawTitleScreen, titleLayout } from "./title-screen";
import { pixelText } from "./pixel-font";
import { Phase } from "./round";
import { Standing } from "./supagame";
export interface UIState {
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
  remaining: number;
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
  private hovered = false;
  private scorePulse = 0;
  private lastScore = 0;
  constructor(
    readonly canvas: HTMLCanvasElement,
    private button: HTMLButtonElement,
    private sound: HTMLButtonElement,
    private retry: HTMLButtonElement,
    private leaderboard?: {
      open: HTMLButtonElement;
      top: HTMLButtonElement;
      around: HTMLButtonElement;
      back: HTMLButtonElement;
    },
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
  private menuButton(
    button: HTMLButtonElement,
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
    active = false,
  ) {
    this.rect(x, y, width, height, active ? C.gold : C.dark);
    this.text(
      label,
      x + width / 2,
      y + (height - 14) / 2,
      2,
      active ? C.dark : C.gold,
      "center",
    );
    button.textContent = label;
    button.setAttribute("aria-label", label);
    Object.assign(button.style, {
      display: "block",
      left: `${(x / this.w) * 100}%`,
      top: `${(y / 540) * 100}%`,
      width: `${(width / this.w) * 100}%`,
      height: `${(height / 540) * 100}%`,
    });
  }
  private drawLeaderboard(s: UIState, cx: number) {
    const controls = this.leaderboard!;
    this.rect(0, 0, this.w, 540, "#0b2036ed");
    this.text("LEADERBOARD", cx, 45, 4, C.gold, "center");
    this.menuButton(
      controls.top,
      "TOP 10",
      cx - 230,
      98,
      220,
      36,
      s.browseMode !== "around",
    );
    this.menuButton(
      controls.around,
      "AROUND YOU",
      cx + 10,
      98,
      220,
      36,
      s.browseMode === "around",
    );
    controls.top.setAttribute(
      "aria-pressed",
      String(s.browseMode !== "around"),
    );
    controls.around.setAttribute(
      "aria-pressed",
      String(s.browseMode === "around"),
    );
    for (const [i, e] of (s.browseEntries ?? []).slice(0, 11).entries()) {
      const y = 160 + i * 22;
      if (e.isPlayer) this.rect(cx - 240, y - 5, 480, 22, "#28505d");
      this.text(
        `${e.rank}. ${Array.from(e.name).slice(0, 18).join("")}${e.isPlayer ? " [YOU]" : ""}`,
        cx - 230,
        y,
        2,
        e.isPlayer ? C.mint : C.muted,
      );
      this.text(
        e.score.toLocaleString("en-US"),
        cx + 230,
        y,
        2,
        C.gold,
        "right",
      );
    }
    if (!s.browseEntries?.length)
      this.text(
        s.browseLoading
          ? "LOADING LEADERBOARD"
          : s.browseCanRetry
            ? "LEADERBOARD UNAVAILABLE"
            : (s.browseStatus ?? ""),
        cx,
        225,
        2,
        C.muted,
        "center",
      );
    this.text(s.browseStatus ?? "", cx, 413, 1, C.muted, "center");
    if (s.browseCanRetry && !s.browseLoading)
      this.menuButton(this.retry, "RETRY RANKINGS", cx - 112, 437, 224, 28);
    this.menuButton(controls.back, "BACK", cx - 112, 478, 224, 36);
  }
  draw(s: UIState, dt: number) {
    const c = this.ctx,
      w = this.w,
      cx = w / 2;
    c.clearRect(0, 0, w, 540);
    this.button.style.display = "none";
    this.retry.style.display = "none";
    if (this.leaderboard)
      for (const control of Object.values(this.leaderboard))
        control.style.display = "none";
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
      if (s.leaderboardOpen && this.leaderboard) {
        this.drawLeaderboard(s, cx);
      } else {
        const reduced =
          typeof matchMedia === "function" &&
          matchMedia("(prefers-reduced-motion: reduce)").matches;
        drawTitleScreen(c, w, s, reduced);
        const layout = titleLayout(w);
        this.playButton("PLAY", layout.left - 128, layout.menuY, 256);
        if (this.leaderboard)
          this.menuButton(
            this.leaderboard.open,
            "LEADERBOARD",
            layout.left - 128,
            layout.menuY + 60,
            256,
            30,
          );
      }
    } else {
      this.rect(0, 0, w, 540, "#0b2036bd");
      this.text(s.score.toLocaleString("en-US"), cx, 45, 8, C.gold, "center");
      this.text(
        s.personalBest === null
          ? "BEST " + s.best.toLocaleString("en-US")
          : "BEST " + s.personalBest.toLocaleString("en-US"),
        cx,
        119,
        2,
        C.white,
        "center",
      );
      this.text(
        s.rank === null ? "" : "RANK " + s.rank,
        cx,
        144,
        2,
        C.muted,
        "center",
      );
      this.playButton("PLAY AGAIN", cx - 158, 177, 316);
      this.text("TOP 10", cx, 247, 2, C.mint, "center");
      if (s.entries.length) {
        for (let i = 0; i < Math.min(10, s.entries.length); i++) {
          const e = s.entries[i];
          this.text(
            `${e.rank}. ${Array.from(e.name).slice(0, 22).join("")}`,
            cx - 230,
            274 + i * 16,
            2,
            C.muted,
          );
          this.text(
            e.score.toLocaleString("en-US"),
            cx + 230,
            274 + i * 16,
            2,
            C.gold,
            "right",
          );
        }
      } else {
        this.text(
          s.loading ? "LOADING LEADERBOARD" : s.leaderboardReadStatus,
          cx,
          290,
          2,
          C.muted,
          "center",
        );
      }
      this.retry.textContent = s.retryLabel;
      this.retry.setAttribute("aria-label", s.retryLabel);
      if (s.canRetry && !s.loading) {
        this.rect(cx - 112, 446, 224, 28, C.dark);
        this.text(s.retryLabel, cx, 455, 2, C.gold, "center");
        Object.assign(this.retry.style, {
          display: "block",
          left: `${((cx - 112) / w) * 100}%`,
          top: `${(446 / 540) * 100}%`,
          width: `${(224 / w) * 100}%`,
          height: `${(28 / 540) * 100}%`,
        });
      }
    }
    if (s.rankNotice) {
      this.rect(cx - 180, 510, 360, 23, C.dark);
      this.text(s.rankNotice, cx, 517, 1, C.gold, "center");
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
