// Shared source of truth: furnishings, architecture, collision and rewards.
export interface Deck {
  id: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  y: number;
  endY?: number;
  color: number;
}
export interface Solid {
  furnitureId?: number;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  y0: number;
  y1: number;
}
export interface Room {
  id: string;
  name: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  y: number;
  color: number;
  theme: "slots" | "tables" | "lounge" | "cash";
}
export const FLOOR_HEIGHT = 5;
export const CASINO_FLOORS = [-5, 0, 5] as const;
export const CASINO_BOUNDS = { x0: -42, x1: 42, z0: -38, z1: 38 };
export const CASINO_SPAWN = { x: 0, y: 0, z: 35 };
export const ATRIUM = { x0: -9, x1: 9, z0: -12, z1: 12 };
export const casinoRooms: Room[] = [];
const names = [
  ["COUNTING ROOM", "BULLION VAULT", "MACHINE STORAGE", "CASHIER OFFICE"],
  ["SLOT GALLERY", "ROULETTE HALL", "CLASSIC SLOTS", "BLACKJACK SALON"],
  ["POKER ROOM", "HIGH LIMIT", "PEARL LOUNGE", "VIP SLOTS"],
];
const themes: Room["theme"][][] = [
  ["cash", "cash", "slots", "cash"],
  ["slots", "tables", "slots", "tables"],
  ["tables", "tables", "lounge", "slots"],
];
for (const [level, y] of CASINO_FLOORS.entries())
  for (let i = 0; i < 4; i++)
    casinoRooms.push({
      id: `room-${level}-${i}`,
      name: names[level][i],
      x0: i % 2 === 0 ? -39 : 15,
      x1: i % 2 === 0 ? -15 : 39,
      z0: i < 2 ? -33 : 11,
      z1: i < 2 ? -11 : 33,
      y,
      color: [0x392521, 0x64202b, 0x501b2d][level],
      theme: themes[level][i],
    });
export const casinoSurfaces: Deck[] = [];
const xs = [-42, -36, -32, -26, -22, -9, 9, 22, 26, 32, 36, 42],
  zs = [-38, -12, -7, 7, 12, 38];
for (const y of [-5, 0, 5, 10])
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < zs.length - 1; j++) {
      const x0 = xs[i],
        x1 = xs[i + 1],
        z0 = zs[j],
        z1 = zs[j + 1],
        cx = (x0 + x1) / 2,
        cz = (z0 + z1) / 2;
      const rise = Math.abs(cx) > 32 && Math.abs(cx) < 36 && Math.abs(cz) < 7;
      const descent =
        Math.abs(cx) > 22 && Math.abs(cx) < 26 && Math.abs(cz) < 7;
      if (y === 5 && (rise || (Math.abs(cx) < 9 && Math.abs(cz) < 12)))
        continue;
      if (y === 0 && descent) continue;
      casinoSurfaces.push({
        id: `deck-${y}-${i}-${j}`,
        x0,
        x1,
        z0,
        z1,
        y,
        color: 0x571e2a,
      });
    }
for (const side of [-1, 1])
  for (const [x, base, label] of [
    [34, 0, "rise"],
    [24, -5, "descent"],
  ] as const)
    casinoSurfaces.push({
      id: `${side < 0 ? "west" : "east"}-${label}`,
      x0: side * x - 2,
      x1: side * x + 2,
      z0: -7,
      z1: 7,
      y: base + 5,
      endY: base,
      color: 0x977344,
    });
