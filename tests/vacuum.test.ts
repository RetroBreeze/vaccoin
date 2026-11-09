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
