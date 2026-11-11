import { it, expect } from "vitest";
import { Scene, Mesh, BoxGeometry, MeshBasicMaterial } from "three";
import {
  CASINO_BOUNDS,
  casinoRooms,
  casinoMachines,
  casinoFurniture,
} from "../src/casino-layout";
import { updateCasinoVisibility } from "../src/arena";
import { blockedBody, landingHeight } from "../src/terrain";
it("uses compact rooms filled with banks of machines and furniture", () => {
  expect(
    (CASINO_BOUNDS.x1 - CASINO_BOUNDS.x0) *
      (CASINO_BOUNDS.z1 - CASINO_BOUNDS.z0),
  ).toBeLessThan(6500);
  for (const r of casinoRooms) {
    const inside = (o: { x: number; y: number; z: number }) =>
      o.y === r.y && o.x > r.x0 && o.x < r.x1 && o.z > r.z0 && o.z < r.z1;
    if (r.theme === "slots")
      expect(
        casinoMachines.filter(inside).length,
        r.name,
      ).toBeGreaterThanOrEqual(24);
    else
      expect(
        casinoFurniture.filter(inside).length,
        r.name,
      ).toBeGreaterThanOrEqual(20);
  }
});
it("never hides architecture when the camera crosses a storey boundary", () => {
  const scene = new Scene(),
    floor = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  floor.userData.casinoRange = [0, 8];
  scene.add(floor);
  for (const eyeY of [-3.3, -0.3, 1.7, 4.99, 6.7, 9.9]) {
    updateCasinoVisibility(scene, eyeY);
    expect(floor.visible).toBe(true);
  }
});
it("connects the entrance to every furnished room through walkable aisles and stairs", () => {
  const queue = [[0, 0, 35]],
    seen = new Set(["0:0:35"]),
    reached = new Set<string>();
  for (let i = 0; i < queue.length; i++) {
    const [x, y, z] = queue[i];
    for (const room of casinoRooms)
      if (
        Math.abs(y - room.y) < 0.1 &&
        Math.abs(x - (room.x0 + room.x1) / 2) < 2 &&
        Math.abs(z - (room.z0 + room.z1) / 2) < 2
      )
        reached.add(room.id);
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        nz = z + dz,
        ny = landingHeight(nx, nz, y + 0.4, y - 0.4, 0);
      if (
        !Number.isFinite(ny) ||
        Math.abs(ny - y) > 0.4 ||
        blockedBody(nx, nz, ny)
      )
        continue;
      // Sample between nodes too: a thin wall or chair cannot be skipped.
      let clear = true;
      for (const t of [0.25, 0.5, 0.75])
        if (blockedBody(x + dx * t, z + dz * t, y + (ny - y) * t)) {
          clear = false;
          break;
        }
      if (!clear) continue;
      const key = `${nx}:${ny.toFixed(3)}:${nz}`;
      if (!seen.has(key)) {
        seen.add(key);
        queue.push([nx, ny, nz]);
      }
    }
  }
  expect([...reached].sort()).toEqual(casinoRooms.map((r) => r.id).sort());
});
