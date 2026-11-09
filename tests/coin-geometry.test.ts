import { expect, it } from "vitest";
import { makeCoinGeometry } from "../src/coin-geometry";
it("uses a compact eight-sided bevelled coin with palette UVs", () => {
  const g = makeCoinGeometry();
  expect(g.getAttribute("position").count / 3).toBeLessThanOrEqual(64);
  g.computeBoundingBox();
  expect(g.boundingBox!.max.x - g.boundingBox!.min.x).toBeCloseTo(0.43, 2);
  expect(g.getAttribute("uv").count).toBe(g.getAttribute("position").count);
});
