import { expect, it } from "vitest";
import { Texture, Raycaster, Vector3, Mesh, Box3 } from "three";
import { createSignPanel } from "../src/casino-signs";
it("reads left to right from both approaches without exposing mirrored backfaces", () => {
  const { faces } = createSignPanel(new Texture(), 2, 0.5, {
    twoSided: true,
    suspension: 1,
  });
  faces.updateMatrixWorld(true);
  const sample = (x: number, z: number) =>
    new Raycaster(
      new Vector3(x, 0, z),
      new Vector3(0, 0, -Math.sign(z)),
    ).intersectObjects(faces.children)[0];
  expect(sample(-0.5, 3).uv!.x).toBeLessThan(sample(0.5, 3).uv!.x);
  expect(sample(0.5, -3).uv!.x).toBeLessThan(sample(-0.5, -3).uv!.x);
  expect(sample(-0.5, 3).object).not.toBe(sample(0.5, -3).object);
});
it("backs the text with a physical board and joins hangers to the ceiling", () => {
  const { hardware, faces } = createSignPanel(new Texture(), 2, 0.5, {
    suspension: 1,
  });
  hardware.updateMatrixWorld(true);
  faces.updateMatrixWorld(true);
  const support = hardware.getObjectByName("sign-mounts")!;
  expect(new Box3().setFromObject(support).max.y).toBeCloseTo(0.25 + 0.06 + 1);
  const front = faces.children[0] as Mesh;
  expect(
    new Raycaster(new Vector3(0, 0, -3), new Vector3(0, 0, 1)).intersectObject(
      front,
    ),
  ).toHaveLength(0);
  expect(
    new Raycaster(new Vector3(0, 0, -3), new Vector3(0, 0, 1)).intersectObjects(
      hardware.children,
    ).length,
  ).toBeGreaterThan(0);
});
