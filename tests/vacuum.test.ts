import { expect, it } from "vitest";
import { PerspectiveCamera, Scene } from "three";
import { Vacuum } from "../src/vacuum";
import { lineBlocked } from "../src/terrain";
it("keeps the collection point reachable when the visible nozzle crosses a ramp", () => {
  const scene = new Scene(),
    camera = new PerspectiveCamera();
  scene.add(camera);
  camera.position.set(17.95, 1.7, 20);
  camera.rotation.x = -0.12;
  camera.updateMatrixWorld();
  const v = new Vacuum(camera);
  v.update(1 / 60, 1, true, 0, 0);
  expect(
    lineBlocked(
      camera.position.x,
      camera.position.y,
      camera.position.z,
      v.target.x,
      v.target.y,
      v.target.z,
    ),
  ).toBe(false);
});
it("cosmetics only change materials, preserving geometry, transforms and collection target", () => {
  const a = new Vacuum(new PerspectiveCamera()),
    b = new Vacuum(new PerspectiveCamera());
  b.equip("gold");
  a.update(1 / 60, 1, true, 10, 12);
  b.update(1 / 60, 1, true, 10, 12);
  expect(b.target.toArray()).toEqual(a.target.toArray());
  expect(b.group.position.toArray()).toEqual(a.group.position.toArray());
  expect(b.group.scale.toArray()).toEqual(a.group.scale.toArray());
  expect(b.group.children.map((c) => c.position.toArray())).toEqual(
    a.group.children.map((c) => c.position.toArray()),
  );
  expect(b.cosmetic).toBe("gold");
});
it("keeps gameplay target independent of FOV and visual jump animation", () => {
  const a = new Vacuum(new PerspectiveCamera(50, 0.55)),
    b = new Vacuum(new PerspectiveCamera(110, 2.4));
  for (let i = 0; i < 60; i++) {
    a.update(1 / 60, i / 60, true, 14, 100, 0, true);
    b.update(1 / 60, i / 60, true, 14, 100, 8, false);
  }
  expect(a.target.toArray()).toEqual(b.target.toArray());
});
it("keeps the pre-overhaul attraction endpoint and settles suction recoil", () => {
  const camera = new PerspectiveCamera(78, 16 / 9),
    v = new Vacuum(camera);
  let power = 0;
  for (let i = 0; i < 180; i++) {
    const t = i / 60,
      sucking = i < 60,
      rate = 50,
      speed = 14;
    power += (Number(sucking) - power) * (1 - Math.exp(-12 / 60));
    v.update(1 / 60, t, sucking, speed, rate);
    const expected = new Scene();
    expected.position.set(
      0.55,
      -0.48 + Math.sin(t * 12) * 0.008 + power * Math.sin(t * 70) * 0.003,
      -0.8 + power * 0.045,
    );
    expected.rotation.set(0, -0.08, (Math.sin(t * 6) * 0.008 * speed) / 14);
    expected.scale.setScalar(1 + rate * 0.00006);
    expected.updateMatrixWorld();
    const position = v.target
      .clone()
      .set(0, 0.08, -0.76)
      .applyMatrix4(expected.matrixWorld);
    expect(v.target.distanceTo(position)).toBeLessThan(1e-10);
  }
  expect(Math.abs(v.group.children[0].position.z)).toBeLessThan(0.0001);
});
it("starts in the normal first-person pose before simulation runs", () => {
  const camera = new PerspectiveCamera(78, 16 / 9);
  const vacuum = new Vacuum(camera);
  const idle = new Vacuum(camera);
  idle.update(1 / 60, 0, false, 0, 0);
  expect(vacuum.group.position.toArray()).toEqual(
    idle.group.position.toArray(),
  );
  expect(vacuum.group.scale.toArray()).toEqual(idle.group.scale.toArray());
  expect(vacuum.group.position.z).toBeLessThan(-0.5);
});
it("resets the resting pose for countdowns after a previous round", () => {
  const camera = new PerspectiveCamera(78, 16 / 9);
  const vacuum = new Vacuum(camera);
  const idle = new Vacuum(new PerspectiveCamera(78, 16 / 9));
  for (let i = 0; i < 30; i++)
    vacuum.update(1 / 60, i / 60, true, 14, 150, 8, false);
  camera.rotation.set(-0.12, 0, 0);
  vacuum.reset();
  idle.update(0, 0, false, 0, 0);
  expect(vacuum.group.position.toArray()).toEqual(
    idle.group.position.toArray(),
  );
  expect(vacuum.group.children[0].position.toArray()).toEqual(
    idle.group.children[0].position.toArray(),
  );
  expect(vacuum.group.children[0].rotation.toArray()).toEqual(
    idle.group.children[0].rotation.toArray(),
  );
});
