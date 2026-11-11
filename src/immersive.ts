type OrientationLock = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
};
type WebKitElement = {
  requestFullscreen?: (options?: FullscreenOptions) => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type WebKitDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};

export class ImmersiveDisplay {
  private pending: Promise<boolean> | null = null;

  constructor(private mobile: boolean) {}

  get transitioning(): boolean {
    return this.pending !== null;
  }

  get standalone(): boolean {
    return (
      (typeof navigator !== "undefined" &&
        (navigator as Navigator & { standalone?: boolean }).standalone ===
          true) ||
      (typeof matchMedia === "function" &&
        (matchMedia("(display-mode: standalone)").matches ||
          matchMedia("(display-mode: fullscreen)").matches))
    );
  }

  get active(): boolean {
    return !!(
      document.fullscreenElement ||
      (document as WebKitDocument).webkitFullscreenElement
    );
  }

  get supported(): boolean {
    const root = document.documentElement as WebKitElement;
    return !!(
      (root.requestFullscreen && document.fullscreenEnabled !== false) ||
      (root.webkitRequestFullscreen &&
        (document as WebKitDocument).webkitFullscreenEnabled !== false)
    );
  }

  get fallbackMessage(): string {
    if (this.standalone) return "Already playing from your Home Screen.";
    const appleMobile =
      typeof navigator !== "undefined" &&
      (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    return appleMobile
      ? "For a view without browser bars, open in Safari, tap Share → Add to Home Screen, then launch VACCOIN there."
      : "Fullscreen unavailable. You can still play in this browser.";
  }

  async enter(): Promise<boolean> {
    if (this.pending) return this.pending;
    this.pending = this.enterOnce().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  async whenSettled(): Promise<void> {
    await this.pending;
  }

  private transition(
    request: () => Promise<void> | void,
    active: boolean,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const changed = () => finish(this.active === active);
      const failed = () => finish(false);
      const finish = (ok: boolean) => {
        clearTimeout(timeout);
        document.removeEventListener?.("fullscreenchange", changed);
        document.removeEventListener?.("webkitfullscreenchange", changed);
        document.removeEventListener?.("fullscreenerror", failed);
        document.removeEventListener?.("webkitfullscreenerror", failed);
        resolve(ok);
      };
      // A rejected or stalled browser transition must not hold the Play action.
      const timeout = setTimeout(failed, 1500);
      document.addEventListener?.("fullscreenchange", changed);
      document.addEventListener?.("webkitfullscreenchange", changed);
      document.addEventListener?.("fullscreenerror", failed);
      document.addEventListener?.("webkitfullscreenerror", failed);
      try {
        const result = request();
        if (result) void result.then(() => finish(true), failed);
        else if (this.active === active) finish(true);
      } catch {
        failed();
      }
    });
  }

  private async enterOnce(): Promise<boolean> {
    try {
      if (!this.active && !this.standalone) {
        if (!this.supported) return false;
        const root = document.documentElement as WebKitElement;
        const ok = await this.transition(
          () =>
            root.requestFullscreen && document.fullscreenEnabled !== false
              ? root.requestFullscreen({ navigationUI: "hide" })
              : root.webkitRequestFullscreen!(),
          true,
        );
        if (!ok) return false;
      }
    } catch {
      return false;
    }
    if (this.mobile) {
      try {
        // Some browsers never settle this optional request. Gameplay must not wait.
        void (screen.orientation as OrientationLock | undefined)
          ?.lock?.("landscape")
          .catch(() => {});
      } catch {
        /* A rotate prompt handles browsers without orientation locking. */
      }
    }
    return true;
  }
  async toggle(): Promise<boolean> {
    if (this.pending) return this.pending;
    if (!this.active) return this.enter();
    this.pending = this.exitOnce().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private async exitOnce(): Promise<boolean> {
    try {
      screen.orientation?.unlock?.();
    } catch {
      /* Orientation support must not prevent leaving fullscreen. */
    }
    try {
      const doc = document as WebKitDocument;
      if (document.fullscreenElement && document.exitFullscreen) {
        return await this.transition(() => document.exitFullscreen(), false);
      } else if (doc.webkitExitFullscreen) {
        return await this.transition(() => doc.webkitExitFullscreen!(), false);
      } else {
        return false;
      }
    } catch {
      return false;
    }
  }
}
