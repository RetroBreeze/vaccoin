import { afterEach, expect, it, vi } from "vitest";
import { ImmersiveDisplay } from "../src/immersive";
afterEach(() => vi.unstubAllGlobals());
function fixture(fullscreen = false) {
  const orientation = { lock: vi.fn(async () => {}), unlock: vi.fn() };
  const doc = {
    fullscreenElement: fullscreen ? {} : null,
    documentElement: {
      requestFullscreen: vi.fn(async () => {
        doc.fullscreenElement = {};
      }),
    },
    exitFullscreen: vi.fn(async () => {
      doc.fullscreenElement = null;
    }),
  };
  vi.stubGlobal("document", doc);
  vi.stubGlobal("screen", { orientation });
  return { doc, orientation };
}
it("enters immersive display before requesting mobile landscape lock", async () => {
  const { doc, orientation } = fixture();
  await new ImmersiveDisplay(true).enter();
  expect(doc.documentElement.requestFullscreen).toHaveBeenCalledWith({
    navigationUI: "hide",
  });
  expect(orientation.lock).toHaveBeenCalledWith("landscape");
  expect(
    doc.documentElement.requestFullscreen.mock.invocationCallOrder[0],
  ).toBeLessThan(orientation.lock.mock.invocationCallOrder[0]);
});
it("exits fullscreen and releases the orientation lock", async () => {
  const { doc, orientation } = fixture(true);
  await new ImmersiveDisplay(true).toggle();
  expect(doc.exitFullscreen).toHaveBeenCalled();
  expect(orientation.unlock).toHaveBeenCalled();
});
it("falls back to browser play when fullscreen or landscape locking is rejected", async () => {
  const { doc, orientation } = fixture();
  doc.documentElement.requestFullscreen.mockRejectedValueOnce(Error("denied"));
  await expect(new ImmersiveDisplay(true).enter()).resolves.toBe(false);
  orientation.lock.mockRejectedValueOnce(Error("unsupported"));
  await expect(new ImmersiveDisplay(true).enter()).resolves.toBe(true);
});
it("does not request a mobile orientation lock on desktop", async () => {
  const { orientation } = fixture();
  await new ImmersiveDisplay(false).enter();
  expect(orientation.lock).not.toHaveBeenCalled();
});
it("handles a browser without fullscreen APIs", async () => {
  const { doc } = fixture();
  Object.defineProperty(doc.documentElement, "requestFullscreen", {
    value: undefined,
  });
  await expect(new ImmersiveDisplay(true).enter()).resolves.toBe(false);
});
