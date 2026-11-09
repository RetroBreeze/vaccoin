import {
  BufferGeometry,
  DynamicDrawUsage,
  InstancedMesh,
  Material,
  Object3D,
  Vector3,
} from "three";
import { onSpringboard } from "./springboards";
import { SpatialHash } from "./spatial";
import {
  ceilingHeight,
  coinSolid,
  landingHeight,
  lineBlocked,
  obstacles,
  surfaces,
  surfaceHeight,
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
  readonly grid = new SpatialHash(4);
  private active: number[] = [];
  private nearby: number[] = [];
  private dummy = new Object3D();
  private queryTime = 0;
  private time = 0;
  private rand = seeded(81);
  private dirtyMin = TOTAL_COINS;
  private dirtyMax = 0;
  count = 0;
  collected = 0;
  constructor(geometry: BufferGeometry, material: Material | Material[]) {
    this.mesh = new InstancedMesh(geometry, material, TOTAL_COINS);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.reset();
  }
  get activeCount() {
    return this.active.length;
  }
  reset() {
    this.count = 0;
    this.collected = 0;
    this.state.fill(0);
    this.velocities.fill(0);
    this.age.fill(0);
    this.pickupDelay.fill(0);
    this.pending.length = 0;
    this.active.length = 0;
    this.grid.clear();
    this.queryTime = 0;
    this.time = 0;
    this.rand = seeded(81);
    // Hand-placed clusters make distinct repeatable route rewards; random only scatters coins within them.
    const patches = [
      [0, 13, 0, 7, 6, 1600],
      [-11, 8, 0, 5, 9, 900],
      [11, 8, 0, 5, 9, 900],
      [0, -5, 0, 12, 3, 900],
      [0, 23, 0, 16, 2, 500],
      [-23, 0, 6, 4, 7, 1000],
      [23, 0, 6, 4, 7, 1000],
      [0, -6, 6, 16, 3, 1000],
      [0, -25, -6, 16, 4, 1800],
      [-12, -15, -6, 5, 4, 700],
      [12, -15, -6, 5, 4, 700],
    ];
    for (const [cx, cz, y, rx, rz, n] of patches)
      for (let i = 0; i < n; i++) {
        let x = cx + (this.rand() * 2 - 1) * rx,
          z = cz + (this.rand() * 2 - 1) * rz;
        if (
          onSpringboard(x, y, z) ||
          obstacles.some(
            (b) =>
              x > b.x0 - 0.7 &&
              x < b.x1 + 0.7 &&
              z > b.z0 - 0.7 &&
              z < b.z1 + 0.7,
          )
        ) {
          i--;
          continue;
        }
        this.add(x, y + 0.17 + Math.pow(this.rand(), 3) * 0.8, z);
      }
    for (const id of [
      "west-rise",
      "east-rise",
      "west-descent",
      "east-descent",
    ]) {
      const s = surfaces.find((s) => s.id === id)!;
      for (let i = 0; i < 250; i++) {
        const z = s.z0 + 0.5 + this.rand() * (s.z1 - s.z0 - 1),
          x = (s.x0 + s.x1) / 2 + (this.rand() - 0.5) * 5;
        this.add(x, surfaceHeight(s, z) + 0.22 + this.rand() * 0.25, z);
      }
    }
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.dirtyMin = 0;
    this.dirtyMax = this.count - 1;
    this.flush();
  }
  private add(x: number, y: number, z: number) {
    const id = this.count++,
      p = id * 3;
    this.positions[p] = x;
    this.positions[p + 1] = y;
    this.positions[p + 2] = z;
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
    this.mesh.setMatrixAt(id, this.dummy.matrix);
    this.dirtyMin = Math.min(this.dirtyMin, id);
    this.dirtyMax = Math.max(this.dirtyMax, id);
  }
  flush() {
    if (this.dirtyMin <= this.dirtyMax) {
      this.mesh.instanceMatrix.clearUpdateRanges();
      this.mesh.instanceMatrix.addUpdateRange(
        this.dirtyMin * 16,
        (this.dirtyMax - this.dirtyMin + 1) * 16,
      );
      this.mesh.instanceMatrix.needsUpdate = true;
      this.dirtyMin = TOTAL_COINS;
      this.dirtyMax = 0;
    }
  }
  burst(x: number, y: number, z: number, n: number) {
    const amount = Math.min(n, TOTAL_COINS - this.count);
    for (let j = 0; j < amount; j++) {
      const id = this.count++,
        p = id * 3,
        a = this.rand() * Math.PI * 2;
      this.positions[p] = x + (this.rand() - 0.5) * 0.8;
      this.positions[p + 1] = y + this.rand() * 0.6;
      this.positions[p + 2] = z + (this.rand() - 0.5) * 0.8;
      this.velocities[p] = Math.cos(a) * (6 + this.rand() * 5);
      this.velocities[p + 1] = 9 + this.rand() * 6;
      this.velocities[p + 2] = Math.sin(a) * (6 + this.rand() * 5);
      this.age[id] = 0;
      this.pickupDelay[id] = 0.35 + this.rand() * 0.25;
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
    this.mesh.count = this.count;
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
          if (d < 0.65 || d < speed * dt) {
            this.state[id] = 4;
            this.collected++;
            gained++;
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
      nx = Math.max(-27.5, Math.min(27.5, nx));
      nz = Math.max(-29.5, Math.min(25.5, nz));
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
  countAlive() {
    let n = 0;
    for (let i = 0; i < this.count; i++) if (this.state[i] !== 4) n++;
    return n;
  }
}
