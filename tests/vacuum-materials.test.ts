import { expect, it } from "vitest";
import { createVacuumMaterials, applyVacuumColour } from "../src/vacuum-model";
import { COSMETICS } from "../src/workshop-state";
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
