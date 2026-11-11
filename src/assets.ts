import {
  Box3,
  Group,
  Mesh,
  MeshStandardMaterial,
  MeshLambertMaterial,
  NearestFilter,
  Vector3,
  BufferGeometry,
  Material,
  Object3D,
} from "three";
import { makeCoinGeometry } from "./coin-geometry";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
export function prepareCasinoModel(root: Object3D) {
  const helpers: Object3D[] = [];
  root.traverse((o) => {
    if (
      /colonly/i.test(o.name) ||
      o.userData.casino_kind === "collision" ||
      o.userData.tg_kind === "collision"
    )
      helpers.push(o);
  });
  for (const helper of helpers) helper.removeFromParent();
}
// These casino props are static internally; each machine animates as one group.
// Merge their many authored sub-parts by material before cloning a bank of them.
export function batchCasinoModel(root: Group) {
  root.updateMatrixWorld(true);
  const batches = new Map<Material, BufferGeometry[]>();
  root.traverse((o) => {
    if (o instanceof Mesh && !Array.isArray(o.material)) {
      if (!batches.has(o.material)) batches.set(o.material, []);
      batches
        .get(o.material)!
        .push(o.geometry.clone().applyMatrix4(o.matrixWorld));
    }
  });
  const result = new Group();
  for (const [material, parts] of batches) {
    const geometry = mergeGeometries(parts);
    if (geometry) result.add(new Mesh(geometry, material));
    for (const part of parts) part.dispose();
  }
  return result;
}
export class Assets {
  private models = new Map<string, Group>();
  async load() {
    const loader = new GLTFLoader();
    const litMaterials = new Map<Material, MeshLambertMaterial>();
    await Promise.all(
      [
        ["coin", "board/coin_gold"],
        ...[
          "chair",
          "lounge-chair",
          "palm",
          "lamp",
          "cocktail",
          "trash",
          "doorframe",
          "railing",
          "wall",
          "panel",
          "carpet",
          "marble",
          "ceiling",
          "column",
          "sofa",
          "coffee",
          "slot-gold",
          "slot-classic",
          "slot-neon",
          "roulette",
          "poker",
          "blackjack",
          "cash-table",
          "wheel",
        ].map((key) => [key, `casino/${key}`]),
      ].map(async ([key, path]) => {
        const gltf = await loader.loadAsync(
          `${import.meta.env.BASE_URL}assets/${path}.${key === "coin" ? "gltf" : "glb"}`,
        );
        prepareCasinoModel(gltf.scene);
        gltf.scene.traverse((o) => {
          if (o instanceof Mesh) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            const converted = mats.map((mat) => {
              const m = mat as MeshStandardMaterial;
              if (m.map) {
                m.map.magFilter = NearestFilter;
                m.map.minFilter = NearestFilter;
              }
              // These packs bake their detail into textures. Diffuse lighting
              // preserves that style without running a PBR shader on every prop.
              if (!litMaterials.has(mat))
                litMaterials.set(
                  mat,
                  new MeshLambertMaterial({
                    color: m.color,
                    map: m.map,
                    emissive: m.emissive,
                    emissiveMap: m.emissiveMap,
                    emissiveIntensity: m.emissiveIntensity,
                    transparent: m.transparent,
                    opacity: m.opacity,
                    alphaTest: m.alphaTest,
                    side: m.side,
                    vertexColors: m.vertexColors,
                    flatShading: m.flatShading,
                  }),
                );
              return litMaterials.get(mat)!;
            });
            o.material = Array.isArray(o.material) ? converted : converted[0];
          }
        });
        this.models.set(
          key,
          key === "coin" ? gltf.scene : batchCasinoModel(gltf.scene),
        );
      }),
    );
  }
  model(key: string, size: number) {
    const group = this.models.get(key)!.clone(true);
    const b = new Box3().setFromObject(group),
      s = b.getSize(new Vector3()),
      scale = size / Math.max(s.x, s.y, s.z);
    group.scale.setScalar(scale);
    const c = b.getCenter(new Vector3());
    group.position.set(-c.x * scale, -b.min.y * scale, -c.z * scale);
    const wrapper = new Group();
    wrapper.add(group);
    return wrapper;
  }
  fit(key: string, width: number, height: number, depth: number) {
    const group = this.model(key, 1);
    const size = new Box3().setFromObject(group).getSize(new Vector3());
    group.scale.set(width / size.x, height / size.y, depth / size.z);
    return group;
  }
  coin(): { geometry: BufferGeometry; material: Material | Material[] } {
    const root = this.models.get("coin")!;
    root.updateMatrixWorld(true);
    let coin: Mesh | undefined;
    root.traverse((o) => {
      if (o instanceof Mesh && !coin) coin = o;
    });
    const mesh = coin!;
    const geometry = makeCoinGeometry();
    return { geometry, material: mesh.material };
  }
}
