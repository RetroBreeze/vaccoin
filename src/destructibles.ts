import { casinoMachines } from "./casino-layout";
import { Group, Scene, Vector3, Mesh, InstancedMesh } from "three";
import { Assets } from "./assets";
import { Coins } from "./coins";
import { Player } from "./player";
import { lineBlocked } from "./terrain";
export interface Crate {
  mesh: Group;
  x: number;
  y: number;
  z: number;
  large: boolean;
  broken: boolean;
  strain: number;
  coins: number;
  instance: number;
  batch: InstancedMesh[];
}
export class Destructibles {
  readonly objects: Crate[] = [];
  constructor(
    scene: Scene,
    assets: Assets,
    private coins: Coins,
    private onBurst: (x: number, y: number, z: number, n: number) => void,
  ) {
    for (const key of new Set(casinoMachines.map((m) => m.key))) {
      const specs = casinoMachines.filter((m) => m.key === key),
        prototype = assets.model(key, 2.4),
        batch: InstancedMesh[] = [];
      prototype.updateMatrixWorld(true);
      prototype.traverse((part) => {
        if (part instanceof Mesh) {
          const geometry = part.geometry.clone().applyMatrix4(part.matrixWorld);
          const mesh = new InstancedMesh(geometry, part.material, specs.length);
          mesh.frustumCulled = false;
          scene.add(mesh);
          batch.push(mesh);
        }
      });
      for (const [instance, spec] of specs.entries()) {
        const mesh = new Group();
        mesh.position.set(spec.x, spec.y, spec.z);
        mesh.rotation.y = spec.rotation;
        const object = {
          mesh,
          x: spec.x,
          y: spec.y,
          z: spec.z,
          large: false,
          broken: false,
          strain: 0,
          coins: spec.coins,
          instance,
          batch,
        };
        this.objects.push(object);
        this.write(object);
      }
    }
  }
  private write(object: Crate) {
    object.mesh.scale.setScalar(object.broken ? 0 : 1);
    object.mesh.updateMatrix();
    for (const mesh of object.batch) {
      mesh.setMatrixAt(object.instance, object.mesh.matrix);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  reset() {
    for (const o of this.objects) {
      o.broken = false;
      o.strain = 0;
      o.mesh.visible = true;
      o.mesh.userData.broken = false;
      o.mesh.position.set(o.x, o.y, o.z);
      o.mesh.rotation.z = 0;
      this.write(o);
    }
  }
  update(
    dt: number,
    time: number,
    player: Player,
    eye: Vector3,
    direction: Vector3,
    sucking: boolean,
  ) {
    let destroyed = 0;
    for (const o of this.objects) {
      if (o.broken) continue;
      const dx = o.x - eye.x,
        dy = o.y + 1.5 - eye.y,
        dz = o.z - eye.z,
        d = Math.hypot(dx, dy, dz);
      let hit = false;
      const wasStrained = o.strain > 0;
      if (!o.large) {
        const focused =
          sucking &&
          d < 10 &&
          dx * direction.x + dy * direction.y + dz * direction.z > d * 0.65 &&
          !lineBlocked(eye.x, eye.y, eye.z, o.x, o.y + 1.5, o.z);
        o.strain = Math.max(0, o.strain + (focused ? dt : -dt * 2));
        o.mesh.position.x = o.x + Math.sin(time * 85) * o.strain * 0.2;
        o.mesh.rotation.z = Math.sin(time * 66) * o.strain * 0.13;
        hit = o.strain > 0.48;
      }
      const pdx = player.position.x - o.x,
        pdz = player.position.z - o.z,
        pd = Math.hypot(pdx, pdz);
      if (
        Math.abs(player.position.y - o.y) < 1.5 &&
        pd < (o.large ? 1.55 : 0.65)
      ) {
        if (o.large && player.speed >= 9) hit = true;
        else {
          const push = (o.large ? 1.55 : 0.65) - pd;
          player.position.x += (pd > 0.001 ? pdx / pd : 1) * push;
          player.position.z += (pd > 0.001 ? pdz / pd : 0) * push;
        }
      }
      if (o.strain > 0 || wasStrained) this.write(o);
      if (hit) {
        o.broken = true;
        o.mesh.visible = false;
        o.mesh.userData.broken = true;
        this.write(o);
        const centerY = o.y + 1.5;
        this.coins.burst(o.x, centerY, o.z, o.coins);
        this.onBurst(o.x, centerY, o.z, o.coins);
        destroyed++;
      }
    }
    return destroyed;
  }
}
