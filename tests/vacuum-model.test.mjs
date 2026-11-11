import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { Mesh } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createVacuumMaterials, loadVacuumModel } from "../src/vacuum-model";

it("retains the GLB surface sidedness when replacing materials for shop colours", async () => {
  const bytes = readFileSync(
    new URL("../public/assets/vacuum/vaccoin-vacuum.glb", import.meta.url),
  );
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  const original = await new GLTFLoader().parseAsync(buffer, "");
  const load = vi
    .spyOn(GLTFLoader.prototype, "loadAsync")
    .mockResolvedValue(original);
  try {
    const expected = new Map();
    original.scene.traverse((o) => {
      if (o instanceof Mesh) expected.set(o.name, o.material.side);
    });
    const materials = createVacuumMaterials();
    const model = await loadVacuumModel(materials);
    let checked = 0;
    model.traverse((o) => {
      if (o instanceof Mesh) {
        expect(o.material.side, `Missing back faces on ${o.name}`).toBe(
          expected.get(o.name),
        );
        const uv = o.geometry.getAttribute("uv");
        expect(uv, `${o.name} needs texture coordinates`).toBeDefined();
        expect(uv.count).toBe(o.geometry.getAttribute("position").count);
        expect([...uv.array].every(Number.isFinite)).toBe(true);
        // Every triangle must cover texture area, including intake and hose.
        const index = o.geometry.index;
        for (let i = 0; i < (index?.count ?? uv.count); i += 3) {
          const [a, b, c] = [0, 1, 2].map((j) =>
            index ? index.getX(i + j) : i + j,
          );
          const area =
            (uv.getX(b) - uv.getX(a)) * (uv.getY(c) - uv.getY(a)) -
            (uv.getY(b) - uv.getY(a)) * (uv.getX(c) - uv.getX(a));
          expect(Math.abs(area), `${o.name} triangle ${i / 3}`).toBeGreaterThan(
            1e-10,
          );
        }
        checked++;
      }
    });
    expect(checked).toBe(5);
  } finally {
    load.mockRestore();
  }
});
