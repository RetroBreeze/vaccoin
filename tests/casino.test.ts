import { expect, it } from "vitest";
import { Player } from "../src/player";
import {
  blockedBody,
  landingHeight,
  lineBlocked,
  surfaces,
} from "../src/terrain";
import { Coins } from "../src/coins";
import { BoxGeometry, MeshBasicMaterial, Vector3, Group, Mesh } from "three";
import { prepareCasinoModel } from "../src/assets";
import { casinoFurniture, casinoMachines } from "../src/casino-layout";
import { furnitureCoinReward } from "../src/furniture-rewards";
import { TOTAL_COINS, TOTAL_POINTS } from "../src/coin-counts";
import { VALUES } from "../src/collectibles";

it("has substantial playable floors on all three storeys", () => {
  for (const y of [-5, 0, 5]) {
    expect(landingHeight(12, 0, y + 0.1, y - 0.1)).toBe(y);
    expect(blockedBody(12, 0, y)).toBe(false);
  }
  expect(Math.max(...surfaces.map((s) => s.x1))).toBeGreaterThanOrEqual(42);
});
it("walks both stair cores between each pair of floors in both directions", () => {
  for (const side of [-1, 1])
    for (const [x, base] of [
      [34, 0],
      [24, -5],
    ]) {
      const p = new Player();
      p.position.set(side * x, base, 9);
      for (let i = 0; i < 160; i++) p.update(1 / 120, 0, 1, false);
      expect(p.position.y).toBeCloseTo(base + 5, 1);
      for (let i = 0; i < 160; i++) p.update(1 / 120, 0, -1, false);
      expect(p.position.y).toBeCloseTo(base, 1);
    }
});
it("room walls block bodies and suction while doorways stay open", () => {
  expect(blockedBody(-15, -17, 0)).toBe(true);
  expect(lineBlocked(-12, 1, -17, -18, 1, -17)).toBe(true);
  expect(blockedBody(-15, -22, 0)).toBe(false);
  expect(lineBlocked(-12, 1, -22, -18, 1, -22)).toBe(false);
});
it("separates stacked floors but allows atrium drops", () => {
  expect(lineBlocked(12, 2, 0, 12, 6, 0)).toBe(true);
  expect(lineBlocked(0, 2, 0, 0, 6, 0)).toBe(false);
  const p = new Player();
  p.position.set(0, 5, 0);
  p.grounded = false;
  for (let i = 0; i < 240; i++) p.update(1 / 120, 0, 0, false);
  expect(p.position.y).toBe(0);
});
it("contains mixed valuables and resets their types and positions deterministically", () => {
  const c = new Coins(new BoxGeometry(), new MeshBasicMaterial());
  expect(c.kinds).toBeDefined();
  expect(new Set(c.kinds.slice(0, c.count)).size).toBe(6);
  const positions = c.positions.slice(),
    kinds = c.kinds.slice();
  c.reset();
  expect(c.positions).toEqual(positions);
  expect(c.kinds).toEqual(kinds);
});
it("scores treasure value once while retaining a separate physical item count", () => {
  const c = new Coins(new BoxGeometry(), new MeshBasicMaterial());
  const eye = new Vector3(0, 1.7, 35),
    dir = new Vector3(0, -0.15, -1).normalize(),
    target = new Vector3(0, 1.2, 34);
  let points = 0;
  for (let i = 0; i < 600; i++)
    points += c.update(1 / 120, eye, dir, target, true);
  expect(points).toBeGreaterThan(c.collected);
  expect(c.countAlive() + c.collected).toBe(c.count);
  expect(c.score).toBe(points);
  c.reset();
  expect(c.score).toBe(0);
  expect(c.collected).toBe(0);
});
it("does not complete a close pickup through a balcony rail", () => {
  const c = new Coins(new BoxGeometry(), new MeshBasicMaterial());
  c.burst(-9.28, 5.5, 0, 1);
  const id = c.count - 1;
  c.state[id] = 2;
  c.positions.set([-9.28, 5.5, 0], id * 3);
  const target = new Vector3(-8.68, 5.5, 0),
    eye = new Vector3(-8.42, 5.7, 0);
  expect(lineBlocked(-9.28, 5.5, 0, target.x, target.y, target.z)).toBe(true);
  expect(c.update(1 / 120, eye, new Vector3(-1, 0, 0), target, true)).toBe(0);
  expect(c.state[id]).not.toBe(4);
});
it("removes authored collision helper meshes while keeping visible casino parts", () => {
  const root = new Group(),
    cabinet = new Mesh(new BoxGeometry(), new MeshBasicMaterial()),
    helper = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  helper.name = "slot-colonly";
  helper.userData.casino_kind = "collision";
  root.add(cabinet, helper);
  prepareCasinoModel(root);
  expect(root.children).toEqual([cabinet]);
});
it("atrium columns block movement and suction on both public floors", () => {
  for (const y of [0, 5]) {
    expect(blockedBody(-8, 11, y)).toBe(true);
    expect(lineBlocked(-10, y + 1, 11, -6, y + 1, 11)).toBe(true);
  }
});
it.each([
  [-5, false],
  [-5, true],
  [0, false],
  [0, true],
  [5, false],
  [5, true],
] as const)(
  "fits every payout on floor %s with reversed order %s",
  (floor, reverse) => {
    const c = new Coins(new BoxGeometry(), new MeshBasicMaterial());
    const payouts = [
      ...casinoMachines.map((m) => ({ ...m, composition: "mixed" as const })),
      ...casinoFurniture.map((f) => ({
        ...f,
        coins: furnitureCoinReward(f.key),
        composition: "coins" as const,
      })),
    ].sort((a, b) => a.x - b.x || a.z - b.z);
    if (reverse) payouts.reverse();
    for (const payout of payouts)
      expect(
        c.burst(
          payout.x,
          floor + 1.5,
          payout.z,
          payout.coins,
          payout.composition,
        ),
      ).toBe(payout.coins);
    expect(c.count).toBe(TOTAL_COINS);
    expect(
      Array.from(c.kinds.slice(0, c.count)).reduce(
        (sum, k) => sum + VALUES[k],
        0,
      ),
    ).toBe(TOTAL_POINTS);
    expect(c.burst(0, floor + 1.5, 0, 1, "coins")).toBe(0);
    for (const mesh of c.meshes)
      expect(mesh.count).toBeLessThanOrEqual(mesh.instanceMatrix.count);
  },
);
it("releases ordinary furniture coins without changing machine valuables", () => {
  const c = new Coins(new BoxGeometry(), new MeshBasicMaterial());
  const start = c.count;
  expect(c.burst(0, 1, 0, 8, "coins")).toBe(8);
  expect(Array.from(c.kinds.slice(start, c.count))).toEqual(Array(8).fill(0));
  const machineStart = c.count;
  c.burst(0, 1, 0, 80);
  expect(new Set(c.kinds.slice(machineStart, c.count))).toEqual(
    new Set([0, 1, 2]),
  );
});
it("keeps treasure on adjoining floors visible through connected openings", () => {
  const c = new Coins(new BoxGeometry(), new MeshBasicMaterial());
  c.updateVisibility(6.7);
  expect(c.meshes[6].visible).toBe(true);
  expect(c.meshes[12].visible).toBe(true);
  expect(c.meshes[0].visible).toBe(true);
});
it("keeps a dense supply within reach throughout corridors and stair routes", () => {
  const c = new Coins(new BoxGeometry(), new MeshBasicMaterial());
  const samples: number[][] = [];
  for (const y of [-5, 0, 5]) {
    for (const x of [-12, 12])
      for (let z = -30; z <= 30; z += 6) samples.push([x, y, z]);
    for (const z of [-35, 35])
      for (let x = -36; x <= 36; x += 6) samples.push([x, y, z]);
  }
  for (const x of [-34, 34, -24, 24])
    for (let z = -6; z <= 6; z += 3)
      samples.push([x, (Math.abs(x) === 34 ? 5 : 0) - (z + 7) * 5 / 14, z]);
  for (const [x, y, z] of samples) {
    const near: number[] = [];
    c.grid.query(x, y, z, 4, near);
    const reachable = near.filter((id) => {
      const p = id * 3;
      return (
        Math.hypot(
          c.positions[p] - x,
          c.positions[p + 1] - y,
          c.positions[p + 2] - z,
        ) < 4 &&
        !lineBlocked(
          x,
          y + 1.7,
          z,
          c.positions[p],
          c.positions[p + 1],
          c.positions[p + 2],
        )
      );
    });
    expect(reachable.length, `loot near ${x},${y},${z}`).toBeGreaterThanOrEqual(
      30,
    );
  }
});
it("sustains collection while running the length of a connecting corridor", () => {
  const c = new Coins(new BoxGeometry(), new MeshBasicMaterial());
  const player = new Player();
  player.position.set(12, 0, 30);
  const direction = new Vector3(0, -0.15, -1).normalize();
  let gained = 0;
  for (let i = 0; i < 480; i++) {
    player.update(1 / 120, 0, 1, false);
    const eye = player.position.clone().add(new Vector3(0, 1.7, 0));
    const target = player.position.clone().add(new Vector3(0, 1.2, -1));
    gained += c.update(1 / 120, eye, direction, target, true);
    if (i % 60 === 59) {
      expect(
        gained,
        `points during corridor segment ${Math.floor(i / 60)}`,
      ).toBeGreaterThan(10);
      gained = 0;
    }
  }
});
it("preserves pending full uploads when a partial update happens before rendering", () => {
  const c = new Coins(new BoxGeometry(), new MeshBasicMaterial());
  const pending = { ...c.mesh.instanceMatrix.updateRanges[0] };
  c.update(
    1 / 120,
    new Vector3(0, 1.7, 35),
    new Vector3(0, -0.15, -1).normalize(),
    new Vector3(0, 1.2, 34),
    true,
  );
  c.flush();
  expect(
    c.mesh.instanceMatrix.updateRanges.some(
      (r) =>
        r.start <= pending.start &&
        r.start + r.count >= pending.start + pending.count,
    ),
  ).toBe(true);
});
