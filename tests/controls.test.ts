import { expect, it } from "vitest";
import { GamepadControls, TouchInput } from "../src/controls";
function pad(
  axes: number[] = [0, 0, 0, 0],
  pressed: number[] = [],
  index = 0,
): Gamepad {
  return {
    index,
    connected: true,
    mapping: "standard",
    axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({
      pressed: pressed.includes(i),
      touched: false,
      value: pressed.includes(i) ? 1 : 0,
    })),
  } as unknown as Gamepad;
}
it("filters stick drift and maps standard axes, trigger and jump edges", () => {
  const input = new GamepadControls();
  expect(input.poll([pad([0.1, -0.1, 0.1, -0.1])]).moveX).toBe(0);
  const state = input.poll([pad([1, -1, -1, 1], [0, 7])]);
  expect(state.moveX).toBe(1);
  expect(state.moveY).toBe(1);
  expect(state.lookX).toBe(-1);
  expect(state.lookY).toBe(1);
  expect(state.vacuum).toBe(true);
  expect(state.jump).toBe(true);
  expect(input.poll([pad([], [0])]).jump).toBe(false);
  input.poll([pad()]);
  expect(input.poll([pad([], [0])]).jump).toBe(true);
});
it("emits one menu action per press and clears state on disconnect", () => {
  const input = new GamepadControls();
  expect(input.poll([pad([], [9])]).menu).toBe(true);
  expect(input.poll([pad([], [9])]).menu).toBe(false);
  expect(input.poll([])).toMatchObject({
    connected: false,
    vacuum: false,
    moveX: 0,
    jump: false,
  });
  expect(input.poll([pad([], [9])]).menu).toBe(true);
});
it("ignores unmapped devices and switches to a controller that is used", () => {
  const input = new GamepadControls();
  expect(input.poll([{ ...pad(), mapping: "" }]).connected).toBe(false);
  expect(input.poll([pad(), pad([1, 0, 0, 0], [], 1)]).moveX).toBe(1);
});
it("touch movement is bounded and independently tracks move, look and vacuum fingers", () => {
  const input = new TouchInput();
  input.begin("move", 1, 100, 100);
  input.move(1, 200, 0);
  expect(Math.hypot(input.moveX, input.moveY)).toBeCloseTo(1);
  input.begin("look", 2, 250, 100);
  input.move(2, 270, 110);
  input.begin("vacuum", 3, 0, 0);
  expect(input.vacuum).toBe(true);
  expect(input.consumeLook()).toEqual([20, 10]);
  expect(input.consumeLook()).toEqual([0, 0]);
  input.end(2);
  expect(input.vacuum).toBe(true);
  input.end(1);
  expect(input.moveX).toBe(0);
  input.end(3);
  expect(input.vacuum).toBe(false);
});
it("does not steal an active finger and clears held actions when cancelled", () => {
  const input = new TouchInput();
  input.begin("move", 1, 0, 0);
  input.begin("move", 2, 100, 100);
  input.move(2, 0, 100);
  expect(input.moveX).toBe(0);
  input.begin("jump", 3, 0, 0);
  expect(input.consumeJump()).toBe(true);
  expect(input.consumeJump()).toBe(false);
  input.begin("vacuum", 4, 0, 0);
  input.clear();
  expect(input.vacuum).toBe(false);
  expect(input.moveY).toBe(0);
  expect(input.consumeLook()).toEqual([0, 0]);
});
it("rejects invalid axis data and handles an analog trigger without a pressed flag", () => {
  const input = new GamepadControls();
  const device = {
    ...pad([NaN, Infinity, -Infinity]),
    buttons: pad().buttons.map((button, index) =>
      index === 7 ? { ...button, value: 0.7 } : button,
    ),
  };
  expect(input.poll([device])).toMatchObject({
    moveX: 0,
    lookX: 0,
    vacuum: true,
  });
});
it("reports ownership on release so rejected extra fingers cannot clear held styling", () => {
  const input = new TouchInput();
  input.begin("vacuum", 1, 0, 0);
  expect(input.begin("vacuum", 2, 0, 0)).toBe(false);
  expect(input.end(2)).toBe(false);
  expect(input.vacuum).toBe(true);
  expect(input.end(1)).toBe(true);
  expect(input.vacuum).toBe(false);
});
