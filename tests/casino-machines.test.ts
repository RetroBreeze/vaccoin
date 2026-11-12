import { expect, it, vi } from "vitest";
import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Scene,
  Vector3,
} from "three";
import { Assets } from "../src/assets";
import { Coins } from "../src/coins";
import { Destructibles } from "../src/destructibles";
import { casinoMachines } from "../src/casino-layout";
import { Player } from "../src/player";
it("instances the banks, removes burst cabinets and restores every transform on reset", () => {
  const scene = new Scene(),
    burst = vi.fn(),
    onBurst = vi.fn();
  const assets = {
    fit: () => {
      const g = new Group();
      g.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial()));
      return g;
    },
    model: () => {
      const g = new Group();
      g.add(new Mesh(new BoxGeometry(1, 2.4, 1), new MeshBasicMaterial()));
      return g;
    },
  } as unknown as Assets;
  const machines = new Destructibles(
    scene,
    assets,
    { burst } as unknown as Coins,
    onBurst,
  );
  expect(machines.objects.length).toBe(casinoMachines.length);
  expect(
    scene.children.filter(
      (m) => m instanceof InstancedMesh && !m.name.startsWith("furniture-"),
    ).length,
  ).toBe(3);
  const player = new Player();
  player.position.set(-30.9, 0, -22);
  const eye = new Vector3(-30.9, 1.7, -22),
    direction = new Vector3(0, 0, -1);
  for (let i = 0; i < 70; i++)
    machines.update(1 / 120, i / 120, player, eye, direction, true);
  expect(burst).toHaveBeenCalled();
  expect(onBurst).toHaveBeenCalled();
  const matrix = new Matrix4();
  for (const object of machines.objects.filter((o) => o.broken)) {
    object.batch[0].getMatrixAt(object.instance, matrix);
    expect(matrix.determinant()).toBe(0);
  }
  machines.reset();
  for (const object of machines.objects) {
    expect(object.broken).toBe(false);
    object.batch[0].getMatrixAt(object.instance, matrix);
    expect(matrix.determinant()).toBeCloseTo(1);
    expect(matrix.elements[12]).toBeCloseTo(object.x);
    expect(matrix.elements[13]).toBeCloseTo(object.y);
    expect(matrix.elements[14]).toBeCloseTo(object.z);
  }
});
