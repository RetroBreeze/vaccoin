import { Euler, Matrix4 } from "three";
import { blockedBody, ceilingHeight, landingHeight } from "./terrain";

export interface FurniturePose {
  x: number;
  y: number;
  z: number;
  rotation: number;
  rx: number;
  rz: number;
}
export interface FurnitureMotion extends FurniturePose {
  width: number;
  height: number;
  depth: number;
  vx: number;
  vy: number;
  vz: number;
  spinX: number;
  spinZ: number;
  moving: boolean;
  tossed: boolean;
  cooldown: number;
}
const rotation = new Euler(),
  matrix = new Matrix4();

/** Half-height of the rotated box keeps tipped props resting on the deck. */
export function furnitureExtent(body: FurnitureMotion) {
  matrix.makeRotationFromEuler(rotation.set(body.rx, body.rotation, body.rz));
  const e = matrix.elements;
  return (
    (Math.abs(e[1]) * body.width +
      Math.abs(e[5]) * body.height +
      Math.abs(e[9]) * body.depth) /
    2
  );
}

/** A hop, spin, gravity and damping; intentionally no prop-to-prop physics. */
export function advanceFurniture(body: FurnitureMotion, dt: number) {
  body.cooldown = Math.max(0, body.cooldown - dt);
  if (!body.moving) return;
  const oldExtent = furnitureExtent(body),
    oldCenter = body.y + body.height / 2;
  const x = body.x + body.vx * dt,
    z = body.z + body.vz * dt;
  if (blockedBody(x, body.z, oldCenter - oldExtent + 0.05, 0.3, true))
    body.vx *= -0.55;
  else body.x = x;
  if (blockedBody(body.x, z, oldCenter - oldExtent + 0.05, 0.3, true))
    body.vz *= -0.55;
  else body.z = z;
  body.rx += body.spinX * dt;
  body.rz += body.spinZ * dt;
  const extent = furnitureExtent(body);
  body.vy -= 22 * dt;
  let center = oldCenter + body.vy * dt;
  if (body.vy > 0) {
    const ceiling = ceilingHeight(
      body.x,
      body.z,
      oldCenter + oldExtent,
      center + extent,
    );
    if (ceiling < Infinity) {
      center = ceiling - extent;
      body.vy = -Math.abs(body.vy) * 0.35;
    }
  }
  const floor = landingHeight(
    body.x,
    body.z,
    oldCenter - oldExtent,
    center - extent,
    0.15,
    true,
  );
  const grounded = floor > -Infinity && center - extent <= floor;
  if (grounded) {
    center = floor + extent;
    body.vy = body.vy < -2.5 ? -body.vy * 0.32 : 0;
  }
  body.y = center - body.height / 2;
  const damping = Math.exp(-(grounded ? 8 : 0.7) * dt);
  body.vx *= damping;
  body.vz *= damping;
  body.spinX *= damping;
  body.spinZ *= damping;
  if (
    grounded &&
    body.vy === 0 &&
    Math.hypot(body.vx, body.vz, body.spinX, body.spinZ) < 0.25
  ) {
    body.moving = false;
    body.vx = body.vy = body.vz = body.spinX = body.spinZ = 0;
  }
}