export const casinoWalls: Solid[] = [];
export const casinoColumns = [-8, 8].flatMap((x) =>
  [-11, 11].map((z) => ({ x, z, width: 1, height: 9.4 })),
);
export const columnSolids: Solid[] = casinoColumns.map((c) => ({
  x0: c.x - c.width / 2,
  x1: c.x + c.width / 2,
  z0: c.z - c.width / 2,
  z1: c.z + c.width / 2,
  y0: 0,
  y1: c.height,
}));
function wall(
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  y: number,
  h = 4.4,
) {
  casinoWalls.push({ x0, x1, z0, z1, y0: y, y1: y + h });
}
for (const y of CASINO_FLOORS) {
  wall(-42, -41.6, -38, 38, y, 5);
  wall(41.6, 42, -38, 38, y, 5);
  wall(-42, 42, -38, -37.6, y, 5);
  wall(-42, 42, 37.6, 38, y, 5);
  for (const r of casinoRooms.filter((r) => r.y === y)) {
    const inner = r.x0 < 0 ? r.x1 : r.x0,
      mid = (r.z0 + r.z1) / 2,
      door = (r.x0 + r.x1) / 2;
    wall(inner - 0.25, inner + 0.25, r.z0, mid - 2.5, y);
    wall(inner - 0.25, inner + 0.25, mid + 2.5, r.z1, y);
    for (const z of [r.z0, r.z1]) {
      wall(r.x0, door - 3, z - 0.25, z + 0.25, y);
      wall(door + 3, r.x1, z - 0.25, z + 0.25, y);
    }
    wall(r.x0 < 0 ? -39.25 : 39, r.x0 < 0 ? -39 : 39.25, r.z0, r.z1, y);
  }
}
wall(-9.2, -8.9, -12, 12, 5, 0.95);
wall(8.9, 9.2, -12, 12, 5, 0.95);
wall(-9, 9, -12.2, -11.9, 5, 0.95);
wall(-9, -2, 11.9, 12.2, 5, 0.95);
wall(2, 9, 11.9, 12.2, 5, 0.95);
export interface Furniture {
  key: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  rotation: number;
  solid: boolean;
}
export const casinoFurniture: Furniture[] = [];
export const casinoMachines: {
  x: number;
  y: number;
  z: number;
  key: string;
  rotation: number;
  coins: number;
}[] = [];
function prop(
  key: string,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  rotation = 0,
  solid = true,
) {
  casinoFurniture.push({ key, x, y, z, width, height, depth, rotation, solid });
}
function machine(
  x: number,
  y: number,
  z: number,
  rotation: number,
  index: number,
) {
  const key = ["slot-gold", "slot-classic", "slot-neon"][index % 3];
  casinoMachines.push({ x, y, z, key, rotation, coins: y === 5 ? 100 : 80 });
  // Player-height chairs face the cabinet, with room to pass between banks.
  prop(
    "chair",
    x + Math.sin(rotation) * 1.15,
    y,
    z + Math.cos(rotation) * 1.15,
    0.62,
    1.02,
    0.65,
    rotation,
  );
}
for (const [roomIndex, r] of casinoRooms.entries()) {
  const cx = (r.x0 + r.x1) / 2,
    cz = (r.z0 + r.z1) / 2;
  if (r.theme === "slots") {
    // Two back-to-back banks, each split by a central aisle aligned with both doors.
    for (const dz of [-5, 5])
      for (const dx of [-9.1, -7.8, -6.5, -5.2, -3.9, 3.9, 5.2, 6.5, 7.8, 9.1])
        for (const face of [-1, 1])
          machine(
            cx + dx,
            r.y,
            cz + dz + face * 0.55,
            face > 0 ? 0 : Math.PI,
            roomIndex + Math.round(Math.abs(dx)),
          );
  } else if (r.theme === "tables" || r.theme === "cash") {
    for (const dx of [-6, 6])
      for (const dz of [-6, 0, 6]) {
        const x = cx + dx,
          z = cz + dz,
          key =
            r.theme === "cash"
              ? "cash-table"
              : r.name === "ROULETTE HALL"
                ? "roulette"
                : r.name === "BLACKJACK SALON"
                  ? "blackjack"
                  : "poker";
        prop(key, x, r.y, z, 3.5, 0.95, 1.8);
        for (const sx of [-1, 1])
          for (const sz of [-1, 1])
            prop(
              "chair",
              x + sx * 1.2,
              r.y,
              z + sz * 1.45,
              0.62,
              1.02,
              0.65,
              sz > 0 ? 0 : Math.PI,
            );
      }
  } else {
    for (const dx of [-6, 6])
      for (const dz of [-6, 0, 6]) {
        prop(
          "sofa",
          cx + dx,
          r.y,
          cz + dz,
          2.5,
          1.1,
          1,
          dx < 0 ? Math.PI / 2 : -Math.PI / 2,
        );
        prop(
          "coffee",
          cx + dx + (dx < 0 ? 1.7 : -1.7),
          r.y,
          cz + dz,
          1.2,
          0.55,
          0.8,
        );
        prop(
          "lamp",
          cx + dx + (dx < 0 ? 1.7 : -1.7),
          r.y + 0.55,
          cz + dz,
          0.35,
          0.65,
          0.35,
          0,
          false,
        );
        prop("lounge-chair", cx + dx, r.y, cz + dz + 2, 1, 1.1, 0.9, Math.PI);
      }
  }
  for (const dx of [-10, 10])
    for (const dz of [-9, 9])
      prop("palm", cx + dx, r.y, cz + dz, 1.8, 2.7, 1.8);
  for (const dx of [-10, 10]) {
    prop("cocktail", cx + dx, r.y, cz, 1, 0.95, 1);
    prop("trash", cx + dx, r.y, cz + 2, 0.5, 0.9, 0.5);
  }
}
// Furnished entrance and promenade alcoves keep the centre aisle open.
for (const y of [0, 5])
  for (const side of [-1, 1]) {
    for (const z of [18, 20.2, 22.4, 27, 29.2, 31.4])
      machine(
        side * 7,
        y,
        z,
        side < 0 ? Math.PI / 2 : -Math.PI / 2,
        Math.round(z),
      );
    for (const z of [-29, -19]) {
      prop(
        "sofa",
        side * 5.8,
        y,
        z,
        2.6,
        1.1,
        1,
        side < 0 ? Math.PI / 2 : -Math.PI / 2,
      );
      prop("coffee", side * 3.8, y, z, 1.2, 0.55, 0.9);
      prop("palm", side * 7, y, z - 3, 1.7, 2.7, 1.7);
    }
  }
