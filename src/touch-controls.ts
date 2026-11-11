import { TouchInput, type TouchAction } from "./controls";

export class TouchControls {
  readonly input = new TouchInput();
  private enabled = false;
  constructor(private root: HTMLElement) {
    for (const target of Array.from(
      root.querySelectorAll<HTMLElement>("[data-touch]"),
    )) {
      target.addEventListener("pointerdown", (event) => {
        if (!this.enabled || event.pointerType === "mouse") return;
        event.preventDefault();
        const action = target.dataset.touch as TouchAction;
        if (
          !this.input.begin(
            action,
            event.pointerId,
            event.clientX,
            event.clientY,
            event.timeStamp,
          )
        )
          return;
        target.setPointerCapture(event.pointerId);
        target.dataset.held = "true";
      });
      target.addEventListener("pointermove", (event) => {
        if (!this.enabled) return;
        this.input.move(event.pointerId, event.clientX, event.clientY);
      });
      const release = (event: PointerEvent) => {
        const cancelled = event.type !== "pointerup";
        if (!cancelled)
          this.input.move(event.pointerId, event.clientX, event.clientY);
        if (this.input.end(event.pointerId, event.timeStamp, cancelled))
          delete target.dataset.held;
      };
      target.addEventListener("pointerup", release);
      target.addEventListener("pointercancel", release);
      target.addEventListener("lostpointercapture", release);
    }
  }
  show(enabled: boolean) {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    this.root.hidden = !enabled;
    if (!enabled) this.clear();
  }
  clear() {
    this.input.clear();
    for (const target of Array.from(
      this.root.querySelectorAll<HTMLElement>("[data-held]"),
    ))
      delete target.dataset.held;
  }
}
