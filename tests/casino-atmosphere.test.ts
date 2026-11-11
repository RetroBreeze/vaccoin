import { expect, it } from "vitest";
import { casinoLights, sampleCasinoLight } from "../src/casino-atmosphere";
it("keeps readable warm pools distinct from room corners on every storey", () => {
  for (const floor of [-5, 0, 5]) {
    const lamp = casinoLights.find(
      (l) => l.floor === floor && l.x === -33 && l.z === -28,
    )!;
    expect(lamp).toBeDefined();
    const pool = sampleCasinoLight(lamp.x, floor, lamp.z),
      corner = sampleCasinoLight(-38, floor, -32);
    expect(pool[0]).toBeGreaterThan(corner[0] * 1.5);
    expect(pool[0]).toBeGreaterThan(pool[2]);
    expect(corner[0]).toBeGreaterThan(0.15);
    expect(sampleCasinoLight(lamp.x, floor, lamp.z)).toEqual(pool);
  }
});

import { Scene, Points } from "three";
import { CasinoAtmosphere } from "../src/casino-atmosphere";
import { casinoMachines } from "../src/casino-layout";
it("extinguishes a burst cabinet marquee and restores it after reset", () => {
  const scene = new Scene(),
    atmosphere = new CasinoAtmosphere(scene);
  const marquee = scene.getObjectByName("casino-marquee") as Points;
  const colors = marquee.geometry.getAttribute("color");
  atmosphere.update(1, []);
  expect(colors.getX(0)).toBeGreaterThan(0);
  atmosphere.update(1, [{ ...casinoMachines[0], broken: true }]);
  for (let i = 0; i < 3; i++)
    expect(colors.getX(i) + colors.getY(i) + colors.getZ(i)).toBe(0);
  expect(colors.getX(3)).toBeGreaterThan(0);
  atmosphere.update(1, []);
  expect(colors.getX(0)).toBeGreaterThan(0);
});
