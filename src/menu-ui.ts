import type { UIState } from "./ui";
import { MenuSurface, updateStandings } from "./menu-surface";

export class MenuUI {
  private home = new MenuSurface("lobby", "lobby-screen");
  private results = new MenuSurface("results-menu");
  private board = new MenuSurface("rankings-menu");
  private achievements = new MenuSurface("achievements-menu");
  private pause = new MenuSurface("pause-menu", "pause-screen");
  private toast = document.createElement("aside");
  private lastView = "";
  private get(id: string) {
    return document.getElementById(id) as HTMLButtonElement;
  }
  constructor() {
    this.toast.id = "achievement-toast";
    this.toast.hidden = true;
    this.toast.setAttribute("role", "status");
    document.body.append(this.toast);
    this.home.begin();
    const grid = this.home.group("grid", "lobby-grid");
    const intro = this.home.group("intro", "lobby-intro", grid);
    this.home.text("eyebrow", "WELCOME TO THE GRAND CASINO", "eyebrow", intro);
    const logo = this.home.node("img", "logo", "", "lobby-logo", intro);
    logo.src = `${import.meta.env.BASE_URL}assets/logo.png`;
    logo.alt = "Vaccoin";
    this.home.text(
      "tagline",
      "One minute. All the gold you can carry.",
      "lobby-tagline",
      intro,
    );
    const names = this.home.group("names", "player-card", intro);
    for (const id of ["player-name", "saved-player-name"])
      names.append(document.getElementById(id)!);
    this.home.end();
  }
  draw(s: UIState) {
    const notice = s.achievementNotice;
    this.toast.hidden = !notice || !!s.achievementsOpen;
    if (notice && this.toast.dataset.achievement !== notice.id) {
      this.toast.dataset.achievement = notice.id;
      this.toast.replaceChildren();
      for (const [className, value] of [
        ["eyebrow", "ACHIEVEMENT UNLOCKED"],
        ["toast-title", notice.title],
        ["menu-note", notice.description],
      ]) {
        const line = document.createElement("p");
        line.className = className;
        line.textContent = value;
        this.toast.append(line);
      }
    }
    const active =
      s.phase === "playing"
        ? s.locked
          ? null
          : this.pause
        : s.phase === "results"
          ? this.results
          : s.leaderboardOpen
            ? this.board
            : s.achievementsOpen
              ? this.achievements
              : this.home;
    for (const panel of [
      this.home,
      this.results,
      this.board,
      this.achievements,
      this.pause,
    ])
      if (panel !== active) panel.hide();
    if (!active) this.lastView = "";
    if (
      active &&
      document.body.classList.contains("casino-entered") &&
      active.root.id !== this.lastView
    ) {
      this.lastView = active.root.id;
      requestAnimationFrame(() => {
        if (
          document.body.classList.contains("casino-entered") &&
          !active.root.hidden
        ) {
          const id =
            active === this.achievements
              ? "achievements-open"
              : active === this.board
                ? "leaderboard-top"
                : "play";
          this.get(id)?.focus({ preventScroll: true });
        }
      });
    }
    const sound = this.get("sound");
    sound.style.display = s.phase === "playing" ? "none" : "";
    sound.textContent = s.muted ? "Sound off" : "Sound on";
    sound.setAttribute("aria-label", s.muted ? "Unmute sound" : "Mute sound");
    if (s.phase === "playing") {
      if (s.locked) return;
      const p = this.pause;
      p.begin();
      p.text("kicker", "TAKE A BREATHER", "eyebrow");
      p.heading("On the house.");
      p.text("hint", s.controlHint ?? "", "menu-note");
      p.button("play", this.get("play"), "RESUME", undefined, true);
      p.end();
      return;
    }
    if (s.phase === "results") this.drawResults(s);
    else if (s.leaderboardOpen) this.drawBoard(s);
    else if (s.achievementsOpen) this.drawAchievements(s);
    else this.drawHome(s);
  }
  private drawHome(s: UIState) {
    const p = this.home;
    p.begin();
    const grid = p.group("grid", "lobby-grid");
    const intro = p.group("intro", "lobby-intro", grid);
    p.text("eyebrow", "WELCOME TO THE GRAND CASINO", "eyebrow", intro);
    p.node("img", "logo", "", "lobby-logo", intro);
    p.text(
      "tagline",
      "One minute. All the gold you can carry.",
      "lobby-tagline",
      intro,
    );
    p.group("names", "player-card", intro);
    p.button("play", this.get("play"), "PLAY", intro, true);
    const actions = p.group("actions", "menu-actions", intro);
    p.button(
      "open-board",
      this.get("leaderboard-open"),
      "LEADERBOARD",
      actions,
    );
    p.button(
      "achievements",
      this.get("achievements-open"),
      "ACHIEVEMENTS",
      actions,
    );
    p.button("shop", this.get("workshop-open"), "SHOP", actions);
    p.button("account", this.get("account-open"), "ACCOUNT", actions);
    p.text(
      "controls",
      "60 seconds · Collect coins · Make a glorious mess",
      "menu-note",
      intro,
    );
    const board = p.group("board", "casino-panel lobby-board", grid);
    p.text("board-kicker", "THE HOUSE RECORDS", "eyebrow", board);
    p.node("h2", "board-heading", "High rollers", "", board);
    p.text("live", s.liveStatus ?? "CONNECTING", "live-status", board);
    const rows = p.node("ol", "rows", "", "standings", board);
    updateStandings(
      rows,
      (s.liveEntries ?? []).slice(0, 10),
      s.liveStatus === "CONNECTED"
        ? "No scores yet. Set the house record."
        : "Waiting for the house records…",
    );
    if (s.rankNotice) p.text("notice", s.rankNotice, "rank-notice", intro);
    if (s.error) p.text("error", s.error, "menu-error", intro);
    p.end();
  }
  private drawResults(s: UIState) {
    const p = this.results;
    p.begin();
    p.text("kicker", "THE COUNT IS IN", "eyebrow");
    p.heading("What a haul.");
    p.text("score", s.score.toLocaleString("en-US"), "result-score");
    p.text(
      "stats",
      `BEST ${(s.personalBest ?? s.best).toLocaleString("en-US")}${s.rank == null ? "" : `  /  RANK ${s.rank}`}`,
      "result-stats",
    );
    const actions = p.group("actions");
    p.button("play", this.get("play"), "PLAY AGAIN", actions, true);
    p.button("menu", this.get("main-menu"), "MAIN MENU", actions);
    p.button("shop", this.get("workshop-open"), "SHOP", actions);
    p.node("h2", "top", "Top 10");
    const rows = p.node("ol", "rows", "", "standings");
    updateStandings(
      rows,
      s.entries.slice(0, 10),
      s.loading ? "Loading leaderboard…" : s.leaderboardReadStatus,
    );
    if (s.canRetry && !s.loading)
      p.button("retry", this.get("retry-leaderboard"), s.retryLabel);
    if (s.error) p.text("error", s.error, "menu-error");
    p.end();
  }
  private drawBoard(s: UIState) {
    const p = this.board;
    p.begin();
    p.text("kicker", "THE HOUSE RECORDS", "eyebrow");
    p.heading("Leaderboard");
    const tabs = p.group("tabs");
    p.button("top", this.get("leaderboard-top"), "TOP 10", tabs).setAttribute(
      "aria-pressed",
      String(s.browseMode !== "around"),
    );
    p.button(
      "around",
      this.get("leaderboard-around"),
      "AROUND YOU",
      tabs,
    ).setAttribute("aria-pressed", String(s.browseMode === "around"));
    const rows = p.node("ol", "rows", "", "standings");
    updateStandings(
      rows,
      s.browseEntries ?? [],
      s.browseLoading
        ? "Loading leaderboard…"
        : (s.browseStatus ?? "No scores yet."),
    );
    p.text("status", s.browseStatus ?? "");
    const actions = p.group("actions");
    if (s.browseCanRetry && !s.browseLoading)
      p.button(
        "retry",
        this.get("retry-leaderboard"),
        "RETRY RANKINGS",
        actions,
      );
    p.button("back", this.get("leaderboard-back"), "BACK", actions);
    p.end();
  }
  private drawAchievements(s: UIState) {
    const p = this.achievements;
    p.begin();
    p.text("kicker", "A LITTLE SOMETHING TO SHOW FOR IT", "eyebrow");
    p.heading("Achievements");
    const list = p.group("list", "achievement-list");
    for (const a of s.achievements ?? []) {
      const row = p.group(
        `row-${a.id}`,
        `achievement-card${a.unlocked ? " unlocked" : ""}`,
        list,
      );
      p.node("h2", `title-${a.id}`, a.title, "", row);
      p.text(`desc-${a.id}`, a.description, "menu-note", row);
      p.text(
        `state-${a.id}`,
        a.unlocked ? "UNLOCKED" : "LOCKED",
        "eyebrow",
        row,
      );
    }
    p.text("status", s.achievementStatus ?? "");
    p.button("back", this.get("achievements-open"), "BACK");
    p.end();
  }
  hide() {
    for (const p of [
      this.home,
      this.results,
      this.board,
      this.achievements,
      this.pause,
    ])
      p.hide();
  }
}
