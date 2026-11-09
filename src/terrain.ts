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
export const surfaces: Surface[] = [
  { id: "mint", x0: -28, x1: 28, z0: -10, z1: 26, y: 0, color: 0x597c85 },
  {
    id: "vault-roof",
    x0: -18,
    x1: 18,
    z0: -30,
    z1: -10,
    y: 0,
    color: 0x597c85,
  },
  { id: "vault", x0: -28, x1: 28, z0: -30, z1: -10, y: -6, color: 0x635f91 },
  {
    id: "west-descent",
    x0: -28,
    x1: -18,
    z0: -24,
    z1: -10,
    y: -6,
    endY: 0,
    color: 0x9d79be,
  },
  {
    id: "east-descent",
    x0: 18,
    x1: 28,
    z0: -24,
    z1: -10,
    y: -6,
    endY: 0,
    color: 0x9d79be,
  },
  {
    id: "west-rise",
    x0: -28,
    x1: -18,
    z0: 8,
    z1: 24,
    y: 6,
    endY: 0,
    color: 0x3c9e9f,
  },
  {
    id: "east-rise",
    x0: 18,
    x1: 28,
    z0: 8,
    z1: 24,
    y: 6,
    endY: 0,
    color: 0x3c9e9f,
  },
  {
    id: "west-gallery",
    x0: -28,
    x1: -18,
    z0: -10,
    z1: 8,
    y: 6,
    color: 0x3c9e9f,
  },
  { id: "east-gallery", x0: 18, x1: 28, z0: -10, z1: 8, y: 6, color: 0x3c9e9f },
  { id: "skybridge", x0: -18, x1: 18, z0: -10, z1: -2, y: 6, color: 0x4ca5a3 },
];
export const obstacles = [
  { x0: -9, x1: -7, z0: 0, z1: 2, y0: 0, y1: 10 },
  { x0: 7, x1: 9, z0: 0, z1: 2, y0: 0, y1: 10 },
  { x0: -9, x1: -7, z0: -24, z1: -22, y0: -6, y1: 2 },
  { x0: 7, x1: 9, z0: -24, z1: -22, y0: -6, y1: 2 },
];
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
  for (const s of surfaces) {
    if (!contains(s, x, z)) continue;
    const y = surfaceHeight(s, z);
    if (y <= previousY + step && nextY <= y && y > best) best = y;
  }
  for (const b of obstacles) {
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
  for (const s of surfaces) {
    if (!contains(s, x, z)) continue;
    const y = surfaceHeight(s, z) - 0.6;
    if (oldHead <= y && newHead > y) best = Math.min(best, y);
  }
  return best;
}
export function blockedBody(x: number, z: number, y: number, r = 0.38) {
  if (x < -28 + r || x > 28 - r || z < -30 + r || z > 26 - r) return true;
  for (const b of obstacles)
    if (
      x > b.x0 - r &&
      x < b.x1 + r &&
      z > b.z0 - r &&
      z < b.z1 + r &&
      y + 1.65 > b.y0 &&
      y < b.y1
    )
      return true;
  for (const s of surfaces) {
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
  return y < -2 ? "THE UNDERVAULT" : y > 3 ? "SKY GALLERY" : "THE MINT";
}

export function coinSolid(x: number, y: number, z: number, r = 0.12) {
  for (const b of obstacles)
    if (
      x > b.x0 - r &&
      x < b.x1 + r &&
      z > b.z0 - r &&
      z < b.z1 + r &&
      y > b.y0 - r &&
      y < b.y1 + r
    )
      return true;
  for (const s of surfaces)
    if (contains(s, x, z)) {
      const top = surfaceHeight(s, z);
      if (y < top + r && y > top - 0.6 - r) return true;
    }
  return false;
}
