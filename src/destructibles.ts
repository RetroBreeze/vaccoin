import { Group, Scene, Vector3 } from "three";
import { Assets } from "./assets";
import { Coins } from "./coins";
import { Player } from "./player";
import { SMALL_CRATE_COINS, LARGE_CRATE_COINS } from "./coin-counts";
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
}
export class Destructibles {
  readonly objects: Crate[] = [];
  constructor(
    scene: Scene,
    assets: Assets,
    private coins: Coins,
    private onBurst: (x: number, y: number, z: number, n: number) => void,
  ) {
    const small = [
      [-5, 0, 12],
      [6, 0, 7],
      [-12, 0, -5],
      [12, 0, -5],
      [-24, 6, 3],
      [24, 6, 3],
      [-10, 6, -7],
      [10, 6, -7],
      [-14, -6, -25],
      [14, -6, -25],
      [-5, -6, -15],
      [5, -6, -15],
    ];
    const large = [
      [-11, 0, 16],
      [11, 0, 16],
      [-23, 6, -5],
      [23, 6, -5],
      [-3, 6, -6],
      [3, 6, -6],
      [-13, -6, -20],
      [13, -6, -20],
    ];
    for (const [positions, isLarge] of [
      [small, false],
      [large, true],
    ] as const)
      for (const [x, y, z] of positions) {
        const mesh = assets.model(
          isLarge ? "large" : "small",
          isLarge ? 2.25 : 1.2,
        );
        mesh.position.set(x, y, z);
        mesh.rotation.y = x < 0 ? 0.15 : -0.15;
        scene.add(mesh);
        this.objects.push({
          mesh,
          x,
          y,
          z,
          large: isLarge,
          broken: false,
          strain: 0,
          coins: isLarge ? LARGE_CRATE_COINS : SMALL_CRATE_COINS,
        });
      }
  }
  reset() {
    for (const o of this.objects) {
      o.broken = false;
      o.strain = 0;
      o.mesh.visible = true;
      o.mesh.position.set(o.x, o.y, o.z);
      o.mesh.rotation.z = 0;
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
        dy = o.y + 0.6 - eye.y,
        dz = o.z - eye.z,
        d = Math.hypot(dx, dy, dz);
      let hit = false;
      if (!o.large) {
        const focused =
          sucking &&
          d < 10 &&
          dx * direction.x + dy * direction.y + dz * direction.z > d * 0.65 &&
          !lineBlocked(eye.x, eye.y, eye.z, o.x, o.y + 0.6, o.z);
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
        pd < (o.large ? 1.55 : 0.85)
      ) {
        if (o.large && player.speed >= 9) hit = true;
        else {
          const push = (o.large ? 1.55 : 0.85) - pd;
          player.position.x += (pd > 0.001 ? pdx / pd : 1) * push;
          player.position.z += (pd > 0.001 ? pdz / pd : 0) * push;
        }
      }
      if (hit) {
        o.broken = true;
        o.mesh.visible = false;
        const centerY = o.y + (o.large ? 1.1 : 0.6);
        this.coins.burst(o.x, centerY, o.z, o.coins);
        this.onBurst(o.x, centerY, o.z, o.coins);
        destroyed++;
      }
    }
    return destroyed;
  }
}
