import {
  AccountError,
  SaveConflictError,
  type AccountStatus,
  type AccountTransition,
  type GameServices,
  type SwitchReview,
  type SwitchStrategy,
} from "@supagame/sdk-ts";
import type { Workshop } from "./workshop";
import { mergeWorkshop } from "./account-merge";
import { emptyProgress } from "./workshop-state";
interface Environment {
  url: () => string;
  navigate: (url: string) => void;
  replace: (url: string) => void;
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
}
export class Accounts {
  status: AccountStatus = { userId: null, isAnonymous: false, providers: [] };
  message = "PLAY AS A GUEST OR SIGN IN";
  busy = false;
  open = false;
  needsReview = false;
  transition?: AccountTransition;
  review?: SwitchReview;
  economy: "guest" | "cloud" = "cloud";
  private key: string;
  constructor(
    private game: GameServices | undefined,
    private workshop: Workshop,
    namespace: string,
    private env: Environment = {
      url: () => location.href,
      navigate: (url) => location.assign(url),
      replace: (url) => history.replaceState(null, "", url),
      storage: localStorage,
    },
  ) {
    this.key = `vaccoin.account-flow:${namespace}`;
  }
  private report(error: unknown) {
    if (error instanceof SaveConflictError) this.needsReview = true;
    this.message =
      error instanceof AccountError
        ? `${error.code}: ${error.message}`
        : error instanceof Error
          ? error.message
          : "ACCOUNT UNAVAILABLE / PROGRESS RETAINED";
  }
  async refresh() {
    if (this.game) this.status = await this.game.players.getAuthStatus();
  }
  async initialize() {
    if (!this.game) {
      this.message = "BACKEND NOT CONFIGURED / LOCAL PLAY AVAILABLE";
      return;
    }
    this.busy = true;
    const url = new URL(this.env.url());
    let pending: { flowId: string; transition?: AccountTransition } | null =
      null;
    const callbackHash = new URLSearchParams(url.hash.slice(1));
    const hasCallback =
      ["sg_flow", "code", "error", "error_code"].some((key) =>
        url.searchParams.has(key),
      ) ||
      callbackHash.has("error") ||
      callbackHash.has("error_code");
    try {
      const stored = this.env.storage.getItem(this.key);
      if (stored) pending = JSON.parse(stored);
      if (hasCallback) {
        const result = await this.game.players.handleAuthCallback(url.href);
        const transition = result.transitionId
          ? await this.game.saves.pendingAccountSwitch()
          : null;
        pending = {
          flowId: result.flowId,
          ...(transition ? { transition } : {}),
        };
        this.env.storage.setItem(this.key, JSON.stringify(pending));
        // Supabase has already consumed the code. Never retain it in the address bar.
        this.env.replace(url.origin + url.pathname);
        this.message =
          result.operation === "link"
            ? "GOOGLE LINKED / PLAYER ID PRESERVED"
            : "ACCOUNT RESTORED";
      }
      await this.refresh();
      if (
        pending?.transition &&
        this.status.userId !== pending.transition.sourcePlayerId
      ) {
        this.transition = pending.transition;
        await this.workshop.pauseForAccount();
        this.review = await this.game.saves.inspectAccountSwitch(
          this.transition,
          { flowId: pending.flowId },
        );
        this.open = true;
        this.message = "CHOOSE PROGRESS / BOTH COPIES ARE RETAINED";
      } else if (pending) {
        if (pending.transition && this.status.isAnonymous) {
          await this.game.players.cancelAuthFlow(pending.flowId);
          this.transition = pending.transition;
          this.workshop.resumeAfterAccount();
          this.message = "SIGN-IN STOPPED / STILL GUEST / SNAPSHOT RETAINED";
          this.open = true;
        }
        this.env.storage.removeItem(this.key);
      }
    } catch (error) {
      this.open = true;
      this.report(error);
      // A cancelled provider flow can resume only the verified original guest.
      // Once Google replaced that session we deliberately have no guest credentials.
      try {
        await this.refresh();
        if (
          pending?.transition &&
          this.status.isAnonymous &&
          this.status.userId === pending.transition.sourcePlayerId
        ) {
          await this.game.players.cancelAuthFlow(pending.flowId);
          this.transition = pending.transition;
          this.env.storage.removeItem(this.key);
          this.workshop.resumeAfterAccount();
          this.message += " / STILL GUEST / SNAPSHOT RETAINED";
        } else if (pending?.transition) {
          await this.workshop.pauseForAccount();
          this.message += " / VERIFY SIGNED-IN ACCOUNT BEFORE CONTINUING";
        }
      } catch {
        /* Keep the marker and pause until identity can be verified. */
      }
    } finally {
      if (hasCallback) this.env.replace(url.origin + url.pathname);
      this.busy = false;
    }
  }
  async start(operation: "link" | "signIn") {
    if (!this.game || this.busy) return;
    this.busy = true;
    try {
      await this.refresh();
      await this.workshop.pauseForAccount();
      const redirectTo =
        new URL(this.env.url()).origin + new URL(this.env.url()).pathname;
      if (operation === "signIn" && this.status.isAnonymous) {
        const local = await this.workshop.prepareAccountSnapshot();
        this.transition = await this.game.saves.prepareAccountSwitch({
          local: [local],
        });
      }
      const options = {
        redirectTo,
        ...(operation === "signIn" && this.transition
          ? { transitionId: this.transition.id }
          : {}),
      };
      const flow = await (operation === "link"
        ? this.game.players.linkProvider("google", options)
        : this.game.players.signInWithProvider("google", options));
      this.env.storage.setItem(
        this.key,
        JSON.stringify({
          flowId: flow.flowId,
          ...(operation === "signIn" && this.transition
            ? { transition: this.transition }
            : {}),
        }),
      );
      this.env.navigate(flow.url);
    } catch (error) {
      this.workshop.resumeAfterAccount();
      this.report(error);
      this.busy = false;
    }
  }
  async resolve(strategy: SwitchStrategy, confirmed: boolean) {
    if (!this.game || !this.transition || !this.review || this.busy) return;
    if (!confirmed) {
      this.message = "CONFIRM BEFORE CHANGING SAVES";
      return;
    }
    this.busy = true;
    try {
      const result = await this.game.saves.resolveAccountSwitch(
        this.transition,
        {
          strategy,
          confirmed: true,
          targetPlayerId: this.review.targetPlayerId,
          backupExisting: true,
          ...(strategy === "merge"
            ? {
                merge: ({ guest, cloud }) => ({
                  slot: guest?.slot ?? cloud!.slot,
                  kind: "json",
                  schemaVersion: 1,
                  data: mergeWorkshop(
                    guest?.data ?? emptyProgress(),
                    cloud?.data ?? emptyProgress(),
                    this.economy,
                  ),
                }),
              }
            : {}),
        },
      );
      if (result.status === "deferred") {
        this.message =
          "STILL SIGNED IN TO GOOGLE / DECISION PAUSED / GUEST COPY RETAINED";
        return;
      }
      await this.workshop.acceptAccountCloud();
      this.env.storage.removeItem(this.key);
      this.review = undefined;
      this.open = false;
      this.message =
        strategy === "keepCloud"
          ? "GOOGLE PROGRESS READY / GUEST IMPORT SKIPPED / GUEST COPY RETAINED"
          : "GOOGLE ACCOUNT READY / CLOUD BACKUP + GUEST COPY RETAINED";
    } catch (error) {
      this.report(error);
    } finally {
      this.busy = false;
    }
  }
  async reviewLatest() {
    if (!this.game || !this.transition || this.busy) return;
    this.busy = true;
    try {
      const pending = JSON.parse(this.env.storage.getItem(this.key) ?? "null");
      if (!pending?.flowId)
        throw new Error("RESTORE SIGN-IN FLOW BEFORE REVIEWING");
      this.review = await this.game.saves.inspectAccountSwitch(
        this.transition,
        { flowId: pending.flowId, restart: true },
      );
      this.needsReview = false;
      this.message = "LATEST CLOUD LOADED / CHOOSE AGAIN / OLD BACKUP RETAINED";
    } catch (error) {
      this.report(error);
    } finally {
      this.busy = false;
    }
  }
  async signOut() {
    if (!this.game || this.busy) return;
    this.busy = true;
    try {
      await this.workshop.pauseForAccount();
      await this.game.players.signOut();
      this.env.navigate(
        new URL(this.env.url()).origin + new URL(this.env.url()).pathname,
      );
    } catch (error) {
      this.report(error);
      this.busy = false;
      this.workshop.resumeAfterAccount();
    }
  }
  async exportRecovery() {
    if (!this.game || !this.transition) return;
    const data = await this.game.saves.getAccountSwitchRecovery(
      this.transition,
    );
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "vaccoin-account-recovery.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
