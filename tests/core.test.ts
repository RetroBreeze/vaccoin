import { describe, expect, it } from "vitest";
import { Round } from "../src/round";
import { SpatialHash } from "../src/spatial";
import {
  surfaces,
  landingHeight,
  surfaceHeight,
  lineBlocked,
} from "../src/terrain";
import { Player } from "../src/player";

describe("round clock and scoring", () => {
  it("expires against elapsed time when the round is not paused", () => {
    const r = new Round();
    r.start(1000);
    r.collect(800);
    expect(r.remaining(31000)).toBe(30);
    expect(r.tick(61001)).toBe(true);
    r.collect(1);
    expect(r.score).toBe(800);
    expect(r.tick(62000)).toBe(false);
  });
  it("restarts cleanly and counts only whole score points", () => {
    const r = new Round();
    r.start(0);
    r.collect(125);
    r.start(8000);
    expect(r.score).toBe(0);
    expect(r.remaining(8000)).toBe(60);
    expect(() => r.collect(1.5)).toThrow();
  });
});
describe("spatial partition", () => {
  it("returns nearby IDs, clears stale cells", () => {
    const h = new SpatialHash(4);
    h.add(1, 0, 0, 0);
    h.add(2, 20, 0, 0);
    const out: number[] = [];
    h.query(0, 0, 0, 5, out);
    expect(out).toEqual([1]);
    h.clear();
    h.query(0, 0, 0, 5, out);
    expect(out).toEqual([]);
  });
});
describe("multi elevation terrain", () => {
  it("does not snap ground players up onto a balcony", () => {
    expect(landingHeight(-12, 0, 0.1, -0.1)).toBe(0);
    expect(landingHeight(-12, 0, 5.1, 4.9)).toBe(5);
  });
  it("lands in the basement and follows both stair ramps", () => {
    expect(landingHeight(0,-35,-4.9,-5.1)).toBe(-5);
    for(const x of [-24,24])expect(landingHeight(x,0,-2.4,-2.6)).toBe(-2.5);
    for(const id of ["west-rise","east-rise"]){const s=surfaces.find(s=>s.id===id)!;expect(surfaceHeight(s,0)).toBe(2.5);}
  });
  it("blocks suction through decks but allows open atrium air", () => {
    expect(lineBlocked(-12, 2, 0, -12, 6, 0)).toBe(true);
    expect(lineBlocked(0, 2, 5, 0, 3, -5)).toBe(false);
  });
  it("walks continuously from ground to upper deck", () => {
    const p = new Player();
    p.position.set(-34, 0, 9);
    for (let i = 0; i < 160; i++) p.update(1 / 120, 0, 1, false);
    expect(p.position.y).toBeCloseTo(5, 1);
    expect(p.position.z).toBeLessThan(-7);
  });
  it("walks into vault and back without snapping", () => {
    const p = new Player();
    p.position.set(24, 0, -9);
    for (let i = 0; i < 160; i++) p.update(1 / 120, 0, -1, false);
    expect(p.position.y).toBeCloseTo(-5, 1);
    for (let i = 0; i < 160; i++) p.update(1 / 120, 0, 1, false);
    expect(p.position.y).toBeCloseTo(0, 1);
  });
});
it("collides with ramp ceilings and side faces", () => {
  const p = new Player();
  p.position.set(-34, 0, 0);
  p.update(1 / 120, 0, 0, true);
  let highest = 0;
  for (let i = 0; i < 160; i++) {
    p.update(1 / 120, 0, 0, false);
    highest = Math.max(highest, p.position.y);
  }
  expect(highest).toBeLessThanOrEqual(0.75);
  expect(p.position.y).toBe(0);
});
it("jumps and lands reliably on each elevation", () => {
  for (const [x, y, z] of [
    [0, 0, 15],
    [-12, 5, 0],
    [0, -5, -35],
  ]) {
    const p = new Player();
    p.position.set(x, y, z);
    p.update(1 / 120, 0, 0, true);
    let high = y;
    for (let i = 0; i < 180; i++) {
      p.update(1 / 120, 0, 0, false);
      high = Math.max(high, p.position.y);
    }
    expect(high).toBeGreaterThan(y + 1);
    expect(p.position.y).toBeCloseTo(y);
    expect(p.grounded).toBe(true);
  }
});