// Atrium seating islands and basement sorting stations.
for (const side of [-1, 1])
  for (const z of [-5, 5]) {
    prop(
      "sofa",
      side * 6,
      0,
      z,
      2.5,
      1.1,
      1,
      side < 0 ? Math.PI / 2 : -Math.PI / 2,
    );
    prop("coffee", side * 4, 0, z, 1.3, 0.55, 0.8);
    prop("lamp", side * 4, 0.55, z, 0.4, 0.7, 0.4, 0, false);
    prop("cash-table", side * 5, -5, z, 3, 0.95, 1.5);
    prop("chair", side * 5, -5, z + 1.4, 0.62, 1.02, 0.65);
  }
export const furnitureSolids: Solid[] = casinoFurniture.flatMap(
  (f, furnitureId) => {
    if (!f.solid) return [];
    const stem = f.key === "palm",
      w = stem ? 0.55 : f.width,
      d = stem ? 0.55 : f.depth,
      c = Math.abs(Math.cos(f.rotation)),
      s = Math.abs(Math.sin(f.rotation));
    const hw = (c * w + s * d) / 2,
      hd = (s * w + c * d) / 2;
    return [
      {
        furnitureId,
        x0: f.x - hw,
        x1: f.x + hw,
        z0: f.z - hd,
        z1: f.z + hd,
        y0: f.y,
        y1: f.y + (stem ? 1 : f.height),
      },
    ];
  },
);
export function casinoZone(x: number, y: number, z: number) {
  return (
    casinoRooms.find(
      (r) =>
        Math.abs(r.y - y) < 2 &&
        x >= r.x0 &&
        x <= r.x1 &&
        z >= r.z0 &&
        z <= r.z1,
    )?.name ??
    (y > 2.5
      ? "UPPER PROMENADE"
      : y < -2.5
        ? "SERVICE CONCOURSE"
        : "GRAND ATRIUM")
  );
}
