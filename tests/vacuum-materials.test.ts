import { expect, it } from "vitest";
import { createVacuumMaterials, applyVacuumColour } from "../src/vacuum-model";
import { COSMETICS } from "../src/workshop-state";
import { DataTexture, NearestFilter, SRGBColorSpace } from "three";

it("keeps surface detail shared and intact when shop colours change", () => {
  const held = createVacuumMaterials();
  const preview = createVacuumMaterials();
  for (const [slot, material] of held) {
    const texture = material.map;
    expect(texture, `${slot} needs surface detail`).toBeInstanceOf(DataTexture);
    expect(texture!.magFilter).toBe(NearestFilter);
    expect(texture!.colorSpace).toBe(SRGBColorSpace);
    expect(preview.get(slot)!.map).toBe(texture);
    const pixels = (texture as DataTexture).image.data;
    expect(new Set(pixels).size).toBeGreaterThan(16);
    for (const colour of COSMETICS) {
      applyVacuumColour(preview, colour);
      expect(preview.get(slot)!.map).toBe(texture);
    }
  }
});
it("previews each shop palette without changing the equipped vacuum", () => {
  const held = createVacuumMaterials(),
    preview = createVacuumMaterials();
  for (const item of COSMETICS) {
    applyVacuumColour(preview, item);
    expect(preview.get("body")!.color.getHex()).toBe(item.body);
    expect(preview.get("accent")!.color.getHex()).toBe(item.accent);
    expect(held.get("body")!.color.getHex()).toBe(0x83709e);
  }
  applyVacuumColour(preview, COSMETICS[0]);
  expect(preview.get("coupler")!.color.getHex()).toBe(0x04d4cf);
  expect(preview.get("body")!.color.getHex()).toBe(
    held.get("body")!.color.getHex(),
  );
});
