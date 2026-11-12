import type { Vector3 } from "three";
import { casinoFurniture } from "./casino-layout";
import type { Coins } from "./coins";
import type { FurnitureInstances } from "./furniture-rendering";
import { advanceFurniture, furnitureExtent } from "./furniture-motion";
import { furnitureCoinReward } from "./furniture-rewards";
import type { Player } from "./player";
import {
  lineBlocked,
  resetFurnitureCollisions,
  setFurnitureBroken,
} from "./terrain";

/** Running tosses furniture; suction alone breaks it and awards coins. */
export class FurnitureDestructibles {
  readonly objects = casinoFurniture.map((spec, id) => ({
    ...spec,
    id,
    broken: false,
    strain: 0,
    rx: 0,
    rz: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    spinX: 0,
    spinZ: 0,
    moving: false,
    tossed: false,
    cooldown: 0,
  }));
  private readonly supported: number[][];

  constructor(
    private display: FurnitureInstances,
    private coins: Coins,
    private onBurst: (x: number, y: number, z: number, n: number) => void,
  ) {
    this.supported = this.objects.map((parent) =>
      parent.solid
        ? this.objects
            .filter((child) => {
              if (
                child.solid ||
                Math.abs(child.y - parent.y - parent.height) > 0.05
              )
                return false;
              const dx = child.x - parent.x,
                dz = child.z - parent.z;
              const c = Math.cos(parent.rotation),
                s = Math.sin(parent.rotation);
              return (
                Math.abs(dx * c - dz * s) <= parent.width / 2 &&
                Math.abs(dx * s + dz * c) <= parent.depth / 2
              );
            })
            .map((child) => child.id)
        : [],
    );
  }

  reset() {
    for (const object of this.objects) {
      Object.assign(object, casinoFurniture[object.id], {
        broken: false,
        strain: 0,
        rx: 0,
        rz: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        spinX: 0,
        spinZ: 0,
        moving: false,
        tossed: false,
        cooldown: 0,
      });
    }
    resetFurnitureCollisions();
    this.display.reset();
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
    for (const object of this.objects) {
      if (object.broken) continue;
      const wasMoving = object.moving;
      advanceFurniture(object, dt);
      const dxPlayer = object.x - player.position.x,
        dzPlayer = object.z - player.position.z;
      const centerY = object.y + object.height / 2;
      const nearby =
        object.tossed &&
        Math.abs(dxPlayer) < Math.min(1.5, object.width / 2 + 0.6) &&
        Math.abs(dzPlayer) < Math.min(1.5, object.depth / 2 + 0.6) &&
        Math.abs(centerY - player.position.y - 0.8) <
          furnitureExtent(object) + 0.8 &&
        dxPlayer * player.pushDirection.x + dzPlayer * player.pushDirection.z >
          0;
      if (
        object.cooldown === 0 &&
        player.pushDirection.lengthSq() > 0 &&
        (player.pushContacts.has(object.id) || nearby)
      )
        this.toss(object.id, player);

      let focused = false;
      if (sucking) {
        const dx = object.x - eye.x,
          dy = object.y + object.height / 2 - eye.y,
          dz = object.z - eye.z;
        const d = Math.hypot(dx, dy, dz);
        focused =
          d < 7 &&
          dx * direction.x + dy * direction.y + dz * direction.z > d * 0.8 &&
          !lineBlocked(
            eye.x,
            eye.y,
            eye.z,
            object.x,
            object.y + object.height / 2,
            object.z,
            object.id,
          );
      }
      if (!focused && object.strain === 0 && !wasMoving && !object.moving)
        continue;
      object.strain = Math.max(
        0,
        object.strain + dt * (focused ? 1 / 0.9 : -1.5),
      );
      if (object.strain >= 1 - 1e-8) destroyed += this.break(object.id, time);
      else
        this.display.update(
          object.id,
          object.strain,
          false,
          time,
          object.tossed ? object : undefined,
        );
    }
    return destroyed;
  }

  private toss(id: number, player: Player) {
    const object = this.objects[id];
    if (object.broken) return;
    const first = !object.tossed;
    object.tossed = object.moving = true;
    object.cooldown = 0.35;
    setFurnitureBroken(id, true);
    const { x, z } = player.pushDirection;
    const speed = Math.max(7, Math.min(14, player.speed)),
      side = (id % 2 ? 1 : -1) * 4;
    object.vx = x * speed - z * side;
    object.vz = z * speed + x * side;
    object.vy = 5 + (id % 3);
    object.spinX = z * 8 + side;
    object.spinZ = -x * 8 + side;
    // Decorations fly independently once their supporting table is knocked away.
    if (first) for (const child of this.supported[id]) this.toss(child, player);
  }

  private break(id: number, time: number): number {
    const object = this.objects[id];
    if (object.broken) return 0;
    object.broken = true;
    object.strain = 0;
    // Clear physics before spawning the reward so coins can leave the old bounds.
    setFurnitureBroken(id, true);
    object.moving = false;
    this.display.update(id, 0, true, time, object.tossed ? object : undefined);
    const y = object.y + object.height / 2,
      reward = furnitureCoinReward(object.key);
    this.coins.burst(object.x, y, object.z, reward, "coins");
    this.onBurst(object.x, y, object.z, reward);
    let destroyed = 1;
    for (const child of this.supported[id])
      if (!this.objects[child].tossed) destroyed += this.break(child, time);
    return destroyed;
  }
}
