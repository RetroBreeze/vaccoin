import {
  casinoRooms,
  casinoMachines,
  casinoSurfaces,
  CASINO_BOUNDS,
  CASINO_FLOORS,
} from "./casino-layout";
import { blockedBody, landingHeight, surfaceHeight } from "./terrain";
import { looseKind } from "./collectibles";

export interface LootPlacement {
  x: number;
  y: number;
  z: number;
  kind: number;
}
// A fixed seed preserves identical routes and rewards on every restart.
let seed = 81;
function random() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const casinoLoot: LootPlacement[] = [];
function clear(x: number, y: number, z: number) {
  return (
    !blockedBody(x, z, y, 0.65) &&
    !casinoMachines.some(
      (m) => m.y === y && Math.hypot(x - m.x, z - m.z) < 0.85,
    )
  );
}
function add(x: number, y: number, z: number, kind: number) {
  casinoLoot.push({ x, y: y + 0.32 + random() * 0.35, z, kind });
}

// Deep room carpets, over and above the continuous floor coverage below.
for (const [patch, r] of casinoRooms.entries())
  for (let i = 0; i < 1900; i++) {
    let accepted = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      const x = r.x0 + 1.2 + random() * (r.x1 - r.x0 - 2.4),
        z = r.z0 + 1.2 + random() * (r.z1 - r.z0 - 2.4);
      if (clear(x, r.y, z)) {
        add(x, r.y, z, looseKind(patch, i));
        accepted = true;
        break;
      }
    }
    if (!accepted) throw new Error("No room for casino loot");
  }
// Keep the opening sweep and central atrium especially abundant.
for (const [cx, cz, rx, rz, count] of [
  [0, 29, 4, 7, 1000],
  [0, 0, 7, 10, 1200],
])
  for (let i = 0; i < count; i++) {
    const x = cx + (random() * 2 - 1) * rx,
      z = cz + (random() * 2 - 1) * rz;
    if (!clear(x, 0, z)) {
      i--;
      continue;
    }
    add(x, 0, z, looseKind(12, i));
  }
// Cover every walkable floor, including the atrium, rear/side passages and door approaches.
// Small deterministic jitter avoids a rigid grid without introducing empty stretches.
for (const y of CASINO_FLOORS)
  for (let x = CASINO_BOUNDS.x0 + 1; x <= CASINO_BOUNDS.x1 - 1; x += 0.8)
    for (let z = CASINO_BOUNDS.z0 + 1; z <= CASINO_BOUNDS.z1 - 1; z += 0.8) {
      const px = x + (random() - 0.5) * 0.3,
        pz = z + (random() - 0.5) * 0.3;
      if (
        Math.abs(landingHeight(px, pz, y + 0.1, y - 0.1) - y) > 0.01 ||
        !clear(px, y, pz)
      )
        continue;
      add(px, y, pz, looseKind(12, casinoLoot.length));
    }
// Follow the actual stair support height, rather than leaving coins buried under ramps.
for (const s of casinoSurfaces.filter((s) => s.endY !== undefined))
  for (let x = s.x0 + 1; x <= s.x1 - 1; x += 0.8)
    for (let z = s.z0 + 0.3; z < s.z1; z += 0.6) {
      const y = surfaceHeight(s, z);
      if (clear(x, y, z)) add(x, y, z, looseKind(12, casinoLoot.length));
    }
