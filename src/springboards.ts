import * as T from "three";
import type { Player } from "./player";

export const springboardSpecs = [
  {
    id: "west-gallery-spring",
    x: -14,
    y: 0,
    z: 14,
    targetX: -23,
    targetY: 6,
    targetZ: 4,
  },
  {
    id: "east-gallery-spring",
    x: 14,
    y: 0,
    z: 14,
    targetX: 23,
    targetY: 6,
    targetZ: 4,
  },
  {
    id: "west-vault-spring",
    x: -23,
    y: -6,
    z: -27,
    targetX: -23,
    targetY: 0,
    targetZ: -7,
  },
  {
    id: "east-vault-spring",
    x: 23,
    y: -6,
    z: -27,
    targetX: 23,
    targetY: 0,
    targetZ: -7,
  },
] as const;
export function onSpringboard(x: number, y: number, z: number, margin = 1.8) {
  return springboardSpecs.some(
    (p) => Math.abs(y - p.y) < 1.1 && Math.hypot(x - p.x, z - p.z) < margin,
  );
}
export class Springboards {
  private pads: { top: T.Group; pulse: number }[] = [];
  constructor(scene: T.Scene) {
    const baseMaterial = new T.MeshLambertMaterial({ color: 0x243e50 });
    const springMaterial = new T.MeshLambertMaterial({ color: 0x72dfc1 });
    const topMaterial = new T.MeshLambertMaterial({ color: 0xffce58 });
    const arrowMaterial = new T.MeshBasicMaterial({ color: 0x294c55 });
    const baseGeometry = new T.CylinderGeometry(1.5, 1.6, 0.12, 8);
    const ringGeometry = new T.TorusGeometry(1.1, 0.065, 4, 8);
    const topGeometry = new T.CylinderGeometry(1.3, 1.35, 0.1, 8);
    const arrowGeometry = new T.BoxGeometry(0.18, 0.025, 0.65);
    for (const spec of springboardSpecs) {
      const pad = new T.Group();
      pad.position.set(spec.x, spec.y, spec.z);
      const base = new T.Mesh(baseGeometry, baseMaterial);
      base.position.y = 0.06;
      pad.add(base);
      for (let i = 0; i < 2; i++) {
        const ring = new T.Mesh(ringGeometry, springMaterial);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.15 + i * 0.1;
        pad.add(ring);
      }
      const top = new T.Group();
      top.position.y = 0.32;
      top.add(new T.Mesh(topGeometry, topMaterial));
      // Chevron geometry communicates the launch direction without text.
      const arrows = new T.Group();
      arrows.rotation.y = Math.atan2(
        -(spec.targetX - spec.x),
        -(spec.targetZ - spec.z),
      );
      for (const z of [-0.28, 0.35])
        for (const side of [-1, 1]) {
          const bar = new T.Mesh(arrowGeometry, arrowMaterial);
          bar.position.set(side * 0.2, 0.063, z);
          bar.rotation.y = (side * Math.PI) / 4;
          arrows.add(bar);
        }
      top.add(arrows);
      pad.add(top);
      scene.add(pad);
      this.pads.push({ top, pulse: 0 });
    }
  }
  reset() {
    for (const pad of this.pads) {
      pad.pulse = 0;
      pad.top.position.y = 0.32;
    }
  }
  update(dt: number, player: Player) {
    let launched = false;
    for (let i = 0; i < this.pads.length; i++) {
      const pad = this.pads[i],
        spec = springboardSpecs[i];
      pad.pulse = Math.max(0, pad.pulse - dt);
      if (
        player.grounded &&
        Math.abs(player.position.y - spec.y) < 0.2 &&
        Math.hypot(player.position.x - spec.x, player.position.z - spec.z) <
          1.25
      ) {
        const up = 22;
        const flight =
          (up + Math.sqrt(up * up - 2 * 28 * (spec.targetY - spec.y))) / 28;
        player.spring(
          (spec.targetX - player.position.x) / flight,
          up,
          (spec.targetZ - player.position.z) / flight,
          flight + 0.12,
        );
        pad.pulse = 0.45;
        launched = true;
      }
      pad.top.position.y = 0.32 - Math.sin((pad.pulse / 0.45) * Math.PI) * 0.17;
    }
    return launched;
  }
}
