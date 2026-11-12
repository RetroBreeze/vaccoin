import {
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Material,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Object3D,
  Scene,
} from "three";
import type { FurniturePose } from "./furniture-motion";
import { Assets } from "./assets";
import { casinoFurniture, type Furniture } from "./casino-layout";

interface FurnitureInstance {
  spec: Furniture;
  batch: InstancedMesh[];
  instance: number;
  strain: number;
  broken: boolean;
  time: number;
  pose?: FurniturePose;
}

export class FurnitureInstances {
  private readonly objects: FurnitureInstance[] = [];
  private readonly transform = new Object3D();
  private readonly tint = new Color();

  constructor(scene: Scene, assets: Assets) {
    const groups = new Map<string, number[]>(),
      materials = new Map<Material, Material>(),
      warmth = new Color().setRGB(0.1, 0.065, 0.025);
    const cloneMaterial = (source: Material) => {
      let material = materials.get(source);
      if (!material) {
        material = source.clone();
        if (
          material instanceof MeshLambertMaterial ||
          material instanceof MeshStandardMaterial
        ) {
          material.emissive.add(warmth);
          material.emissiveIntensity = Math.max(1, material.emissiveIntensity);
        }
        materials.set(source, material);
      }
      return material;
    };
    casinoFurniture.forEach((spec, index) => {
      const key = `${spec.key}:${spec.width}:${spec.height}:${spec.depth}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(index);
    });
    for (const indices of groups.values()) {
      const spec = casinoFurniture[indices[0]],
        prototype = new Group(),
        batch: InstancedMesh[] = [];
      prototype.add(assets.fit(spec.key, spec.width, spec.height, spec.depth));
      if (spec.key === "roulette") {
        const wheel = assets.fit("wheel", 0.9, 0.22, 0.9);
        wheel.position.set(-1, 0.95, 0);
        prototype.add(wheel);
      }
      prototype.updateMatrixWorld(true);
      prototype.traverse((part) => {
        if (!(part instanceof Mesh)) return;
        // Bake the complete fitted hierarchy once, keeping placement and motion
        // in instance matrices so every sub-part disappears with its owner.
        const geometry = part.geometry.clone().applyMatrix4(part.matrixWorld),
          material = Array.isArray(part.material)
            ? part.material.map(cloneMaterial)
            : cloneMaterial(part.material),
          mesh = new InstancedMesh(geometry, material, indices.length);
        mesh.name = `furniture-${spec.key}`;
        mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        // Batches span multiple rooms/storeys and their instances can shake.
        mesh.frustumCulled = false;
        scene.add(mesh);
        batch.push(mesh);
      });
      indices.forEach((index, instance) => {
        const object: FurnitureInstance = {
          spec: casinoFurniture[index],
          batch,
          instance,
          strain: 0,
          broken: false,
          time: 0,
        };
        this.objects[index] = object;
        this.write(object, true, false);
      });
      for (const mesh of batch) mesh.instanceColor!.setUsage(DynamicDrawUsage);
    }
  }

  update(
    index: number,
    strain: number,
    broken: boolean,
    time: number,
    pose?: FurniturePose,
  ): void {
    const object = this.objects[index];
    strain = Math.max(0, Math.min(1, strain));
    if (
      !pose &&
      !object.pose &&
      object.broken === broken &&
      (broken ||
        (object.strain === strain && (strain === 0 || object.time === time)))
    )
      return;
    const tintChanged = object.strain !== strain;
    object.strain = strain;
    object.broken = broken;
    object.time = time;
    object.pose = pose;
    this.write(object, tintChanged);
  }

  reset(): void {
    this.objects.forEach((_, index) => this.update(index, 0, false, 0));
  }

  private write(object: FurnitureInstance, tintChanged: boolean, dirty = true) {
    const { spec, strain, broken, time, instance } = object,
      pose = object.pose ?? { ...spec, rx: 0, rz: 0 },
      shake = broken ? 0 : strain,
      phase = time * 55 + spec.x * 0.7 + spec.z;
    this.transform.position.set(
      pose.x + Math.sin(phase) * shake * 0.065,
      pose.y,
      pose.z + Math.cos(phase * 0.83) * shake * 0.035,
    );
    this.transform.rotation.set(
      pose.rx,
      pose.rotation,
      pose.rz + Math.sin(phase * 1.19) * shake * 0.045,
    );
    // Rotate around the fitted model's center, rather than swinging about its feet.
    if (object.pose) {
      this.transform.position.y += spec.height / 2;
      this.transform.translateY(-spec.height / 2);
    }
    this.transform.scale.setScalar(broken ? 0 : 1);
    this.transform.updateMatrix();
    this.tint.setRGB(
      1.1 + strain * 0.65,
      1.06 + strain * 0.38,
      1.01 + strain * 0.08,
    );
    for (const mesh of object.batch) {
      mesh.setMatrixAt(instance, this.transform.matrix);
      if (dirty) {
        mesh.instanceMatrix.addUpdateRange(instance * 16, 16);
        mesh.instanceMatrix.needsUpdate = true;
      }
      if (tintChanged) {
        mesh.setColorAt(instance, this.tint);
        if (dirty) {
          mesh.instanceColor!.addUpdateRange(instance * 3, 3);
          mesh.instanceColor!.needsUpdate = true;
        }
      }
    }
  }
}
