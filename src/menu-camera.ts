import { Vector3, type PerspectiveCamera } from "three";

/** A slow closed route through the open ground-floor corridors. */
export class MenuCamera {
  private elapsed = 0;
  private target = new Vector3();
  update(
    camera: PerspectiveCamera,
    deltaSeconds: number,
    reducedMotion: boolean,
  ) {
    if (!reducedMotion) this.elapsed += deltaSeconds;
    const angle = (this.elapsed * Math.PI * 2) / 120;
    camera.position.set(
      12 * Math.sin(angle),
      3.1 + 0.15 * Math.sin(angle * 2),
      25 * Math.cos(angle),
    );
    this.target.set(
      3 * Math.sin(angle + 0.35),
      2.6 + 0.15 * Math.sin(angle),
      8 * Math.cos(angle + 0.35),
    );
    camera.lookAt(this.target);
  }
}
