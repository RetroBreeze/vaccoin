import type { Accounts } from "./accounts";
import type { UI } from "./ui";
import type { SwitchStrategy } from "@supagame/sdk-ts";
import { MenuSurface } from "./menu-surface";
import { emptyProgress, validateProgress } from "./workshop-state";
/** Account actions and confirmations in a scrolling native menu. */
export class AccountUI {
  private panel = new MenuSurface("account-menu");
  private deletionNotice = document.createElement("div");
  private buttons = new Map<string, HTMLButtonElement>();
  private confirm?: SwitchStrategy | "signOut" | "deleteSave";
  constructor(
    private ui: UI,
    readonly account: Accounts,
    private toggle: () => void,
  ) {
    this.deletionNotice.id = "account-delete-description";
    this.deletionNotice.textContent =
      "Delete Cloud Save removes cosmetic purchases and selections, wallet, total coins earned, completed runs, mute preference and saved operation records. Local saves and pending uploads are discarded. Leaderboards, achievements and your account remain unaffected. Historical backups may remain recoverable: up to five revisions for 30 days. This is not permanent erasure. A reset marker remains to block old uploads. Reload other devices with the updated game before playing. Choose Start Fresh after deletion.";
    Object.assign(this.deletionNotice.style, {
      position: "fixed",
      left: "-10000px",
      width: "1px",
      height: "1px",
      overflow: "hidden",
    });
    document.body.append(this.deletionNotice);
    const actions: Record<string, () => void> = {
      deleteSave: () => {
        this.confirm = "deleteSave";
      },
      startFresh: () => void account.startFresh(),
      review: () => void account.reviewLatest(),
      open: () => {
        account.open = true;
        this.toggle();
        requestAnimationFrame(() =>
          this.buttons.get("back")!.focus({ preventScroll: true }),
        );
        void account.refresh().catch(() => {});
      },
      back: () => {
        account.open = false;
        this.confirm = undefined;
        requestAnimationFrame(() => this.buttons.get("open")!.focus());
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
        if (this.confirm === "deleteSave") void account.deleteCloudSave();
        else if (this.confirm === "signOut") void account.signOut();
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
  draw(_titleVisible: boolean) {
    const p = this.panel;
    const a = this.account;
    this.deletionNotice.hidden = !a.open || this.confirm !== "deleteSave";
    if (!a.open) {
      p.hide();
      return;
    }
    p.begin();
    p.text("kicker", "YOUR SEAT AT THE TABLE", "eyebrow");
    p.heading(
      a.review
        ? "Account already exists"
        : a.status.providers.includes("google")
          ? "Google account linked"
          : a.status.isAnonymous
            ? "Guest account"
            : "Account",
    );
    if (a.email) p.text("email", a.email, "account-email").id = "account-email";
    const pending: [string, string][] = [];
    const button = (id: string, label: string) => {
      pending.push([id, label]);
      return this.buttons.get(id)!;
    };
    const confirmButton = this.buttons.get("confirm")!;
    confirmButton.removeAttribute("aria-describedby");
    if (this.confirm === "deleteSave") {
      p.node("h2", "confirm-heading", "Delete cloud save?");
      p.text(
        "deletion",
        this.deletionNotice.textContent!,
        "deletion-description",
      );
      button("confirm", "DELETE CLOUD SAVE").setAttribute(
        "aria-describedby",
        this.deletionNotice.id,
      );
      button("decline", "CANCEL");
    } else if (this.confirm) {
      p.node(
        "h2",
        "confirm-heading",
        this.confirm === "signOut"
          ? "Sign out on this device?"
          : "Replace Google cloud progress?",
      );
      p.text(
        "confirm-note",
        this.confirm === "signOut"
          ? "Guest copies remain on this device."
          : "Cloud backup: 30 days / last 5 per slot",
      );
      p.text("transfer", "Scores and achievements will not transfer.");
      if (this.confirm === "merge") {
        p.text(
          "economy",
          `Choose wallet, statistics and equipment. Selected: ${a.economy === "cloud" ? "Google" : "Guest"}`,
          "wallet-badge",
        );
        button("cloudWallet", "USE GOOGLE WALLET");
        button("guestWallet", "USE GUEST WALLET");
      }
      button("confirm", "CONFIRM");
      button("decline", "GO BACK");
    } else if (a.review) {
      p.text("review-question", "Which progress would you like to use?");
      p.text("signed-in", "Signed in to Google. Keep Google skips import.");
      const comparison = p.group("comparison", "save-comparison");
      const slot = a.review.slots.find((s) => s.slot === "vacuum-workshop");
      for (const [i, value] of [slot?.guest, slot?.cloud].entries()) {
        const card = p.group(`save-${i}`, "casino-panel", comparison);
        p.node("h2", `save-heading-${i}`, i ? "Google" : "Guest", "", card);
        try {
          const progress = value?.data
            ? validateProgress(value.data)
            : emptyProgress();
          p.text(
            `save-data-${i}`,
            `Wallet ${progress.wallet} · Earned ${progress.totalCoinsEarned} · Runs ${progress.completedRuns} · Designs ${progress.owned.length} · Equipped ${progress.equipped}`,
            "menu-note",
            card,
          );
        } catch {
          p.text(
            `save-data-${i}`,
            "Invalid save. Export to recover.",
            "menu-error",
            card,
          );
        }
      }
      if (a.needsReview) {
        p.text(
          "changed",
          "Remote save changed. Review before retry.",
          "menu-error",
        );
        button("review", "REVIEW LATEST CLOUD");
      } else {
        button("cloud", "KEEP GOOGLE PROGRESS");
        button("guest", "KEEP GUEST PROGRESS");
        button("merge", "MERGE PROGRESS");
        button("defer", "DECIDE LATER / STAY SIGNED IN");
      }
      button("export", "EXPORT RECOVERY");
    } else {
      p.text(
        "help",
        a.status.isAnonymous
          ? "Link to keep this player ID and progress."
          : "Play anonymously or recover an account.",
      );
      if (a.status.isAnonymous) {
        button("link", "LINK GOOGLE");
        button("signIn", "SIGN IN WITH GOOGLE");
      } else if (a.status.userId) {
        p.text("providers", "Linked: " + a.status.providers.join(", "));
        button("signOut", "SIGN OUT");
      } else button("signIn", "SIGN IN WITH GOOGLE");
      if (a.status.userId) {
        button("deleteSave", "DELETE CLOUD SAVE");
        if (a.canStartFresh) button("startFresh", "START FRESH");
      }
      button(
        "back",
        a.status.isAnonymous ? "RETURN TO GUEST GAME" : "BACK TO GAME",
      );
    }
    p.text("status", a.busy ? "Working. Please wait…" : a.message, "menu-note");
    const actions = p.group("actions", "account-actions");
    for (const [id, label] of pending) {
      p.button(id, this.buttons.get(id)!, label, actions).disabled = a.busy;
    }
    p.end();
  }
}
