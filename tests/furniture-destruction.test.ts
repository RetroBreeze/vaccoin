import { afterEach, expect, it } from "vitest";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Scene,
  Vector3,
} from "three";
import type { Assets } from "../src/assets";
import { Destructibles } from "../src/destructibles";
import { Coins } from "../src/coins";
import { Player } from "../src/player";
import { casinoFurniture } from "../src/casino-layout";
import { blockedBody, resetFurnitureCollisions } from "../src/terrain";

afterEach(() => resetFurnitureCollisions());
function fixture() {
  const model = (width: number, height: number, depth: number) => {
    const group = new Group();
    const mesh = new Mesh(
      new BoxGeometry(width, height, depth),
      new MeshBasicMaterial(),
    );
    mesh.position.y = height / 2;
    group.add(mesh);
    return group;
  };
  const assets = {
    model: () => model(1, 2.4, 1),
    fit: (_key: string, w: number, h: number, d: number) => model(w, h, d),
  } as unknown as Assets;
  const coins = new Coins(
    new BoxGeometry(0.1, 0.1, 0.1),
    new MeshBasicMaterial(),
  );
  const world = new Destructibles(new Scene(), assets, coins, () => {});
  const player = new Player();
  const eye = new Vector3();
  const direction = new Vector3(0, 0, -1);
  let time = 0;
  const step = (frames: number, forward = 0, sucking = false) => {
    for (let i = 0; i < frames; i++) {
      player.update(1 / 120, 0, forward, false);
      eye.copy(player.position).y += 1.7;
      time += 1 / 120;
      world.update(1 / 120, time, player, eye, direction, sucking);
    }
  };
  return { world, coins, player, direction, step };
}

it("breaks a table with sustained vacuuming, removes its lamp, pays once and restores collision on reset", () => {
  const f = fixture();
  const id = casinoFurniture.findIndex(
    (o) => o.key === "coffee" && o.x === 4 && o.y === 0 && o.z === 5,
  );
  const lamp = casinoFurniture.findIndex(
    (o) => o.key === "lamp" && o.x === 4 && o.y === 0.55 && o.z === 5,
  );
  const initial = f.coins.count;
  f.player.position.set(4, 0, 7);
  f.direction.set(0, 0.275 - 1.7, -2).normalize();
  f.step(60, 0, true);
  expect(f.world.furniture.objects[id].broken).toBe(false);
  f.step(80, 0, true);
  expect(f.world.furniture.objects[id].broken).toBe(true);
  expect(f.world.furniture.objects[lamp].broken).toBe(true);
  expect(blockedBody(4, 5, 0)).toBe(false);
  expect(f.coins.count - initial).toBe(6);
  expect([...f.coins.kinds.slice(initial, f.coins.count)]).toEqual([
    0, 0, 0, 0, 0, 0,
  ]);
  f.step(140, 0, true);
  expect(f.coins.count - initial).toBe(6);
  f.world.reset();
  expect(blockedBody(4, 5, 0)).toBe(true);
  expect(f.world.furniture.objects[id].broken).toBe(false);
  expect(f.world.furniture.objects[lamp].broken).toBe(false);
});

it("immediately tumbles a chair without stopping the player, destroying it, or paying coins", () => {
  const f = fixture();
  const id = casinoFurniture.findIndex(
    (o) => o.key === "chair" && o.x === 5 && o.y === -5 && o.z === 6.4,
  );
  f.player.position.set(5, -5, 7.4);
  const initial = f.coins.count;
  f.step(30, 1);
  const chair = f.world.furniture.objects[id];
  expect(f.player.speed).toBeGreaterThan(10);
  expect(f.player.position.z).toBeLessThan(6.4);
  expect(chair.tossed).toBe(true);
  expect(chair.broken).toBe(false);
  expect(Math.abs(chair.rx) + Math.abs(chair.rz)).toBeGreaterThan(0.1);
  expect(chair.z).toBeLessThan(6.4);
  expect(f.coins.count).toBe(initial);
  // Once settled, suction targets the new location, not its original chair slot.
  f.player.position.set(0, -5, 20);
  f.player.velocity.set(0, 0, 0);
  f.step(480);
  expect(chair.moving).toBe(false);
  f.player.position.set(chair.x, chair.y, chair.z + 2);
  f.direction.set(0, chair.height / 2 - 1.7, -2).normalize();
  f.step(140, 0, true);
  expect(chair.broken).toBe(true);
  expect(f.coins.count).toBeGreaterThanOrEqual(initial + 4);
  f.world.reset();
  expect(chair.tossed).toBe(false);
  expect(chair.broken).toBe(false);
  expect([chair.x, chair.y, chair.z]).toEqual([5, -5, 6.4]);
  expect([chair.rx, chair.rz]).toEqual([0, 0]);
});

it("does not break props from standing nearby or vacuuming through the floor", () => {
  const f = fixture();
  const id = casinoFurniture.findIndex(
    (o) => o.key === "chair" && o.x === 5 && o.y === -5 && o.z === 6.4,
  );
  f.player.position.set(5, -5, 7.2);
  f.step(400);
  expect(f.world.furniture.objects[id].broken).toBe(false);
  f.player.position.set(5, 0, 7.2);
  f.direction.set(0, -6.19, -0.8).normalize();
  f.step(180, 0, true);
  expect(f.world.furniture.objects[id].broken).toBe(false);
});

it("knocks a table's lamp loose without paying rewards or destroying either prop", () => {
  const f = fixture();
  const id = casinoFurniture.findIndex(
    (o) => o.key === "coffee" && o.x === 4 && o.y === 0 && o.z === 5,
  );
  const lampId = casinoFurniture.findIndex(
    (o) => o.key === "lamp" && o.x === 4 && o.y === 0.55 && o.z === 5,
  );
  f.player.position.set(4, 0, 7);
  const initial = f.coins.count;
  f.step(30, 1);
  const table = f.world.furniture.objects[id],
    lamp = f.world.furniture.objects[lampId];
  expect(table.tossed).toBe(true);
  expect(lamp.tossed).toBe(true);
  expect(table.broken || lamp.broken).toBe(false);
  expect(f.coins.count).toBe(initial);
  f.player.position.set(0, 0, 20);
  f.player.velocity.set(0, 0, 0);
  f.step(600);
  expect(table.moving || lamp.moving).toBe(false);
  expect(table.y).toBeGreaterThan(-1);
  expect(lamp.y).toBeGreaterThan(-1);
});
