import { describe, expect, it } from "vitest";
import { coinFallDistance, coinFallDuration } from "../src/coin-rain";

describe("menu coin fall", () => {
  const initial = 75,
    acceleration = 60,
    terminal = 225;

  it("accelerates downward before reaching a constant terminal speed", () => {
    const distance = (age: number) =>
      coinFallDistance(age, initial, acceleration, terminal);
    expect(distance(0)).toBe(0);
    expect(distance(2) - distance(1)).toBeGreaterThan(distance(1));
    expect(distance(4) - distance(3)).toBeCloseTo(terminal);
    expect(distance(5) - distance(4)).toBeCloseTo(terminal);
    for (let age = 0.1; age < 6; age += 0.1)
      expect(distance(age)).toBeGreaterThan(distance(age - 0.1));
  });

  it("keeps position and velocity continuous when acceleration ends", () => {
    const transition = (terminal - initial) / acceleration;
    const step = 0.0001;
    const before = coinFallDistance(
      transition - step,
      initial,
      acceleration,
      terminal,
    );
    const at = coinFallDistance(transition, initial, acceleration, terminal);
    const after = coinFallDistance(
      transition + step,
      initial,
      acceleration,
      terminal,
    );
    expect((at - before) / step).toBeCloseTo(terminal, 2);
    expect((after - at) / step).toBeCloseTo(terminal, 2);
  });

  it.each([50, 620, 1200])(
    "ends a %i-unit fall at the requested distance",
    (distance) => {
      const duration = coinFallDuration(
        distance,
        initial,
        acceleration,
        terminal,
      );
      expect(
        coinFallDistance(duration, initial, acceleration, terminal),
      ).toBeCloseTo(distance);
    },
  );
});
