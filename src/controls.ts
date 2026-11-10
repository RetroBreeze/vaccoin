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
export type TouchAction = "move" | "look" | "jump" | "vacuum";
export class TouchInput {
  moveX = 0;
  moveY = 0;
  vacuum = false;
  private pointers = new Map<
    TouchAction,
    { id: number; x: number; y: number }
  >();
  private dx = 0;
  private dy = 0;
  private jump = false;
  begin(action: TouchAction, id: number, x: number, y: number): boolean {
    if (this.pointers.has(action)) return false;
    this.pointers.set(action, { id, x, y });
    if (action === "jump") this.jump = true;
    if (action === "vacuum") this.vacuum = true;
    return true;
  }
  move(id: number, x: number, y: number) {
    for (const [action, pointer] of this.pointers) {
      if (pointer.id !== id) continue;
      const dx = x - pointer.x,
        dy = y - pointer.y;
      if (action === "move") {
        const radius = Math.max(48, Math.hypot(dx, dy));
        this.moveX = dx / radius;
        this.moveY = -dy / radius;
      } else if (
        action === "look" ||
        action === "vacuum" ||
        action === "jump"
      ) {
        this.dx += dx;
        this.dy += dy;
        pointer.x = x;
        pointer.y = y;
      }
    }
  }
  end(id: number): boolean {
    for (const [action, pointer] of this.pointers) {
      if (pointer.id !== id) continue;
      this.pointers.delete(action);
      if (action === "move") this.moveX = this.moveY = 0;
      if (action === "vacuum") this.vacuum = false;
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
    this.moveX = this.moveY = this.dx = this.dy = 0;
    this.vacuum = this.jump = false;
  }
}
