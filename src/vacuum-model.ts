import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { COSMETICS, type Cosmetic } from "./workshop-state";

export type VacuumMaterials = Map<string, T.MeshLambertMaterial>;
const slots = ["body", "trim", "dark", "accent", "coupler"] as const;
let asset: Promise<T.Group> | undefined;

export function applyVacuumColour(
  materials: VacuumMaterials,
  colour: Cosmetic,
) {
  for (const slot of slots)
    materials.get(slot)!.color.setHex(colour[slot] ?? colour.body);
}
export function createVacuumMaterials(): VacuumMaterials {
  const materials = new Map(
    slots.map((slot) => [
      slot,
      new T.MeshLambertMaterial({ name: slot, flatShading: true }),
    ]),
  );
  applyVacuumColour(materials, COSMETICS[0]);
  return materials;
}
/** One network request and shared geometry; each presentation owns its colours. */
export async function loadVacuumModel(
  materials: VacuumMaterials,
): Promise<T.Group> {
  asset ??= new GLTFLoader()
    .loadAsync(`${import.meta.env.BASE_URL}assets/vacuum/vaccoin-vacuum.glb`)
    .then((g) => g.scene);
  const model = (await asset).clone(true);
  model.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    const source = o.material as T.Material;
    const material = materials.get(source.name) ?? materials.get("body")!;
    // The authored hose ribs and intake use two-sided surfaces. Recolouring
    // must retain their visibility, including when viewed from behind.
    if (material.side !== source.side) {
      material.side = source.side;
      material.needsUpdate = true;
    }
    o.material = material;
  });
  return model;
}
