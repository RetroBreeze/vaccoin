import { CASINO_SPAWN } from "./casino-layout";
import { Vector3 } from "three";
import {
  blockedBody,
  bodyFurnitureContacts,
  ceilingHeight,
  landingHeight,
} from "./terrain";
export class Player {
  position = new Vector3(CASINO_SPAWN.x, CASINO_SPAWN.y, CASINO_SPAWN.z);
  velocity = new Vector3();
  yaw = 0;
  pitch = -0.12;
  grounded = true;
  readonly pushContacts = new Set<number>();
  readonly pushDirection = new Vector3();
  private springTime = 0;
  private springVelocity = new Vector3();
  spring(vx: number, vy: number, vz: number, duration: number) {
    this.velocity.set(vx, vy, vz);
    this.springVelocity.set(vx, 0, vz);
    this.springTime = duration;
    this.grounded = false;
  }
  reset() {
    this.pushContacts.clear();
    this.pushDirection.set(0, 0, 0);
    this.position.set(CASINO_SPAWN.x, CASINO_SPAWN.y, CASINO_SPAWN.z);
    this.velocity.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = -0.12;
    this.grounded = true;
    this.springTime = 0;
    this.springVelocity.set(0, 0, 0);
  }
  look(dx: number, dy: number) {
    this.yaw -= dx * 0.0022;
    this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch - dy * 0.0022));
  }
  update(dt: number, strafe: number, forward: number, jump: boolean) {
    this.pushContacts.clear();
    const pushing = Math.hypot(strafe, forward) > 0.01;
    const len = Math.hypot(strafe, forward) || 1;
    strafe /= len;
    forward /= len;
    let tx = (strafe * Math.cos(this.yaw) - forward * Math.sin(this.yaw)) * 14;
    let tz = (-strafe * Math.sin(this.yaw) - forward * Math.cos(this.yaw)) * 14;
    this.pushDirection.set(pushing ? tx : 0, 0, pushing ? tz : 0).normalize();
    this.springTime = Math.max(0, this.springTime - dt);
    const boosted = this.springTime > 0;
    if (boosted) {
      // Preserve enough forward travel to clear the higher floor even when
      // the approach key points back against a vault spring's launch direction.
      const along = tx * this.springVelocity.x + tz * this.springVelocity.z;
      const lengthSq = this.springVelocity.lengthSq();
      if (along < 0 && lengthSq > 0) {
        tx -= (along / lengthSq) * this.springVelocity.x;
        tz -= (along / lengthSq) * this.springVelocity.z;
      }
      tx = this.springVelocity.x + tx * 0.3;
      tz = this.springVelocity.z + tz * 0.3;
    }
    const response = 1 - Math.exp(-(this.grounded ? 19 : boosted ? 2 : 8) * dt);
    this.velocity.x += (tx - this.velocity.x) * response;
    this.velocity.z += (tz - this.velocity.z) * response;
    if (jump && this.grounded) {
      this.velocity.y = 10;
      this.grounded = false;
    }
    const oldY = this.position.y;
    let x = this.position.x + this.velocity.x * dt,
      z = this.position.z + this.velocity.z * dt;
    if (blockedBody(x, this.position.z, oldY, 0.38, true)) {
      x = this.position.x;
      this.velocity.x = 0;
    }
    if (blockedBody(x, z, oldY, 0.38, true)) {
      z = this.position.z;
      this.velocity.z = 0;
    }
    this.position.x = x;
    this.position.z = z;
    if (pushing)
      for (const id of bodyFurnitureContacts(x, z, oldY))
        this.pushContacts.add(id);
    this.velocity.y -= 28 * dt;
    let nextY = oldY + this.velocity.y * dt;
    if (this.velocity.y > 0) {
      const ceiling = ceilingHeight(x, z, oldY + 1.7, nextY + 1.7);
      if (ceiling < Infinity) {
        nextY = ceiling - 1.7;
        this.velocity.y = 0;
      }
    }
    const ground = landingHeight(
      x,
      z,
      oldY,
      nextY,
      this.grounded ? 0.23 : 0,
      true,
    );
    if (this.velocity.y <= 0 && ground > -Infinity) {
      nextY = ground;
      this.velocity.y = 0;
      this.grounded = true;
      this.springTime = 0;
    } else this.grounded = false;
    this.position.y = nextY;
    if (nextY < -18) this.reset();
  }
  get speed() {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }
}
