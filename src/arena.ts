import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { surfaces, surfaceHeight, obstacles } from "./terrain";
import { Assets } from "./assets";
export function buildArena(scene: T.Scene, assets: Assets) {
  const batches = new Map<number, T.BufferGeometry[]>(),
    temp = new T.Object3D();
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
  ) => {
    const g = new T.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    if (!batches.has(color)) batches.set(color, []);
    batches.get(color)!.push(g);
  };
  for (const s of surfaces) {
    const w = s.x1 - s.x0,
      d = s.z1 - s.z0,
      mid = (s.z0 + s.z1) / 2;
    if (s.endY === undefined)
      box((s.x0 + s.x1) / 2, s.y - 0.3, mid, w, 0.6, d, s.color);
    else {
      const slope = (s.endY - s.y) / d;
      temp.position.set((s.x0 + s.x1) / 2, surfaceHeight(s, mid) - 0.3, mid);
      temp.rotation.set(Math.atan(slope), 0, 0); // local +z rises when x rotation is negative
      temp.rotation.x = -Math.atan(slope);
      temp.updateMatrix();
      const g = new T.BoxGeometry(
        w,
        0.6,
        Math.hypot(d, s.endY - s.y),
      ).applyMatrix4(temp.matrix);
      if (!batches.has(s.color)) batches.set(s.color, []);
      batches.get(s.color)!.push(g);
      for (let z = s.z0 + 1; z < s.z1; z += 2) {
        box(
          s.x0 + 0.17,
          surfaceHeight(s, z) + 0.02,
          z,
          0.24,
          0.06,
          0.45,
          0xffd879,
        );
        box(
          s.x1 - 0.17,
          surfaceHeight(s, z) + 0.02,
          z,
          0.24,
          0.06,
          0.45,
          0xffd879,
        );
      }
    }
  }
  // Inlaid floor grid and colour-coded route stripes.
  for (let x = -24; x <= 24; x += 4)
    box(x, 0.012, 8, 0.035, 0.025, 35, 0x6a9096);
  for (let z = -8; z <= 24; z += 4)
    box(0, 0.014, z, 55, 0.025, 0.035, 0x6a9096);
  for (const x of [-17.6, 17.6]) box(x, 0.02, 10, 0.15, 0.03, 30, 0xefd28b);
  for (let z = -28; z < -10; z += 4)
    box(0, -5.985, z, 55, 0.025, 0.035, 0x8982b6);
  for (let x = -16; x <= 16; x += 4)
    box(x, 0.012, -20, 0.035, 0.025, 20, 0x6a9096);
  for (let z = -28; z < -10; z += 4)
    box(0, 0.014, z, 36, 0.025, 0.035, 0x6a9096);
  // Outer retaining walls; the open roof gives immediate orientation.
  box(-28.6, 1, -2, 1.2, 22, 57, 0x283e52);
  box(28.6, 1, -2, 1.2, 22, 57, 0x283e52);
  box(0, 1, -30.6, 58, 22, 1.2, 0x283e52);
  box(0, 1, 26.6, 58, 22, 1.2, 0x345467);
  for (const x of [-27.94, 27.94]) {
    box(x, 6.5, -2, 0.1, 0.24, 56, 0x68d5c6);
    box(x, -3, -20, 0.1, 0.22, 20, 0xc1a3ed);
  }
  box(0, -3, -29.94, 56, 0.2, 0.12, 0xc1a3ed);
  box(0, 9, -29.94, 56, 0.25, 0.1, 0x68d5c6);
  // Pillars are the exact same solids used by movement and suction occlusion.
  for (const b of obstacles) {
    box(
      (b.x0 + b.x1) / 2,
      (b.y0 + b.y1) / 2,
      (b.z0 + b.z1) / 2,
      b.x1 - b.x0,
      b.y1 - b.y0,
      b.z1 - b.z0,
      0xe9c995,
    );
    box(
      (b.x0 + b.x1) / 2,
      b.y1 - 0.15,
      (b.z0 + b.z1) / 2,
      2.5,
      0.5,
      2.5,
      0xf7db9d,
    );
  }
  for (let x = -24; x <= 24; x += 8) {
    box(x, 9.5, -29.8, 1, 5, 1, 0x41657a);
    box(x, 9.5, 25.8, 1, 5, 1, 0x41657a);
  }
  // Gallery edge trim without railings: dropping down is a shortcut.
  for (const x of [-18, 18]) box(x, 5.95, -1, 0.2, 0.15, 18, 0xf7db9d);
  box(0, 5.95, -2, 36, 0.16, 0.2, 0xf7db9d);
  for (const [color, geos] of batches) {
    const combined = mergeGeometries(geos);
    const mesh = new T.Mesh(combined, new T.MeshLambertMaterial({ color }));
    scene.add(mesh);
    for (const g of geos) g.dispose();
  }
  const place = (
    key: string,
    x: number,
    y: number,
    z: number,
    size: number,
    rot = 0,
  ) => {
    const m = assets.model(key, size);
    m.position.set(x, y, z);
    m.rotation.y = rot;
    scene.add(m);
    return m;
  };
  place("vault", 0, -6, -28.4, 5.2);
  place("gold", -14, -6, -28, 3.2);
  place("gold", 14, -6, -28, 3.2);
  place("money", -25, 6, -8, 1.8);
  place("chest", 25, 6, -8, 2.4);
  for (const x of [-26, 26]) {
    place("blue", x, 0, 4, 1.8);
    place("frame", x, 7, -9, 2.1);
    place("stripe", x, 0, 25, 1.3);
  }
  for (const x of [-12, 12]) place("pipe", x, 8, -29, 2.2);
  // Monumental mint emblem floats well above the playable space.
  const medallion = assets.model("coin", 4.4);
  medallion.rotation.x = Math.PI / 2;
  medallion.position.set(0, 10, -6);
  scene.add(medallion);
  return medallion;
}
