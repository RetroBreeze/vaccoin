import * as T from "three";
import { landingHeight } from "./terrain";
export class Effects {
  private readonly capacity = 400;
  private cursor = 0;
  private life = new Float32Array(this.capacity);
  private pos = new Float32Array(this.capacity * 3);
  private vel = new Float32Array(this.capacity * 3);
  private sizes = new Float32Array(this.capacity * 3);
  private fragments = new Uint8Array(this.capacity);
  private color = new T.Color();
  private dummy = new T.Object3D();
  private mesh: T.InstancedMesh;
  private air: T.Points;
  private airData = new Float32Array(64 * 3);
  private phases = new Float32Array(64);
  private angles = new Float32Array(64);
  constructor(scene: T.Scene, camera: T.Camera) {
    this.mesh = new T.InstancedMesh(
      new T.BoxGeometry(1, 1, 1),
      new T.MeshLambertMaterial({ color: 0xffffff }),
      this.capacity,
    );
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, this.color.setHex(0xffdd8a));
    scene.add(this.mesh);
    const g = new T.BufferGeometry();
    g.setAttribute(
      "position",
      new T.BufferAttribute(this.airData, 3).setUsage(T.DynamicDrawUsage),
    );
    this.air = new T.Points(
      g,
      new T.PointsMaterial({
        color: 0xc4fff2,
        size: 0.025,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      }),
    );
    this.air.frustumCulled = false;
    camera.add(this.air);
    for (let i = 0; i < 64; i++) {
      this.phases[i] = Math.random();
      this.angles[i] = Math.random() * Math.PI * 2;
    }
    this.reset();
  }
  reset() {
    this.life.fill(0);
    this.fragments.fill(0);
    this.cursor = 0;
    this.mesh.instanceMatrix.array.fill(0);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.air.visible = false;
  }
  burst(x: number, y: number, z: number, n = 28) {
    const collectionSpark = n <= 2;
    for (let i = 0; i < n; i++) {
      const id = this.cursor++ % this.capacity,
        p = id * 3;
      this.life[id] = collectionSpark ? 0.12 : 0.3 + Math.random() * 0.5;
      this.pos[p] = x;
      this.pos[p + 1] = y;
      this.pos[p + 2] = z;
      this.vel[p] = (Math.random() - 0.5) * (collectionSpark ? 0.5 : 11);
      this.vel[p + 1] = Math.random() * (collectionSpark ? 0.5 : 8);
      this.vel[p + 2] = (Math.random() - 0.5) * (collectionSpark ? 0.5 : 11);
      const size = collectionSpark ? 0.04 : 0.07 + Math.random() * 0.15;
      this.sizes[p] = this.sizes[p + 1] = this.sizes[p + 2] = size;
      this.fragments[id] = 0;
      this.mesh.setColorAt(id, this.color.setHex(0xffdd8a));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  shatter(x: number, y: number, z: number, large: boolean) {
    const size = large ? 2.1 : 1.15;
    for (let i = 0; i < 12; i++) {
      const id = this.cursor++ % this.capacity,
        p = id * 3;
      const axis = Math.floor((i % 6) / 2),
        sign = i % 2 ? 1 : -1;
      this.life[id] = 0.65 + Math.random() * 0.4;
      this.fragments[id] = 1;
      this.pos[p] = x;
      this.pos[p + 1] = y;
      this.pos[p + 2] = z;
      this.pos[p + axis] += sign * size * 0.4;
      this.pos[p + ((axis + 1) % 3)] += (i < 6 ? -0.18 : 0.18) * size;
      for (let a = 0; a < 3; a++) {
        this.vel[p + a] = (Math.random() - 0.5) * 3;
        this.sizes[p + a] =
          (a === axis ? 0.065 : a === (axis + 1) % 3 ? 0.35 : 0.75) * size;
      }
      this.vel[p + axis] += sign * (4 + Math.random() * 3);
      this.vel[p + 1] += 5 + Math.random() * 4;
      this.mesh.setColorAt(
        id,
        this.color.setHex(i % 3 === 0 ? 0xc8a365 : large ? 0x92704d : 0x648c46),
      );
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  update(dt: number, time: number, sucking: boolean) {
    for (let i = 0; i < this.capacity; i++) {
      const p = i * 3;
      if (this.life[i] > 0) {
        this.life[i] -= dt;
        this.vel[p + 1] -= 14 * dt;
        const oldY = this.pos[p + 1];
        this.pos[p] += this.vel[p] * dt;
        this.pos[p + 1] += this.vel[p + 1] * dt;
        this.pos[p + 2] += this.vel[p + 2] * dt;
        if (this.fragments[i]) {
          const floor = landingHeight(
            this.pos[p],
            this.pos[p + 2],
            oldY - 0.06,
            this.pos[p + 1] - 0.06,
            0,
          );
          if (floor > -Infinity) {
            this.pos[p + 1] = floor + 0.06;
            this.vel[p + 1] *= -0.25;
          }
        }
        this.dummy.position.fromArray(this.pos, p);
        this.dummy.rotation.set(time * 5 + i, time * 4, 0);
        const fade = Math.max(0, Math.min(1, this.life[i] * 4));
        this.dummy.scale.set(
          this.sizes[p] * fade,
          this.sizes[p + 1] * fade,
          this.sizes[p + 2] * fade,
        );
      } else this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.air.visible = sucking;
    if (sucking) {
      for (let i = 0; i < 64; i++) {
        this.phases[i] = (this.phases[i] + dt * 0.7) % 1;
        const t = 1 - this.phases[i],
          a = this.angles[i] + time * 1.8,
          r = t * 3.5;
        this.airData[i * 3] = 0.5 + Math.cos(a) * r;
        this.airData[i * 3 + 1] = -0.4 + Math.sin(a) * r;
        this.airData[i * 3 + 2] = -1.3 - t * 9;
      }
      (
        this.air.geometry.getAttribute("position") as T.BufferAttribute
      ).needsUpdate = true;
    }
  }
}
