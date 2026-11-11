import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("ships real slot/table textures instead of the GLB placeholder pixels", () => {
  for (const name of [
    "slot-gold",
    "slot-neon",
    "slot-classic",
    "poker",
    "roulette",
    "blackjack",
  ]) {
    const data = readFileSync(`public/assets/casino/${name}.glb`);
    expect(data.readUInt32LE(8)).toBe(data.length);
    const gltf = JSON.parse(
      data.subarray(20, 20 + data.readUInt32LE(12)).toString(),
    );
    for (const image of gltf.images) {
      expect(image.uri).toBeTruthy();
      const png = readFileSync(`public/assets/casino/${image.uri}`);
      expect(png.readUInt32BE(16)).toBeGreaterThan(1);
      expect(png.readUInt32BE(20)).toBeGreaterThan(1);
    }
  }
});
