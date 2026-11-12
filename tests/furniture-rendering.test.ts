import { expect, it } from "vitest";
import {
  Box3,
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  Scene,
  Texture,
  Vector3,
} from "three";
import { Assets } from "../src/assets";
import { casinoFurniture } from "../src/casino-layout";
import { FurnitureInstances } from "../src/furniture-rendering";

function fixture() {
  const material = new MeshLambertMaterial({
    map: new Texture(),
    color: 0x8d785b,
  });
  const models = new Map<string, Group>();
  for (const key of new Set([...casinoFurniture.map((f) => f.key), "wheel"])) {
    const root = new Group(),
      child = new Group();
    child.position.set(2, -3, 4);
    child.scale.set(2, 3, 4);
    child.add(new Mesh(new BoxGeometry(1, 1, 1), material));
    root.add(child);
    models.set(key, root);
  }
  const assets = Object.assign(new Assets(), { models }) as unknown as Assets;
  const scene = new Scene(),
    renderer = new FurnitureInstances(scene, assets);
  const batches = scene.children.filter(
    (o): o is InstancedMesh => o instanceof InstancedMesh,
  );
  return { material, renderer, batches };
}

function snapshots(batches: InstancedMesh[]) {
  return batches.flatMap((batch) =>
    Array.from({ length: batch.count }, (_, instance) => {
      const matrix = new Matrix4();
      batch.getMatrixAt(instance, matrix);
      return { batch, instance, matrix };
    }),
  );
}

it("batches fitted props while preserving authored transforms, textures and world placement", () => {
  const { batches, material } = fixture();
  expect(batches.length).toBeLessThan(40);
  expect(batches.reduce((count, b) => count + b.count, 0)).toBe(
    casinoFurniture.length +
      casinoFurniture.filter((f) => f.key === "roulette").length,
  );
  const chair = casinoFurniture.find((f) => f.key === "chair")!;
  const entry = snapshots(batches).find(
    ({ matrix }) =>
      Math.abs(matrix.elements[12] - chair.x) < 0.00001 &&
      Math.abs(matrix.elements[13] - chair.y) < 0.00001 &&
      Math.abs(matrix.elements[14] - chair.z) < 0.00001,
  )!;
  expect(entry).toBeDefined();
  const bounds = new Box3()
    .setFromBufferAttribute(
      entry.batch.geometry.getAttribute("position") as never,
    )
    .applyMatrix4(entry.matrix);
  expect(bounds.getSize(new Vector3()).toArray()).toEqual([
    expect.closeTo(0.62, 5),
    expect.closeTo(1.02, 5),
    expect.closeTo(0.65, 5),
  ]);
  expect(bounds.min.y).toBeCloseTo(chair.y);
  for (const batch of batches) {
    const rendered = batch.material as MeshLambertMaterial;
    expect(rendered).not.toBe(material);
    expect(rendered.map).toBe(material.map);
    expect(rendered.emissive.r).toBeGreaterThan(material.emissive.r);
  }
  expect(material.emissive.getHex()).toBe(0);
});

it("hides a roulette table and its wheel together, leaving neighbors intact, then resets exactly", () => {
  const { renderer, batches } = fixture(),
    before = snapshots(batches);
  const index = casinoFurniture.findIndex((f) => f.key === "roulette");
  renderer.update(index, 1, true, 1);
  const hidden = before.filter(({ batch, instance }) => {
    const matrix = new Matrix4();
    batch.getMatrixAt(instance, matrix);
    return matrix.determinant() === 0;
  });
  expect(hidden).toHaveLength(2);
  const bounds = hidden
    .map(({ batch, matrix }) =>
      new Box3()
        .setFromBufferAttribute(
          batch.geometry.getAttribute("position") as never,
        )
        .applyMatrix4(matrix),
    )
    .sort((a, b) => a.min.y - b.min.y);
  const table = casinoFurniture[index];
  expect(bounds[0].min.y).toBeCloseTo(table.y);
  expect(bounds[1].min.y).toBeCloseTo(table.y + 0.95);
  expect(bounds[1].getCenter(new Vector3()).x).toBeCloseTo(table.x - 1);
  renderer.reset();
  for (const { batch, instance, matrix } of before) {
    const restored = new Matrix4();
    batch.getMatrixAt(instance, restored);
    expect(restored.elements).toEqual(matrix.elements);
  }
});

it("updates only strained instances, brightens their tint, and restores the idle pose without idle uploads", () => {
  const { renderer, batches } = fixture(),
    before = snapshots(batches);
  const initialVersions = batches.map((b) => b.instanceMatrix.version);
  for (let i = 0; i < casinoFurniture.length; i++)
    renderer.update(i, 0, false, 2);
  expect(batches.map((b) => b.instanceMatrix.version)).toEqual(initialVersions);
  const index = casinoFurniture.findIndex((f) => f.key === "roulette");
  renderer.update(index, 0.7, false, 2);
  const changed = before.filter(({ batch, instance, matrix }) => {
    const current = new Matrix4();
    batch.getMatrixAt(instance, current);
    return !matrix.equals(current);
  });
  expect(changed).toHaveLength(2);
  for (const { batch, instance } of changed) {
    const tint = new Color();
    batch.getColorAt(instance, tint);
    expect(tint.r).toBeGreaterThan(1.1);
    expect(batch.instanceMatrix.updateRanges).toContainEqual({
      start: instance * 16,
      count: 16,
    });
  }
  renderer.update(index, 0, false, 3);
  for (const { batch, instance, matrix } of changed) {
    const current = new Matrix4();
    batch.getMatrixAt(instance, current);
    expect(current.elements).toEqual(matrix.elements);
  }
  const settledVersions = batches.map((b) => b.instanceMatrix.version);
  renderer.update(index, 0, false, 4);
  expect(batches.map((b) => b.instanceMatrix.version)).toEqual(settledVersions);
});

it("tumbles about the model center at its new location and restores the original transform", () => {
  const { renderer, batches } = fixture(),
    before = snapshots(batches);
  const index = casinoFurniture.findIndex((f) => f.key === "chair");
  const spec = casinoFurniture[index];
  const original = before.find(
    ({ matrix }) =>
      Math.abs(matrix.elements[12] - spec.x) < 0.00001 &&
      Math.abs(matrix.elements[13] - spec.y) < 0.00001 &&
      Math.abs(matrix.elements[14] - spec.z) < 0.00001,
  )!;
  const pose = {
    ...spec,
    x: spec.x + 3,
    y: spec.y + 1,
    rx: 0,
    rz: Math.PI / 2,
  };
  renderer.update(index, 0, false, 1, pose);
  const moved = new Matrix4();
  original.batch.getMatrixAt(original.instance, moved);
  const center = new Vector3(0, spec.height / 2, 0).applyMatrix4(moved);
  expect(center.toArray()).toEqual([
    expect.closeTo(pose.x, 5),
    expect.closeTo(pose.y + spec.height / 2, 5),
    expect.closeTo(pose.z, 5),
  ]);
  renderer.reset();
  original.batch.getMatrixAt(original.instance, moved);
  expect(moved.elements).toEqual(original.matrix.elements);
});
