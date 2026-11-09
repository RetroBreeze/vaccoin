import { expect, it } from "vitest";
import { Scene } from "three";
import { Player } from "../src/player";
import { Springboards, springboardSpecs } from "../src/springboards";
import { Coins } from "../src/coins";
import { BoxGeometry, MeshBasicMaterial } from "three";

it("keeps the central ground route solid over the vault", () => {
  const p = new Player();
  p.position.set(0, 0, -8);
  for (let i = 0; i < 160; i++) p.update(1 / 120, 0, 1, false);
  expect(p.position.z).toBeLessThan(-24);
  expect(p.position.y).toBe(0);
});
it("automatically launches each springboard onto its higher landing with no input", () => {
  for (const spec of springboardSpecs) {
    const p = new Player();
    p.position.set(spec.x, spec.y, spec.z);
    const pads = new Springboards(new Scene());
    let launches = 0,
      peak: number = spec.y;
    for (let i = 0; i < 240; i++) {
      p.update(1 / 120, 0, 0, false);
      if (pads.update(1 / 120, p)) launches++;
      peak = Math.max(peak, p.position.y);
    }
    expect(launches, spec.id).toBe(1);
    expect(peak, spec.id).toBeGreaterThan(spec.targetY + 1);
    expect(p.position.y, spec.id).toBeCloseTo(spec.targetY, 2);
    expect(p.grounded, spec.id).toBe(true);
    expect(
      Math.hypot(p.position.x - spec.targetX, p.position.z - spec.targetZ),
      spec.id,
    ).toBeLessThan(1.5);
  }
});
it("does not activate from another floor and clears boost on restart", () => {
  const pads = new Springboards(new Scene()),
    p = new Player(),
    spec = springboardSpecs[0];
  p.position.set(spec.x, spec.y + 6, spec.z);
  expect(pads.update(1 / 120, p)).toBe(false);
  p.position.set(spec.x, spec.y, spec.z);
  expect(pads.update(1 / 120, p)).toBe(true);
  p.reset();
  pads.reset();
  p.update(1 / 120, 0, 0, false);
  expect(p.position.toArray()).toEqual([0, 0, 20]);
  expect(p.velocity.length()).toBe(0);
});
it("keeps launch pads clear of resting coins without reducing the coin count", () => {
  const coins = new Coins(new BoxGeometry(), new MeshBasicMaterial());
  expect(coins.count).toBe(12000);
  for (let i = 0; i < coins.count; i++) {
    const x = coins.positions[i * 3],
      y = coins.positions[i * 3 + 1],
      z = coins.positions[i * 3 + 2];
    for (const s of springboardSpecs)
      if (Math.abs(y - s.y) < 1.1)
        expect(Math.hypot(x - s.x, z - s.z)).toBeGreaterThan(1.8);
  }
});
it("reaches the mint when the player keeps holding the vault approach direction", () => {
  for (const spec of springboardSpecs.filter((s) => s.y === -6)) {
    const p = new Player(),
      pads = new Springboards(new Scene());
    p.position.set(spec.x, spec.y, spec.z + 2.5);
    let landedAbove = false;
    for (let i = 0; i < 240; i++) {
      p.update(1 / 120, 0, 1, false);
      pads.update(1 / 120, p);
      if (p.grounded && p.position.y === 0) landedAbove = true;
    }
    expect(landedAbove, spec.id).toBe(true);
  }
});
