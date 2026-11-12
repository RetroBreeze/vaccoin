import { afterEach, expect, it } from "vitest";
import { casinoFurniture, furnitureSolids } from "../src/casino-layout";
import { Player } from "../src/player";
import {
  blockedBody,
  coinSolid,
  landingHeight,
  lineBlocked,
  resetFurnitureCollisions,
  setFurnitureBroken,
} from "../src/terrain";

afterEach(() => resetFurnitureCollisions());
const tableId = casinoFurniture.findIndex(
  (f) => f.key === "coffee" && f.x === 4 && f.z === 5 && f.y === 0,
);
const table = casinoFurniture[tableId];

it("removes broken furniture from movement, coin, landing and suction collision then restores it", () => {
  expect(blockedBody(table.x, table.z, 0)).toBe(true);
  expect(coinSolid(table.x, 0.3, table.z)).toBe(true);
  expect(landingHeight(table.x, table.z, 0.8, -0.1)).toBeCloseTo(0.55);
  expect(lineBlocked(table.x, 0.3, 3.5, table.x, 0.3, 6.5)).toBe(true);
  setFurnitureBroken(tableId, true);
  expect(blockedBody(table.x, table.z, 0)).toBe(false);
  expect(coinSolid(table.x, 0.3, table.z)).toBe(false);
  expect(landingHeight(table.x, table.z, 0.8, -0.1)).toBe(0);
  expect(lineBlocked(table.x, 0.3, 3.5, table.x, 0.3, 6.5)).toBe(false);
  resetFurnitureCollisions();
  expect(blockedBody(table.x, table.z, 0)).toBe(true);
});

it("allows vacuum targeting its own collider while still respecting walls and other furniture", () => {
  expect(lineBlocked(4, 1.7, 7, 4, 0.275, 5)).toBe(true);
  expect(lineBlocked(4, 1.7, 7, 4, 0.275, 5, tableId)).toBe(false);
  expect(lineBlocked(4, 0.3, 7, 4, 0.3, 3, tableId + 1)).toBe(true);
  expect(lineBlocked(41, 1, 5, 43, 1, 5, tableId)).toBe(true);
});

it("records furniture contacts while preserving running speed", () => {
  const chairId = casinoFurniture.findIndex(
    (f) => f.key === "chair" && f.x === 5 && f.y === -5 && f.z === 6.4,
  );
  const player = new Player();
  player.position.set(5, -5, 7.4);
  let touched = false;
  for (let i = 0; i < 30; i++) {
    player.update(1 / 120, 0, 1, false);
    touched ||= player.pushContacts.has(chairId);
  }
  expect(touched).toBe(true);
  expect(player.speed).toBeGreaterThan(10);
  expect(player.position.z).toBeLessThan(6.4);
  player.update(1 / 120, 0, 0, false);
  expect(player.pushContacts.size).toBe(0);
  expect(furnitureSolids.find((s) => s.furnitureId === chairId)).toBeDefined();
});
