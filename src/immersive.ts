type OrientationLock = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
};
export class ImmersiveDisplay {
  constructor(private mobile: boolean) {}
  async enter(): Promise<boolean> {
    try {
      if (!document.fullscreenElement) {
        if (!document.documentElement.requestFullscreen) return false;
        await document.documentElement.requestFullscreen({
          navigationUI: "hide",
        });
      }
    } catch {
      return false;
    }
    if (this.mobile) {
      try {
        await (screen.orientation as OrientationLock | undefined)?.lock?.(
          "landscape",
        );
      } catch {
        /* A rotate prompt handles browsers without orientation locking. */
      }
    }
    return true;
  }
  async toggle(): Promise<boolean> {
    if (!document.fullscreenElement) return this.enter();
    try {
      screen.orientation?.unlock?.();
      await document.exitFullscreen();
      return true;
    } catch {
      return false;
    }
  }
}
