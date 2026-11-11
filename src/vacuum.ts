import { COSMETICS } from "./workshop-state";
import * as T from "three";
import {
  createVacuumMaterials,
  applyVacuumColour,
  loadVacuumModel,
} from "./vacuum-model";
import { lineBlocked } from "./terrain";

export class Vacuum {
  readonly group = new T.Group();
  readonly target = new T.Vector3();
  readonly nozzleTarget = new T.Vector3();
  private visual = new T.Group();
  private power = 0;
  private materials = createVacuumMaterials();
  private eye = new T.Vector3();
  private physicalPose = new T.Object3D();
  private previousRotation = new T.Quaternion();
  private deltaRotation = new T.Quaternion();
  private sway = new T.Vector2();
  private airborne = false;
  private landing = 0;
  private lift = 0;
  private pulse = 0;
  private loading?: Promise<void>;
  cosmetic = "default";
  loadState: "fallback" | "loaded" | "error" = "fallback";

  constructor(private camera: T.Camera) {
    // Small, deliberately logo-shaped stand-in while loading (also works offline).
    const head = new T.Mesh(
      new T.CylinderGeometry(0.48, 0.19, 0.6, 4, 1, true),
      this.materials.get("body"),
    );
    head.rotation.set(Math.PI / 2, Math.PI / 4, 0);
    head.scale.z = 0.5;
    head.position.set(0, 0.08, -0.44);
    this.visual.add(head);
    const hose = new T.Mesh(
      new T.TubeGeometry(
        new T.CatmullRomCurve3([
          new T.Vector3(0, 0, 0),
          new T.Vector3(-0.1, -0.15, 0.6),
          new T.Vector3(-0.65, -0.16, 1.15),
        ]),
        16,
        0.15,
        8,
        false,
      ),
      this.materials.get("body"),
    );
    this.visual.add(hose);
    const cuff = new T.Mesh(
      new T.BoxGeometry(0.34, 0.3, 0.22),
      this.materials.get("coupler"),
    );
    this.visual.add(cuff);
    this.group.add(this.visual);
    this.setLayers();
    this.previousRotation.copy(camera.quaternion);
    camera.add(this.group);
  }
  private setLayers() {
    this.group.traverse((o) => {
      o.layers.set(1);
    });
  }
  /** Explicit startup load, cached across instances; rejection leaves a usable fallback. */
  load(): Promise<void> {
    return (this.loading ??= (async () => {
      try {
        const model = await loadVacuumModel(this.materials);
        for (const o of this.visual.children)
          if (o instanceof T.Mesh) o.geometry.dispose();
        this.visual.clear();
        this.visual.add(model);
        this.setLayers();
        this.loadState = "loaded";
      } catch (error) {
        this.loadState = "error";
        console.warn(
          "Vaccoin vacuum asset unavailable; using fallback.",
          error,
        );
      }
    })());
  }
  equip(id: string) {
    if (id === this.cosmetic) return;
    const item = COSMETICS.find((c) => c.id === id);
    if (!item) return;
    this.cosmetic = id;
    applyVacuumColour(this.materials, item);
  }
  update(
    dt: number,
    time: number,
    sucking: boolean,
    speed: number,
    rate: number,
    verticalSpeed = 0,
    grounded = true,
  ) {
    const blend = 1 - Math.exp(-12 * dt);
    this.power += (Number(sucking) - this.power) * blend;
    // Preserve the original collection endpoint exactly. Presentation, FOV and
    // landing impulses must never affect coin attraction or collision handling.
    this.physicalPose.position.set(
      0.55,
      -0.48 +
        Math.sin(time * 12) * 0.008 * Math.min(1, speed / 10) +
        this.power * Math.sin(time * 70) * 0.003,
      -0.8 + this.power * 0.045,
    );
    this.physicalPose.rotation.set(
      0,
      -0.08,
      (Math.sin(time * 6) * 0.008 * speed) / 14,
    );
    this.physicalPose.scale.setScalar(1 + Math.min(rate, 200) * 0.00006);
    this.physicalPose.updateMatrix();
    this.camera.updateWorldMatrix(true, false);
    this.target
      .set(0, 0.08, -0.76)
      .applyMatrix4(this.physicalPose.matrix)
      .applyMatrix4(this.camera.matrixWorld);
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
      this.target.sub(this.eye).setLength(0.25).add(this.eye);
    }

    this.deltaRotation
      .copy(this.previousRotation)
      .invert()
      .multiply(this.camera.quaternion);
    this.previousRotation.copy(this.camera.quaternion);
    this.sway.x +=
      (T.MathUtils.clamp(-this.deltaRotation.y * 3, -0.045, 0.045) -
        this.sway.x) *
      blend;
    this.sway.y +=
      (T.MathUtils.clamp(this.deltaRotation.x * 3, -0.035, 0.035) -
        this.sway.y) *
      blend;
    if (grounded && this.airborne) this.landing = 0.045;
    this.airborne = !grounded;
    this.landing *= Math.exp(-11 * dt);
    this.lift +=
      (T.MathUtils.clamp(-verticalSpeed * 0.003, -0.035, 0.035) - this.lift) *
      blend;
    this.pulse += (Math.min(Math.max(rate, 0), 200) / 200 - this.pulse) * blend;
    const walk = Math.min(speed / 14, 1.5) * (grounded ? 1 : 0.3);
    const camera = this.camera as T.PerspectiveCamera;
    // FOV compensation keeps screen coverage stable; narrow screens move the rig
    // toward the centre and reduce its width without stretching the geometry.
    const fovScale = camera.isPerspectiveCamera
      ? Math.tan(T.MathUtils.degToRad(camera.fov / 2)) /
        Math.tan(T.MathUtils.degToRad(39))
      : 1;
    const narrow = camera.isPerspectiveCamera
      ? Math.min(1, camera.aspect / 1.25)
      : 1;
    const scale = 0.8 * Math.max(0.64, narrow);
    this.group.scale.set(scale * fovScale, scale * fovScale, scale);
    this.group.position.set(0.48 * fovScale * narrow, -0.43 * fovScale, -0.95);
    this.visual.position.set(
      this.sway.x + Math.sin(time * 6) * 0.008 * walk,
      this.sway.y +
        Math.sin(time * 1.7) * 0.003 +
        Math.sin(time * 12) * 0.012 * walk +
        this.lift -
        this.landing,
      this.power * 0.035 + Math.sin(time * 71) * 0.003 * this.power,
    );
    this.visual.rotation.set(
      0.08 + this.landing * 0.7,
      0.12,
      Math.sin(time * 6) * 0.012 * walk +
        Math.sin(time * 53) * 0.004 * this.power,
    );
    this.materials
      .get("coupler")!
      .emissive.setHex(0x02cfc4)
      .multiplyScalar(this.power * (0.12 + this.pulse * 0.5));
    this.group.updateWorldMatrix(true, true);
    this.nozzleTarget.set(0, 0.08, -0.81).applyMatrix4(this.visual.matrixWorld);
  }
}
