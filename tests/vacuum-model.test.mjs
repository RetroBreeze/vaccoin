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
        checked++;
      }
    });
    expect(checked).toBe(5);
  } finally {
    load.mockRestore();
  }
});
