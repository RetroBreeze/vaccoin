import { expect, it } from "vitest";
import { PerspectiveCamera } from "three";
import { MenuCamera } from "../src/menu-camera";
import { casinoWalls, columnSolids } from "../src/casino-layout";

it("floats continuously through open casino space and closes its loop", () => {
  const tour = new MenuCamera();
  const camera = new PerspectiveCamera();
  tour.update(camera, 0, false);
  const start = camera.position.clone();
  let distance = 0;
  for (let frame = 0; frame < 1200; frame++) {
    const previous = camera.position.clone();
    tour.update(camera, 0.1, false);
    const step = camera.position.distanceTo(previous);
    expect(step).toBeLessThan(0.2);
    distance += step;
    const p = camera.position;
    expect(p.y).toBeGreaterThan(2.8);
    expect(p.y).toBeLessThan(3.5);
    expect(
      casinoWalls
        .concat(columnSolids)
        .some(
          (w) =>
            p.x > w.x0 - 0.2 &&
            p.x < w.x1 + 0.2 &&
            p.y > w.y0 - 0.2 &&
            p.y < w.y1 + 0.2 &&
            p.z > w.z0 - 0.2 &&
            p.z < w.z1 + 0.2,
        ),
    ).toBe(false);
  }
  expect(distance).toBeGreaterThan(80);
  expect(camera.position.distanceTo(start)).toBeLessThan(0.001);
});

it("holds its current view for reduced motion and resumes without a cut", () => {
  const tour = new MenuCamera();
  const camera = new PerspectiveCamera();
  tour.update(camera, 10, false);
  const position = camera.position.clone();
  const rotation = camera.quaternion.clone();
  tour.update(camera, 10, true);
  expect(camera.position.equals(position)).toBe(true);
  expect(camera.quaternion.angleTo(rotation)).toBeLessThan(0.00001);
  tour.update(camera, 0.016, false);
  expect(camera.position.distanceTo(position)).toBeGreaterThan(0);
  expect(camera.position.distanceTo(position)).toBeLessThan(0.05);
});
