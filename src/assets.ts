import {
  Box3,
  Group,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  Vector3,
  BufferGeometry,
  Material,
} from "three";
import { makeCoinGeometry } from "./coin-geometry";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
export class Assets {
  private models = new Map<string, Group>();
  async load() {
    const loader = new GLTFLoader();
    await Promise.all(
      [
        ["coin", "board/coin_gold"],
        ["small", "resource/Containers_Crate_Small_Green"],
        ["large", "resource/Containers_Crate_Large"],
        ["gold", "resource/Gold_Bars_Stack_Large"],
        ["money", "resource/Money_Bills_Stack_Large"],
        ["chest", "resource/Gems_Chest"],
        ["vault", "block/vault"],
        ["blue", "block/colored_block_blue"],
        ["stripe", "block/striped_block_yellow"],
        ["frame", "block/metalframe"],
        ["pipe", "block/pipe"],
      ].map(async ([key, path]) => {
        const gltf = await loader.loadAsync(
          `${import.meta.env.BASE_URL}assets/${path}.gltf`,
        );
        gltf.scene.traverse((o) => {
          if (o instanceof Mesh) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const mat of mats) {
              const m = mat as MeshStandardMaterial;
              if (m.map) {
                m.map.magFilter = NearestFilter;
                m.map.minFilter = NearestFilter;
              }
              m.roughness = 1;
              m.metalness = 0;
            }
          }
        });
        this.models.set(key, gltf.scene);
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
