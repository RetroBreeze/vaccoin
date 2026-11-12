import { expect, it } from "vitest";
import {
  advanceFurniture,
  furnitureExtent,
  type FurnitureMotion,
} from "../src/furniture-motion";

const body = (overrides: Partial<FurnitureMotion> = {}): FurnitureMotion => ({
  x: 0,
  y: 0,
  z: 20,
  rotation: 0,
  rx: 0,
  rz: 0,
  width: 1,
  height: 1,
  depth: 1,
  vx: 10,
  vy: 6,
  vz: 0,
  spinX: 8,
  spinZ: -4,
  moving: true,
  tossed: true,
  cooldown: 0.35,
  ...overrides,
});

it("bounces away from the outside wall and settles on the floor without sinking", () => {
  const prop = body({ x: 41, z: 20 });
  let bounced = false;
  for (let i = 0; i < 720; i++) {
    advanceFurniture(prop, 1 / 120);
    bounced ||= prop.vx < 0;
    expect(prop.x).toBeLessThan(42);
    expect(
      prop.y + prop.height / 2 - furnitureExtent(prop),
    ).toBeGreaterThanOrEqual(-0.001);
  }
  expect(bounced).toBe(true);
  expect(prop.moving).toBe(false);
  expect(prop.y + prop.height / 2 - furnitureExtent(prop)).toBeCloseTo(0);
});

it("bounces below an upper floor instead of flying through its underside", () => {
  const prop = body({ x: 30, z: 20, y: 3.2, vx: 0, spinX: 0, spinZ: 0, vy: 9 });
  for (let i = 0; i < 30; i++) {
    advanceFurniture(prop, 1 / 120);
    expect(prop.y + 1).toBeLessThanOrEqual(4.40001);
  }
  expect(prop.vy).toBeLessThan(0);
});
