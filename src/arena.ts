import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Assets } from "./assets";
import { createSignPanel } from "./casino-signs";
import {
  casinoSurfaces,
  casinoWalls,
  casinoRooms,
  casinoFurniture,
  casinoColumns,
} from "./casino-layout";

export function buildArena(scene: T.Scene, assets: Assets) {
  const batches = new Map<
    string,
    { material: T.Material; geos: T.BufferGeometry[]; min: number; max: number }
  >();
  let visibleMin = -Infinity,
    visibleMax = Infinity;
  const brass = new T.MeshLambertMaterial({ color: 0xc9a15a });
  const dark = new T.MeshLambertMaterial({ color: 0x302328 });
  function bake(root: T.Object3D) {
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (o instanceof T.Mesh) {
        // GLB primitives have individual materials; preserve their original textured surfaces.
        const material = o.material as T.Material;
        if (Array.isArray(material))
          throw new Error("Expected individual casino GLB primitives");
        const key = `${material.uuid}:${visibleMin}:${visibleMax}`;
        if (!batches.has(key))
          batches.set(key, {
            material,
            geos: [],
            min: visibleMin,
            max: visibleMax,
          });
        batches
          .get(key)!
          .geos.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
      }
    });
  }
  function box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat = brass,
  ) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    bake(m);
    m.geometry.dispose();
  }
  function fit(
    key: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    rotation = 0,
  ) {
    const m = assets.fit(key, w, h, d);
    m.position.set(x, y, z);
    m.rotation.y = rotation;
    bake(m);
  }
  function sign(
    text: string,
    x: number,
    y: number,
    z: number,
    rotation = 0,
    width = 9,
    color = "#f4d58b",
    twoSided = false,
  ) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 96;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#191820";
    ctx.fillRect(0, 0, 512, 96);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(5, 5, 502, 86);
    ctx.font = "bold 28px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(text, 256, 48, 480);
    const texture = new T.CanvasTexture(c);
    texture.magFilter = T.NearestFilter;
    texture.colorSpace = T.SRGBColorSpace;
    const height = (width * 96) / 512,
      ceiling = Math.floor(y / 5) * 5 + 4.4;
    const { faces, hardware } = createSignPanel(texture, width, height, {
      twoSided,
      suspension: ceiling - y - height / 2 - 0.06,
    });
    for (const object of [faces, hardware]) {
      object.position.set(x, y, z);
      object.rotation.y = rotation;
    }
    scene.add(faces);
    bake(hardware);
  }
  for (const s of casinoSurfaces) {
    visibleMin = -Infinity;
    visibleMax = Infinity;
    if (s.endY !== undefined) {
      const steps = 30,
        dz = (s.z1 - s.z0) / steps;
      for (let i = 0; i < steps; i++) {
        const z = s.z0 + i * dz,
          top = s.y + ((s.endY - s.y) * (i + 0.5)) / steps;
        box(
          (s.x0 + s.x1) / 2,
          top - 0.18,
          z + dz / 2,
          s.x1 - s.x0,
          0.36,
          dz,
          dark,
        );
        box((s.x0 + s.x1) / 2, top + 0.01, z + 0.03, s.x1 - s.x0, 0.04, 0.08);
      }
      continue;
    }
    for (let x = s.x0; x < s.x1; x += 4)
      for (let z = s.z0; z < s.z1; z += 4) {
        const w = Math.min(4, s.x1 - x),
          d = Math.min(4, s.z1 - z),
          cx = x + w / 2,
          cz = z + d / 2;
        const r = casinoRooms.find(
          (r) =>
            r.y === s.y && cx >= r.x0 && cx <= r.x1 && cz >= r.z0 && cz <= r.z1,
        );
        if (s.y < 10)
          fit(
            r && s.y >= 0 ? "carpet" : "marble",
            cx,
            s.y - 0.3,
            cz,
            w,
            0.3,
            d,
          );
      }
  }
  // Coffered ceilings at a larger module than the carpet, with real slabs left
  // visible from every camera height (including through the stair openings).
  for (const s of casinoSurfaces.filter(
    (s) => s.endY === undefined && s.y > -5,
  ))
    for (let x = s.x0; x < s.x1; x += 8)
      for (let z = s.z0; z < s.z1; z += 8) {
        const w = Math.min(8, s.x1 - x),
          d = Math.min(8, s.z1 - z);
        fit("ceiling", x + w / 2, s.y - 0.6, z + d / 2, w, 0.3, d);
      }
  for (const b of casinoWalls) {
    visibleMin = b.y0 === 8 ? 0 : b.y0;
    visibleMax = b.y0 === 0 ? 16 : b.y0 + 8;
    const w = b.x1 - b.x0,
      d = b.z1 - b.z0,
      h = b.y1 - b.y0;
    if (h < 2) {
      visibleMin = 0;
      visibleMax = 16;
      const alongX = w > d,
        length = alongX ? w : d;
      for (let n = 0; n < length; n += 2) {
        const span = Math.min(2, length - n);
        fit(
          "railing",
          alongX ? b.x0 + n + span / 2 : (b.x0 + b.x1) / 2,
          b.y0,
          alongX ? (b.z0 + b.z1) / 2 : b.z0 + n + span / 2,
          span,
          h,
          alongX ? d : w,
          alongX ? 0 : Math.PI / 2,
        );
      }
      continue;
    }
    const alongX = w > d,
      length = alongX ? w : d;
    for (let n = 0; n < length; n += 4)
      for (let y = b.y0; y < b.y1; y += 2.2) {
        const span = Math.min(4, length - n),
          height = Math.min(2.2, b.y1 - y);
        fit(
          b.y0 < 0 ? "panel" : "wall",
          alongX ? b.x0 + n + span / 2 : (b.x0 + b.x1) / 2,
          y,
          alongX ? (b.z0 + b.z1) / 2 : b.z0 + n + span / 2,
          span,
          height,
          alongX ? d : w,
          alongX ? 0 : Math.PI / 2,
        );
      }
    box((b.x0 + b.x1) / 2, b.y0 + 0.15, (b.z0 + b.z1) / 2, w, 0.22, d + 0.05);
    box((b.x0 + b.x1) / 2, b.y1 - 0.2, (b.z0 + b.z1) / 2, w, 0.15, d + 0.05);
  }
  for (const f of casinoFurniture) {
    visibleMin = f.y;
    visibleMax = f.y === 0 ? 16 : f.y + 8;
    fit(f.key, f.x, f.y, f.z, f.width, f.height, f.depth, f.rotation);
    if (f.key === "roulette")
      fit("wheel", f.x - 1, f.y + 0.95, f.z, 0.9, 0.22, 0.9);
  }
  for (const r of casinoRooms) {
    visibleMin = r.y;
    visibleMax = r.y + 8;
    const inner = r.x0 < 0 ? r.x1 : r.x0,
      cz = (r.z0 + r.z1) / 2;
    sign(
      r.name,
      inner + (inner < 0 ? 0.34 : -0.34),
      r.y + 3.65,
      cz,
      inner < 0 ? Math.PI / 2 : -Math.PI / 2,
      5,
      r.y === 5 ? "#dcbaed" : r.y < 0 ? "#8cddd2" : "#f4d58b",
    );
    sign(r.name, (r.x0 + r.x1) / 2, r.y + 3.65, r.z0 - 0.4, Math.PI, 5);
    sign(r.name, (r.x0 + r.x1) / 2, r.y + 3.65, r.z1 + 0.4, 0, 5);
    fit("doorframe", inner, r.y, cz, 5.4, 4.4, 0.55, Math.PI / 2);
    for (const z of [r.z0, r.z1])
      fit("doorframe", (r.x0 + r.x1) / 2, r.y, z, 6.4, 4.4, 0.55);
    // Lit brass strips announce each doorway even from the next corridor.
    for (const dz of [-2.5, 2.5]) box(inner, r.y + 1.5, cz + dz, 0.5, 3, 0.12);
  }
  // Wayfinding only at real stair approaches, with visible ceiling hangers.
  for (const side of [-1, 1]) {
    sign("UPPER SALONS  ↑", side * 34, 3, 9, 0, 4, "#f4d58b", true);
    sign("MAIN FLOOR  ↓", side * 34, 8, -9, Math.PI, 4, "#f4d58b", true);
    sign("VAULTS / CASH  ↓", side * 24, 3, -9, Math.PI, 4, "#91dacf", true);
    sign("MAIN FLOOR  ↑", side * 24, -2, 9, 0, 4, "#91dacf", true);
  }
  visibleMin = 0;
  visibleMax = 16;
  for (const c of casinoColumns)
    fit("column", c.x, 0, c.z, c.width, c.height, c.width);
  // A central suspended gold landmark remains visible from balcony and entrance.
  const emblem = new T.Group();
  emblem.position.set(0, 7.5, 0);
  const ring = new T.Mesh(new T.TorusGeometry(2.5, 0.12, 6, 32), brass);
  ring.rotation.x = Math.PI / 2;
  emblem.add(ring);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const gem = new T.Mesh(
      new T.OctahedronGeometry(0.3),
      new T.MeshBasicMaterial({ color: 0xffd994 }),
    );
    gem.position.set(Math.cos(a) * 2.5, -0.5, Math.sin(a) * 2.5);
    emblem.add(gem);
  }
  scene.add(emblem);
  for (const { material, geos, min, max } of batches.values()) {
    const geometry = mergeGeometries(geos);
    if (geometry) {
      const mesh = new T.Mesh(geometry, material);
      mesh.userData.casinoRange = [min, max];
      scene.add(mesh);
    }
    for (const g of geos) g.dispose();
  }
  return emblem;
}

export function updateCasinoVisibility(scene: T.Scene, _eyeY: number) {
  // The atrium, ramps and balcony drops expose adjoining storeys. Camera-height
  // culling is not occlusion testing; let the GPU depth buffer hide solid decks.
  for (const object of scene.children)
    if (object.userData.casinoRange) object.visible = !object.userData.broken;
}
