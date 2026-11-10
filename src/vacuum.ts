import { COSMETICS } from './workshop-state';
import * as T from "three";
import { lineBlocked } from "./terrain";
export class Vacuum {
  readonly group = new T.Group();
  readonly target = new T.Vector3();
  private fan = new T.Group();
  private glow: T.Mesh;
  private power = 0;
  private materials: T.MeshLambertMaterial[] = [];
  cosmetic = "default";
  private eye = new T.Vector3();
  constructor(private camera: T.Camera) {
    const mint = new T.MeshLambertMaterial({ color: 0x5fe0bd }),
      dark = new T.MeshLambertMaterial({ color: 0x1b3544 }),
      cream = new T.MeshLambertMaterial({ color: 0xffe2ad }),
      orange = new T.MeshLambertMaterial({ color: 0xf3a65a });
    this.materials = [mint, cream, dark, orange];
    const part = (
      g: T.BufferGeometry,
      m: T.Material,
      x: number,
      y: number,
      z: number,
    ) => {
      const mesh = new T.Mesh(g, m);
      mesh.position.set(x, y, z);
      mesh.renderOrder = 10;
      this.group.add(mesh);
      return mesh;
    };
    part(new T.BoxGeometry(0.5, 0.42, 0.65), mint, 0, -0.02, 0.08);
    part(new T.BoxGeometry(0.54, 0.1, 0.5), cream, 0, 0.18, 0.1);
    const pipe = part(
      new T.CylinderGeometry(0.22, 0.29, 0.55, 8),
      dark,
      0,
      0.08,
      -0.45,
    );
    pipe.rotation.x = Math.PI / 2;
    const rim = part(
      new T.TorusGeometry(0.27, 0.07, 4, 8),
      cream,
      0,
      0.08,
      -0.74,
    );
    this.glow = part(
      new T.CircleGeometry(0.23, 8),
      new T.MeshBasicMaterial({ color: 0x173841 }),
      0,
      0.08,
      -0.745,
    );
    this.glow.rotation.y = Math.PI;
    part(new T.BoxGeometry(0.14, 0.28, 0.1), orange, 0.25, -0.12, 0.08);
    for (let i = 0; i < 4; i++) {
      const blade = new T.Mesh(new T.BoxGeometry(0.035, 0.36, 0.025), mint);
      blade.rotation.z = (i * Math.PI) / 4;
      this.fan.add(blade);
    }
    this.fan.position.set(0, 0.08, -0.76);
    this.group.add(this.fan);
    part(new T.BoxGeometry(0.1, 0.035, 0.2), orange, -0.12, 0.24, 0.1);
    part(new T.BoxGeometry(0.1, 0.035, 0.2), cream, 0.12, 0.24, 0.1);
    this.group.position.set(0.55, -0.48, -0.8);
    this.group.rotation.y = -0.08;
    this.group.traverse((object) => object.layers.set(1));
    camera.add(this.group);
  }
  equip(id: string) {
    if (id === this.cosmetic) return;
    const item = COSMETICS.find(c => c.id === id);
    if (!item) return;
    this.cosmetic = id;
    [item.body, item.trim, item.dark, item.accent].forEach((color,i) => this.materials[i].color.setHex(color));
  }
  update(
    dt: number,
    time: number,
    sucking: boolean,
    speed: number,
    rate: number,
  ) {
    this.power += (Number(sucking) - this.power) * (1 - Math.exp(-12 * dt));
    this.fan.rotation.z -= dt * (5 + this.power * 55);
    this.group.position.y =
      -0.48 +
      Math.sin(time * 12) * 0.008 * Math.min(1, speed / 10) +
      this.power * Math.sin(time * 70) * 0.003;
    this.group.position.z = -0.8 + this.power * 0.045;
    this.group.rotation.z = (Math.sin(time * 6) * 0.008 * speed) / 14;
    const mat = this.glow.material as T.MeshBasicMaterial;
    mat.color.setHex(sucking ? 0xa4ffe1 : 0x173841);
    this.group.scale.setScalar(1 + Math.min(rate, 200) * 0.00006);
    this.group.updateWorldMatrix(true, false);
    this.target.set(0, 0.08, -0.76).applyMatrix4(this.group.matrixWorld);
    this.camera.getWorldPosition(this.eye);
    if (
      lineBlocked(
        this.eye.x,
        this.eye.y,
        this.eye.z,
        this.target.x,
        this.target.y,
        this.target.z,
      )
    ) {
      // The viewmodel can overlap scenery; physical collection stays inside the
      // player's free space so coins do not churn forever against a ramp/wall.
      this.target.sub(this.eye).setLength(0.25).add(this.eye);
    }
  }
}
