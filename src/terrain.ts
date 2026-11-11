import {
  casinoSurfaces,
  casinoWalls,
  furnitureSolids,
  columnSolids,
  CASINO_BOUNDS,
} from "./casino-layout";
export interface Surface {
  id: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  y: number;
  endY?: number;
  color: number;
}
export const surfaces: Surface[] = casinoSurfaces;
export const obstacles = [...casinoWalls, ...furnitureSolids, ...columnSolids];
// Static broad phase: dense furniture should not make every moving coin scan
// the entire building. Padding covers the largest normal body/coin query radius.
function spatialIndex<
  T extends { x0: number; x1: number; z0: number; z1: number },
>(items: T[], padding: number) {
  const cells = new Map<string, T[]>();
  for (const item of items)
    for (
      let x = Math.floor((item.x0 - padding) / 8);
      x <= Math.floor((item.x1 + padding) / 8);
      x++
    )
      for (
        let z = Math.floor((item.z0 - padding) / 8);
        z <= Math.floor((item.z1 + padding) / 8);
        z++
      ) {
        const key = `${x}:${z}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key)!.push(item);
      }
  return (x: number, z: number) =>
    cells.get(`${Math.floor(x / 8)}:${Math.floor(z / 8)}`) ?? [];
}
const localObstacles = spatialIndex(obstacles, 1),
  localSurfaces = spatialIndex(surfaces, 0);

export function contains(s: Surface, x: number, z: number, pad = 0) {
  return (
    x >= s.x0 - pad && x <= s.x1 + pad && z >= s.z0 - pad && z <= s.z1 + pad
  );
}
export function surfaceHeight(s: Surface, z: number) {
  return s.endY === undefined
    ? s.y
    : s.y + ((s.endY - s.y) * (z - s.z0)) / (s.z1 - s.z0);
}
export function landingHeight(
  x: number,
  z: number,
  previousY: number,
  nextY: number,
  step = 0.22,
) {
  let best = -Infinity;
  for (const s of localSurfaces(x, z)) {
    if (!contains(s, x, z)) continue;
    const y = surfaceHeight(s, z);
    if (y <= previousY + step && nextY <= y && y > best) best = y;
  }
  for (const b of localObstacles(x, z)) {
    if (
      x >= b.x0 &&
      x <= b.x1 &&
      z >= b.z0 &&
      z <= b.z1 &&
      b.y1 <= previousY + step &&
      nextY <= b.y1 &&
      b.y1 > best
    )
      best = b.y1;
  }
  return best;
}
export function ceilingHeight(
  x: number,
  z: number,
  oldHead: number,
  newHead: number,
) {
  let best = Infinity;
  for (const s of localSurfaces(x, z)) {
    if (!contains(s, x, z)) continue;
    const y = surfaceHeight(s, z) - 0.6;
    if (oldHead <= y && newHead > y) best = Math.min(best, y);
  }
  return best;
}
export function blockedBody(x: number, z: number, y: number, r = 0.38) {
  if (
    x < CASINO_BOUNDS.x0 + r ||
    x > CASINO_BOUNDS.x1 - r ||
    z < CASINO_BOUNDS.z0 + r ||
    z > CASINO_BOUNDS.z1 - r
  )
    return true;
  for (const b of r <= 1 ? localObstacles(x, z) : obstacles)
    if (
      x > b.x0 - r &&
      x < b.x1 + r &&
      z > b.z0 - r &&
      z < b.z1 + r &&
      y + 1.65 > b.y0 &&
      y < b.y1
    )
      return true;
  for (const s of localSurfaces(x, z)) {
    if (!contains(s, x, z)) continue;
    const top = surfaceHeight(s, z);
    if (y < top - 0.25 && y + 1.6 > top - 0.6) return true;
  }
  return false;
}
export function lineBlocked(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
) {
  // Surface-plane intersection; both sides of every deck are occluders.
  for (const s of surfaces) {
    const slope = s.endY === undefined ? 0 : (s.endY - s.y) / (s.z1 - s.z0);
    const da = ay - (s.y + slope * (az - s.z0));
    const db = by - (s.y + slope * (bz - s.z0));
    if (da * db >= 0) continue;
    const t = da / (da - db);
    if (
      t > 0.015 &&
      t < 0.985 &&
      contains(s, ax + (bx - ax) * t, az + (bz - az) * t)
    )
      return true;
  }
  for (const b of obstacles) {
    if (
      Math.max(ax, bx) < b.x0 ||
      Math.min(ax, bx) > b.x1 ||
      Math.max(ay, by) < b.y0 ||
      Math.min(ay, by) > b.y1 ||
      Math.max(az, bz) < b.z0 ||
      Math.min(az, bz) > b.z1
    )
      continue;
    let lo = 0,
      hi = 1;
    for (const [a, d, min, max] of [
      [ax, bx - ax, b.x0, b.x1],
      [ay, by - ay, b.y0, b.y1],
      [az, bz - az, b.z0, b.z1],
    ]) {
      if (Math.abs(d) < 1e-8) {
        if (a < min || a > max) {
          hi = -1;
          break;
        }
      } else {
        let t0 = (min - a) / d,
          t1 = (max - a) / d;
        if (t0 > t1) [t0, t1] = [t1, t0];
        lo = Math.max(lo, t0);
        hi = Math.min(hi, t1);
      }
    }
    if (lo < hi && hi > 0 && lo < 1) return true;
  }
  return false;
}
export function zone(y: number) {
  return y < -2.5
    ? "SERVICE CONCOURSE"
    : y > 2.5
      ? "UPPER PROMENADE"
      : "GRAND ATRIUM";
}

export function coinSolid(x: number, y: number, z: number, r = 0.12) {
  for (const b of r <= 1 ? localObstacles(x, z) : obstacles)
    if (
      x > b.x0 - r &&
      x < b.x1 + r &&
      z > b.z0 - r &&
      z < b.z1 + r &&
      y > b.y0 - r &&
      y < b.y1 + r
    )
      return true;
  for (const s of localSurfaces(x, z))
    if (contains(s, x, z)) {
      const top = surfaceHeight(s, z);
      if (y < top + r && y > top - 0.6 - r) return true;
    }
  return false;
}
