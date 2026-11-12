import { casinoLoot } from "./casino-loot";
import {
  BufferGeometry,
  DynamicDrawUsage,
  InstancedMesh,
  Material,
  Object3D,
  Vector3,
} from "three";
import { casinoMachines, CASINO_BOUNDS } from "./casino-layout";
import {
  collectibleShapes,
  VALUES,
  ITEM_NAMES,
  burstKind,
} from "./collectibles";
import { SpatialHash } from "./spatial";
import {
  ceilingHeight,
  coinSolid,
  landingHeight,
  lineBlocked,
  obstacles,
} from "./terrain";
import { LOOSE_COINS, TOTAL_COINS } from "./coin-counts";
export { LOOSE_COINS, TOTAL_COINS } from "./coin-counts";
export const MAX_ACTIVE = 1800;
export const SUCTION_RANGE = 9.5;
export function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export class Coins {
  readonly positions = new Float32Array(TOTAL_COINS * 3);
  private velocities = new Float32Array(TOTAL_COINS * 3);
  // 0 unused, 1 resting, 2 attracted, 3 ballistic, 4 collected, 5 queued eruption.
  readonly state = new Uint8Array(TOTAL_COINS);
  private age = new Float32Array(TOTAL_COINS);
  private pickupDelay = new Float32Array(TOTAL_COINS);
  private pending: number[] = [];
  readonly mesh: InstancedMesh;
  readonly meshes: InstancedMesh[];
  readonly kinds = new Uint8Array(TOTAL_COINS);
  private slots = new Uint32Array(TOTAL_COINS);
  private kindCounts = new Uint32Array(18);
  private meshIds = new Uint8Array(TOTAL_COINS);
  score = 0;
  pickup = "";
  pickupTime = 0;
  readonly grid = new SpatialHash(4);
  private active: number[] = [];
  private nearby: number[] = [];
  private dummy = new Object3D();
  private queryTime = 0;
  private time = 0;
  private dirtyMin = TOTAL_COINS;
  private dirtyMax = 0;
  private meshDirtyMin = new Uint32Array(18).fill(TOTAL_COINS);
  private meshDirtyMax = new Int32Array(18).fill(-1);
  count = 0;
  collected = 0;
  constructor(geometry: BufferGeometry, material: Material | Material[]) {
    const shapes = collectibleShapes(geometry, material);
    const capacities = new Uint32Array(18);
    for (const item of casinoLoot)
      capacities[(item.y < -2 ? 0 : item.y > 4 ? 12 : 6) + item.kind]++;
    for (const m of casinoMachines)
      for (let i = 0; i < m.coins; i++)
        capacities[(m.y < -2 ? 0 : m.y > 4 ? 12 : 6) + burstKind(i)]++;
    this.meshes = Array.from({ length: 18 }, (_, index) => {
      const shape = shapes[index % 6];
      const mesh = new InstancedMesh(
        shape.geometry,
        shape.material,
        // Reserve only this kind/floor's budget, not the entire casino eighteen times.
        capacities[index] + (index % 6 <= 2 ? TOTAL_COINS - LOOSE_COINS : 0),
      );
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.frustumCulled = false;
      return mesh;
    });
    this.mesh = this.meshes[6];
    this.reset();
  }
  get activeCount() {
    return this.active.length;
  }
  reset() {
    this.count = 0;
    this.collected = 0;
    this.score = 0;
    this.pickup = "";
    this.pickupTime = 0;
    this.kinds.fill(0);
    this.kindCounts.fill(0);
    this.state.fill(0);
    this.velocities.fill(0);
    this.age.fill(0);
    this.pickupDelay.fill(0);
    this.pending.length = 0;
    this.active.length = 0;
    this.grid.clear();
    this.queryTime = 0;
    this.time = 0;
    for (const item of casinoLoot) this.add(item.x, item.y, item.z, item.kind);
    this.meshes.forEach((mesh, k) => (mesh.count = this.kindCounts[k]));
    this.mesh.instanceMatrix.needsUpdate = true;
    this.dirtyMin = 0;
    this.dirtyMax = this.count - 1;
    this.flush();
  }
  private add(x: number, y: number, z: number, kind = 0) {
    const id = this.count++,
      p = id * 3;
    this.positions[p] = x;
    this.positions[p + 1] = y;
    this.positions[p + 2] = z;
    this.kinds[id] = kind;
    this.meshIds[id] = (y < -2 ? 0 : y > 4 ? 12 : 6) + kind;
    this.slots[id] = this.kindCounts[this.meshIds[id]]++;
    this.state[id] = 1;
    this.grid.add(id, x, y, z);
    this.write(id);
    return id;
  }
  private write(id: number) {
    const p = id * 3;
    this.dummy.position.set(
      this.positions[p],
      this.positions[p + 1],
      this.positions[p + 2],
    );
    const alive = this.state[id] !== 4;
    this.dummy.scale.setScalar(alive ? 1 : 0);
    this.dummy.rotation.set(
      this.state[id] === 1 ? 0.15 : this.time * 9 + id,
      id * 2.399 + this.time * (this.state[id] === 1 ? 0 : 5),
      this.state[id] === 1 ? ((id % 3) - 1) * 0.3 : this.time * 7,
    );
    this.dummy.updateMatrix();
    this.meshes[this.meshIds[id]].setMatrixAt(
      this.slots[id],
      this.dummy.matrix,
    );
    const meshId = this.meshIds[id],
      slot = this.slots[id];
    this.meshDirtyMin[meshId] = Math.min(this.meshDirtyMin[meshId], slot);
    this.meshDirtyMax[meshId] = Math.max(this.meshDirtyMax[meshId], slot);
    this.dirtyMin = Math.min(this.dirtyMin, id);
    this.dirtyMax = Math.max(this.dirtyMax, id);
  }
  flush() {
    if (this.dirtyMin <= this.dirtyMax) {
      for (let i = 0; i < this.meshes.length; i++) {
        const min = this.meshDirtyMin[i],
          max = this.meshDirtyMax[i];
        if (min > max) continue;
        const mesh = this.meshes[i];
        // Keep pending ranges for hidden meshes until Three uploads and clears them.
        mesh.instanceMatrix.addUpdateRange(min * 16, (max - min + 1) * 16);
        mesh.instanceMatrix.needsUpdate = true;
        this.meshDirtyMin[i] = TOTAL_COINS;
        this.meshDirtyMax[i] = -1;
      }
      this.dirtyMin = TOTAL_COINS;
      this.dirtyMax = 0;
    }
  }
  burst(
    x: number,
    y: number,
    z: number,
    n: number,
    composition: "mixed" | "coins" = "mixed",
  ) {
    const amount = Math.min(n, TOTAL_COINS - this.count);
    // Each source gets the same shower regardless of which wing was visited first.
    const burstRandom = seeded(Math.round(x * 71 + y * 137 + z * 197));
    for (let j = 0; j < amount; j++) {
      const id = this.count++,
        p = id * 3,
        a = burstRandom() * Math.PI * 2;
      this.positions[p] = x + (burstRandom() - 0.5) * 0.8;
      this.positions[p + 1] = y + burstRandom() * 0.6;
      this.positions[p + 2] = z + (burstRandom() - 0.5) * 0.8;
      this.velocities[p] = Math.cos(a) * (6 + burstRandom() * 5);
      this.velocities[p + 1] = 9 + burstRandom() * 6;
      this.velocities[p + 2] = Math.sin(a) * (6 + burstRandom() * 5);
      const kind = composition === "coins" ? 0 : burstKind(j);
      this.kinds[id] = kind;
      this.meshIds[id] = (y < -2 ? 0 : y > 4 ? 12 : 6) + kind;
      this.slots[id] = this.kindCounts[this.meshIds[id]]++;
      this.age[id] = 0;
      this.pickupDelay[id] = 0.35 + burstRandom() * 0.25;
      if (this.active.length < MAX_ACTIVE) {
        this.state[id] = 3;
        this.active.push(id);
      } else {
        // Keep the eruption queued when physics is saturated; never silently
        // turn a burst into motionless coins. Freed slots launch these first.
        this.state[id] = 5;
        this.pending.push(id);
      }
      this.write(id);
    }
    this.meshes.forEach((mesh, k) => (mesh.count = this.kindCounts[k]));
    return amount;
  }
  update(
    dt: number,
    eye: Vector3,
    direction: Vector3,
    target: Vector3,
    sucking: boolean,
  ) {
    this.time += dt;
    this.pickupTime = Math.max(0, this.pickupTime - dt);
    this.queryTime -= dt;
    let gained = 0;
    while (this.pending.length && this.active.length < MAX_ACTIVE) {
      const id = this.pending.pop()!;
      this.state[id] = 3;
      this.active.push(id);
    }
    if (sucking && this.queryTime <= 0) {
      this.queryTime = 1 / 30;
      this.grid.query(eye.x, eye.y, eye.z, SUCTION_RANGE, this.nearby);
      let activated = 0;
      for (const id of this.nearby) {
        if (this.active.length >= MAX_ACTIVE || activated >= 240) break;
        if (this.state[id] !== 1) continue;
        const p = id * 3,
          dx = this.positions[p] - eye.x,
          dy = this.positions[p + 1] - eye.y,
          dz = this.positions[p + 2] - eye.z,
          d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > SUCTION_RANGE * SUCTION_RANGE) continue;
        const dot = dx * direction.x + dy * direction.y + dz * direction.z;
        if (d2 > 5 && dot < Math.sqrt(d2) * 0.45) continue;
        if (
          lineBlocked(
            eye.x,
            eye.y,
            eye.z,
            this.positions[p],
            this.positions[p + 1],
            this.positions[p + 2],
          )
        )
          continue;
        this.state[id] = 2;
        this.age[id] = 0;
        this.active.push(id);
        activated++;
      }
    }
    for (let a = this.active.length - 1; a >= 0; a--) {
      const id = this.active[a],
        p = id * 3;
      this.age[id] += dt;
      this.pickupDelay[id] = Math.max(0, this.pickupDelay[id] - dt);
      let x = this.positions[p],
        y = this.positions[p + 1],
        z = this.positions[p + 2];
      if (this.state[id] === 3 && sucking && this.pickupDelay[id] === 0) {
        const dx = x - eye.x,
          dy = y - eye.y,
          dz = z - eye.z,
          d = Math.hypot(dx, dy, dz);
        if (
          d < SUCTION_RANGE &&
          (d < 2.5 ||
            dx * direction.x + dy * direction.y + dz * direction.z >
              d * 0.45) &&
          !lineBlocked(eye.x, eye.y, eye.z, x, y, z)
        )
          this.state[id] = 2;
      }
      if (this.state[id] === 2) {
        if (!sucking || this.age[id] > 4) {
          this.state[id] = 3;
          this.age[id] = 0;
        } else {
          const dx = target.x - x,
            dy = target.y - y,
            dz = target.z - z,
            d = Math.hypot(dx, dy, dz);
          const speed = 15 + 90 / (d + 1.5);
          if (
            (d < 0.65 || d < speed * dt) &&
            !lineBlocked(x, y, z, target.x, target.y, target.z)
          ) {
            this.state[id] = 4;
            this.collected++;
            const value = VALUES[this.kinds[id]];
            gained += value;
            this.score += value;
            if (value >= 25) {
              this.pickup = `${ITEM_NAMES[this.kinds[id]]} +${value}`;
              this.pickupTime = 1.1;
            }
            this.active[a] = this.active[this.active.length - 1];
            this.active.pop();
            this.write(id);
            continue;
          }
          // A damped velocity field gives an immediate response and a curved converging stream.
          const blend = 1 - Math.exp(-13 * dt),
            swirl = Math.min(1.7, d * 0.4),
            angle = this.time * 10 + id * 1.7;
          this.velocities[p] +=
            ((dx / d) * speed + Math.cos(angle) * swirl - this.velocities[p]) *
            blend;
          this.velocities[p + 1] +=
            ((dy / d) * speed +
              Math.sin(angle) * swirl -
              this.velocities[p + 1]) *
            blend;
          this.velocities[p + 2] +=
            ((dz / d) * speed - this.velocities[p + 2]) * blend;
        }
      }
      if (this.state[id] === 3) this.velocities[p + 1] -= 18 * dt;
      let nx = x + this.velocities[p] * dt,
        ny = y + this.velocities[p + 1] * dt,
        nz = z + this.velocities[p + 2] * dt;
      nx = Math.max(
        CASINO_BOUNDS.x0 + 0.5,
        Math.min(CASINO_BOUNDS.x1 - 0.5, nx),
      );
      nz = Math.max(
        CASINO_BOUNDS.z0 + 0.5,
        Math.min(CASINO_BOUNDS.z1 - 0.5, nz),
      );
      if (this.state[id] === 3) {
        if (coinSolid(nx, y, z)) {
          nx = x;
          this.velocities[p] *= -0.45;
        }
        if (coinSolid(nx, y, nz)) {
          nz = z;
          this.velocities[p + 2] *= -0.45;
        }
        const ceiling = ceilingHeight(nx, nz, y + 0.12, ny + 0.12);
        if (this.velocities[p + 1] > 0 && ceiling < Infinity) {
          ny = ceiling - 0.12;
          this.velocities[p + 1] *= -0.3;
        }
      }
      const ground = landingHeight(nx, nz, y - 0.1, ny - 0.1, 0);
      let onPillar = false;
      if (ground > -Infinity && ny <= ground + 0.16) {
        ny = ground + 0.16;
        if (this.state[id] === 3) {
          this.velocities[p + 1] *= -0.25;
          this.velocities[p] *= 0.7;
          this.velocities[p + 2] *= 0.7;
          // Spill off tall pillar caps instead of stranding collectible coins there.
          for (const b of obstacles) {
            if (
              ground !== b.y1 ||
              nx < b.x0 ||
              nx > b.x1 ||
              nz < b.z0 ||
              nz > b.z1
            )
              continue;
            onPillar = true;
            const dx = nx - (b.x0 + b.x1) / 2,
              dz = nz - (b.z0 + b.z1) / 2;
            if (Math.abs(dx) >= Math.abs(dz))
              this.velocities[p] = (dx >= 0 ? 1 : -1) * 4;
            else this.velocities[p + 2] = (dz >= 0 ? 1 : -1) * 4;
            break;
          }
        }
      }
      // Do not drag an already acquired coin through a deck when the player drops floors.
      if (this.state[id] === 2 && lineBlocked(x, y, z, nx, ny, nz)) {
        this.state[id] = 3;
        this.velocities[p] =
          this.velocities[p + 1] =
          this.velocities[p + 2] =
            0;
        nx = x;
        ny = y;
        nz = z;
        this.age[id] = 0;
      }
      this.positions[p] = nx;
      this.positions[p + 1] = ny;
      this.positions[p + 2] = nz;
      if (
        this.state[id] === 3 &&
        this.age[id] > 1.5 &&
        ground > -Infinity &&
        !onPillar
      ) {
        this.state[id] = 1;
        this.grid.add(id, nx, ny, nz);
        this.active[a] = this.active[this.active.length - 1];
        this.active.pop();
      }
      this.write(id);
    }
    return gained;
  }
  updateVisibility(_eyeY: number, _x=0, _z=35) {
    // A connected atrium and stair shafts can reveal any storey. Do not hide
    // collectibles solely by camera height; this also preserves dropped loot.
    for(const mesh of this.meshes)mesh.visible=true;
  }
  countAlive() {
    let n = 0;
    for (let i = 0; i < this.count; i++) if (this.state[i] !== 4) n++;
    return n;
  }
}
