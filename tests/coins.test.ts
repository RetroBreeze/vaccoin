import { obstacles } from "../src/terrain";
import { expect, it } from "vitest";
import { BoxGeometry, MeshBasicMaterial, Vector3 } from "three";
import { Coins, LOOSE_COINS, TOTAL_COINS } from "../src/coins";
const make = () =>
  new Coins(new BoxGeometry(0.2, 0.05, 0.2), new MeshBasicMaterial());
it("populates actual independent coins and resets exact layout", () => {
  const c = make();
  expect(c.count).toBe(LOOSE_COINS);
  expect(LOOSE_COINS).toBeGreaterThan(30000);
  expect(TOTAL_COINS).toBeGreaterThan(LOOSE_COINS + 10000);
  const before = c.positions.slice();
  c.reset();
  expect(c.positions).toEqual(before);
});
it("collects a dense stream exactly once, with bounded active simulation", () => {
  const c = make(),
    eye = new Vector3(0, 1.7, 35),
    dir = new Vector3(0, -0.15, -1).normalize(),
    nozzle = new Vector3(0, 1.2, 34);
  let score = 0;
  for (let i = 0; i < 600; i++) {
    score += c.update(1 / 120, eye, dir, nozzle, true);
    expect(c.activeCount).toBeLessThanOrEqual(1800);
  }
  expect(score).toBeGreaterThan(300);
  expect(c.score).toBe(score);
  expect(score).toBeGreaterThan(c.collected);
  expect(c.countAlive()).toBe(c.count - c.collected);
  c.reset();
  expect(c.collected).toBe(0);
  expect(c.activeCount).toBe(0);
  expect(c.countAlive()).toBe(LOOSE_COINS);
});
it("releases only reserved physical coins, respects capacity", () => {
  const c = make();
  expect(c.burst(0, 1, 0, 180)).toBe(180);
  expect(c.count).toBe(LOOSE_COINS + 180);
  c.burst(0, 1, 0, 99999);
  expect(c.count).toBe(TOTAL_COINS);
});
it("ballistic coin showers cannot settle inside solid pillars", () => {
  const c = make();
  c.burst(-8, 0.8, 9, 120);
  for (let i = 0; i < 1200; i++)
    c.update(
      1 / 120,
      new Vector3(0, 2, 20),
      new Vector3(0, 0, -1),
      new Vector3(0, 1, 19),
      false,
    );
  let trapped = 0;
  for (let id = LOOSE_COINS; id < c.count; id++) {
    const p = id * 3,
      [x, y, z] = c.positions.slice(p, p + 3);
    if (x > -8.5 && x < -7.5 && z > 10.5 && z < 11.5 && y < 9.4) trapped++;
  }
  expect(trapped).toBe(0);
});
it("throws a visible shower before held suction can reclaim released coins", () => {
  const c = make(),
    eye = new Vector3(0, 1.7, 35),
    dir = new Vector3(0, -0.15, -1).normalize(),
    target = new Vector3(0, 1.2, 34);
  c.burst(0, 0.8, 32, 240);
  for (let frame = 0; frame < 30; frame++)
    c.update(1 / 120, eye, dir, target, true);
  let airborne = 0,
    spread = 0,
    collected = 0;
  for (let id = LOOSE_COINS; id < c.count; id++) {
    if (c.state[id] === 4) collected++;
    if (c.positions[id * 3 + 1] > 2) airborne++;
    if (Math.hypot(c.positions[id * 3], c.positions[id * 3 + 2] - 32) > 1)
      spread++;
  }
  expect(collected).toBe(0);
  expect(airborne).toBeGreaterThan(150);
  expect(spread).toBeGreaterThan(150);
  for (let frame = 0; frame < 480; frame++)
    c.update(1 / 120, eye, dir, target, true);
  expect(
    Array.from(c.state.slice(LOOSE_COINS, c.count)).filter((s) => s === 4)
      .length,
  ).toBeGreaterThan(50);
  expect(c.countAlive() + c.collected).toBe(c.count);
});
it("queues excess eruption coins instead of replacing their shower with a static pile", () => {
  const c = make(),
    eye = new Vector3(0, 2, 20),
    dir = new Vector3(0, 0, -1),
    target = new Vector3(0, 1, 19);
  c.burst(0, 1, 5, 2400);
  expect(c.activeCount).toBeLessThanOrEqual(1800);
  expect(c.state[LOOSE_COINS + 1800]).not.toBe(1);
  for (let i = 0; i < 600; i++) {
    c.update(1 / 120, eye, dir, target, false);
    expect(c.activeCount).toBeLessThanOrEqual(1800);
  }
  expect([1, 3]).toContain(c.state[LOOSE_COINS + 1800]);
  expect(c.countAlive()).toBe(c.count);
  c.reset();
  expect(c.activeCount).toBe(0);
  expect(c.count).toBe(LOOSE_COINS);
});
it("upper salon showers settle outside the furnished room obstacles", () => {
  const c = make(),
    eye = new Vector3(0, 2, 20),
    dir = new Vector3(0, 0, -1),
    target = new Vector3(0, 1, 19);
  c.burst(-27, 6.1, -22, 540);
  for (let i = 0; i < 1200; i++) c.update(1 / 120, eye, dir, target, false);
  let trapped = 0;
  for (let id = LOOSE_COINS; id < c.count; id++) {
    const p = id * 3,
      x = c.positions[p],
      y = c.positions[p + 1],
      z = c.positions[p + 2];
    for (const b of obstacles)
      if (
        x > b.x0 &&
        x < b.x1 &&
        z > b.z0 &&
        z < b.z1 &&
        y > b.y0 &&
        y < b.y1 + 0.3
      )
        trapped++;
  }
  expect(trapped).toBe(0);
});
