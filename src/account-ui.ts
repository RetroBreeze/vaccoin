import type { Accounts } from "./accounts";
import type { UI } from "./ui";
import type { SwitchStrategy } from "@supagame/sdk-ts";
import { pixelText, textWidth } from "./pixel-font";
import { emptyProgress, validateProgress } from "./workshop-state";
/** Native hit targets mirror Canvas controls for keyboard/touch accessibility. */
export class AccountUI {
  private buttons = new Map<string, HTMLButtonElement>();
  private confirm?: SwitchStrategy | "signOut";
  constructor(
    private ui: UI,
    readonly account: Accounts,
    private toggle: () => void,
  ) {
    const actions: Record<string, () => void> = {
      review: () => void account.reviewLatest(),
      open: () => {
        account.open = true;
        this.toggle();
        void account.refresh().catch(() => {});
      },
      back: () => {
        account.open = false;
      },
      link: () => void account.start("link"),
      signIn: () => void account.start("signIn"),
      signOut: () => {
        this.confirm = "signOut";
      },
      cloud: () => void account.resolve("keepCloud", true),
      guest: () => {
        this.confirm = "keepGuest";
      },
      merge: () => {
        this.confirm = "merge";
      },
      defer: () => void account.resolve("defer", true),
      cloudWallet: () => {
        account.economy = "cloud";
      },
      guestWallet: () => {
        account.economy = "guest";
      },
      confirm: () => {
        if (this.confirm === "signOut") void account.signOut();
        else if (this.confirm) void account.resolve(this.confirm, true);
        this.confirm = undefined;
      },
      decline: () => {
        this.confirm = undefined;
      },
      export: () =>
        void account.exportRecovery().catch(() => {
          account.message = "EXPORT FAILED / COPY RETAINED";
        }),
    };
    for (const [id, action] of Object.entries(actions)) {
      const b = document.createElement("button");
      b.id = `account-${id}`;
      b.className = "leaderboard-control";
      b.style.display = "none";
      b.onclick = action;
      document.body.append(b);
      this.buttons.set(id, b);
    }
  }
  draw(titleVisible: boolean) {
    for (const b of this.buttons.values()) b.style.display = "none";
    const { ctx: c, w } = this.ui,
      cx = w / 2;
    const text = (
      t: string,
      x: number,
      y: number,
      size = 1,
      color = "#fff2d2",
      maxWidth = Infinity,
    ) => {
      // Compensate the existing portrait canvas stretch for readable account text.
      const scale = Math.max(1, innerHeight / 540 / (innerWidth / w));
      const available = Math.min(maxWidth, x === cx ? w - 32 : w / 2 - 24);
      c.save();
      c.translate(x, y);
      c.scale(Math.min(scale, available / Math.max(1, textWidth(t, size))), 1);
      pixelText(c, t, 0, 0, size, color, "center");
      c.restore();
    };
    const button = (
      id: string,
      label: string,
      x: number,
      y: number,
      width = 260,
    ) => {
      const b = this.buttons.get(id)!;
      b.textContent = label;
      b.disabled = this.account.busy;
      Object.assign(b.style, {
        display: "block",
        left: `${(x / w) * 100}%`,
        top: `${(y / 540) * 100}%`,
        width: `${(width / w) * 100}%`,
        height: `${(34 / 540) * 100}%`,
        zIndex: "20",
      });
      c.fillStyle = this.account.busy ? "#203644" : "#28505d";
      c.fillRect(x, y, width, 34);
      c.fillStyle = "#8cf0d1";
      c.fillRect(x, y, width, 2);
      text(label, x + width / 2, y + 14, 1, "#fff2d2", width - 16);
    };
    if (!this.account.open) {
      if (titleVisible)
        button("open", "ACCOUNT", w < 800 ? cx - 60 : 40, 508, 120);
      return;
    }
    c.fillStyle = "#0b2030";
    c.fillRect(0, 0, w, 540);
    const a = this.account;
    text(
      a.review
        ? "ACCOUNT ALREADY EXISTS"
        : a.status.providers.includes("google")
          ? "GOOGLE ACCOUNT LINKED"
          : a.status.isAnonymous
            ? "GUEST ACCOUNT"
            : "ACCOUNT",
      cx,
      36,
      2,
      "#ffcf58",
    );
    if (this.confirm) {
      text(
        this.confirm === "signOut"
          ? "SIGN OUT ON THIS DEVICE?"
          : "REPLACE GOOGLE CLOUD PROGRESS?",
        cx,
        100,
        1,
        "#ffcf58",
      );
      text(
        this.confirm === "signOut"
          ? "GUEST COPIES REMAIN ON THIS DEVICE."
          : "CLOUD BACKUP: 30 DAYS / LAST 5 PER SLOT",
        cx,
        130,
      );
      text("SCORES AND ACHIEVEMENTS WILL NOT TRANSFER.", cx, 153);
      if (this.confirm === "merge") {
        text("CHOOSE WALLET + STATISTICS + EQUIPMENT", cx, 195);
        text(
          `SELECTED: ${a.economy === "cloud" ? "GOOGLE" : "GUEST"}`,
          cx,
          220,
          1,
          "#8cf0d1",
        );
        button("cloudWallet", "USE GOOGLE WALLET", cx - 130, 250);
        button("guestWallet", "USE GUEST WALLET", cx - 130, 294);
      }
      button("confirm", "CONFIRM", cx - 130, 370);
      button("decline", "GO BACK", cx - 130, 414);
      return;
    }
    if (a.review) {
      text("WHICH PROGRESS WOULD YOU LIKE TO USE?", cx, 60);
      text(
        "SIGNED IN TO GOOGLE / KEEP GOOGLE SKIPS IMPORT",
        cx,
        78,
        1,
        "#8cf0d1",
      );
      const slot = a.review.slots.find((s) => s.slot === "vacuum-workshop");
      for (const [i, value] of [slot?.guest, slot?.cloud].entries()) {
        const x = cx + (i ? 1 : -1) * Math.min(160, w / 4);
        let p = emptyProgress();
        try {
          if (value?.data) p = validateProgress(value.data);
        } catch {
          text("INVALID SAVE / EXPORT TO RECOVER", x, 110);
          continue;
        }
        text(i ? "GOOGLE" : "GUEST", x, 100, 1, "#8cf0d1");
        const lines = [
          `WALLET ${p.wallet}`,
          `EARNED ${p.totalCoinsEarned}`,
          `RUNS ${p.completedRuns}`,
          `DESIGNS ${p.owned.length}`,
          `EQUIPPED ${p.equipped.toUpperCase()}`,
        ];
        lines.forEach((line, n) => text(line, x, 124 + n * 23));
      }
      if (a.needsReview) {
        button("review", "REVIEW LATEST CLOUD", cx - 130, 255);
        button("export", "EXPORT RECOVERY", cx - 130, 310);
        text("REMOTE SAVE CHANGED. REVIEW BEFORE RETRY.", cx, 370);
        return;
      }
      button("cloud", "KEEP GOOGLE PROGRESS", cx - 130, 255);
      button("guest", "KEEP GUEST PROGRESS", cx - 130, 299);
      button("merge", "MERGE PROGRESS", cx - 130, 343);
      button("defer", "DECIDE LATER / STAY SIGNED IN", cx - 130, 387);
      button("export", "EXPORT RECOVERY", cx - 130, 431);
    } else {
      text(
        a.status.isAnonymous
          ? "LINK TO KEEP THIS PLAYER ID AND PROGRESS."
          : "PLAY ANONYMOUSLY OR RECOVER AN ACCOUNT.",
        cx,
        100,
      );
      if (a.status.isAnonymous) {
        button("link", "LINK GOOGLE", cx - 130, 150);
        text("ALREADY HAVE AN ACCOUNT?", cx, 211);
        button("signIn", "SIGN IN WITH GOOGLE", cx - 130, 234);
      } else if (a.status.userId) {
        text("LINKED: " + a.status.providers.join(", ").toUpperCase(), cx, 145);
        button("signOut", "SIGN OUT", cx - 130, 210);
      } else button("signIn", "SIGN IN WITH GOOGLE", cx - 130, 180);
      button(
        "back",
        a.status.isAnonymous ? "RETURN TO GUEST GAME" : "BACK TO GAME",
        cx - 130,
        360,
      );
    }
    const max = Math.max(24, Math.floor((w - 40) / 6));
    const message = a.busy ? "WORKING / PLEASE WAIT" : a.message.toUpperCase();
    for (let i = 0; i < 3; i++)
      text(
        message.slice(i * max, (i + 1) * max),
        cx,
        485 + i * 14,
        1,
        "#96b6c2",
      );
  }
}
