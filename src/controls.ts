export interface ControllerState {
  connected: boolean;
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  vacuum: boolean;
  jump: boolean;
  menu: boolean;
  confirm: boolean;
}
function axis(value = 0) {
  if (!Number.isFinite(value) || Math.abs(value) <= 0.18) return 0;
  return Math.sign(value) * Math.min(1, (Math.abs(value) - 0.18) / 0.82);
}
export class GamepadControls {
  private index = -1;
  private previous = new Set<number>();
  poll(pads: readonly (Gamepad | null)[]): ControllerState {
    const standard = pads.filter(
      (pad): pad is Gamepad => !!pad?.connected && pad.mapping === "standard",
    );
    const used = standard.find(
      (pad) =>
        pad.buttons.some((b) => b.pressed) ||
        pad.axes.some((a) => Math.abs(a) > 0.3),
    );
    const pad =
      used ?? standard.find((pad) => pad.index === this.index) ?? standard[0];
    if (!pad || pad.index !== this.index) this.previous.clear();
    this.index = pad?.index ?? -1;
    const down = new Set(
      pad?.buttons.flatMap((b, i) => (b.pressed || b.value > 0.5 ? [i] : [])) ??
        [],
    );
    const edge = (button: number) =>
      down.has(button) && !this.previous.has(button);
    const state = {
      connected: !!pad,
      moveX: axis(pad?.axes[0]),
      moveY: -axis(pad?.axes[1]),
      lookX: axis(pad?.axes[2]),
      lookY: axis(pad?.axes[3]),
      vacuum: down.has(7),
      jump: edge(0),
      confirm: edge(0),
      menu: edge(9),
    };
    this.previous = down;
    return state;
  }
}
export type TouchAction = "move" | "look";
export class TouchInput {
  moveX = 0;
  moveY = 0;
  vacuum = false;
  private pointers = new Map<
    TouchAction,
    {
      id: number;
      x: number;
      y: number;
      startX: number;
      startY: number;
      startedAt: number;
      dragged: boolean;
    }
  >();
  private taps = new Map<
    TouchAction,
    { x: number; y: number; endedAt: number }
  >();
  private dx = 0;
  private dy = 0;
  private jump = false;
  begin(
    action: TouchAction,
    id: number,
    x: number,
    y: number,
    now = performance.now(),
  ): boolean {
    if (this.pointers.has(action)) return false;
    this.pointers.set(action, {
      id,
      x,
      y,
      startX: x,
      startY: y,
      startedAt: now,
      dragged: false,
    });
    if (action === "look") this.vacuum = true;
    return true;
  }
  move(id: number, x: number, y: number) {
    for (const [action, pointer] of this.pointers) {
      if (pointer.id !== id) continue;
      if (Math.hypot(x - pointer.startX, y - pointer.startY) > 16)
        pointer.dragged = true;
      const dx = x - pointer.x,
        dy = y - pointer.y;
      if (action === "move") {
        const radius = Math.max(48, Math.hypot(dx, dy));
        this.moveX = dx / radius;
        this.moveY = -dy / radius;
      } else {
        this.dx += dx;
        this.dy += dy;
        pointer.x = x;
        pointer.y = y;
      }
    }
  }
  end(id: number, now = performance.now(), cancelled = false): boolean {
    for (const [action, pointer] of this.pointers) {
      if (pointer.id !== id) continue;
      this.pointers.delete(action);
      // Only completed, short taps qualify. Track each side independently so
      // two thumbs touching together cannot accidentally jump.
      const previous = this.taps.get(action);
      this.taps.delete(action);
      if (!cancelled && !pointer.dragged && now - pointer.startedAt <= 250) {
        if (
          previous &&
          pointer.startedAt - previous.endedAt <= 300 &&
          Math.hypot(
            pointer.startX - previous.x,
            pointer.startY - previous.y,
          ) <= 32
        ) {
          this.jump = true;
        } else {
          this.taps.set(action, {
            x: pointer.startX,
            y: pointer.startY,
            endedAt: now,
          });
        }
      }
      if (action === "move") this.moveX = this.moveY = 0;
      if (action === "look") this.vacuum = false;
      return true;
    }
    return false;
  }
  consumeLook(): [number, number] {
    const look: [number, number] = [this.dx, this.dy];
    this.dx = this.dy = 0;
    return look;
  }
  consumeJump() {
    const jump = this.jump;
    this.jump = false;
    return jump;
  }
  clear() {
    this.pointers.clear();
    this.taps.clear();
    this.moveX = this.moveY = this.dx = this.dy = 0;
    this.vacuum = this.jump = false;
  }
}
