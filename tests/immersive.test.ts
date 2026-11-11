import { afterEach, expect, it, vi } from "vitest";
import { ImmersiveDisplay } from "../src/immersive";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
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

it("uses WebKit fullscreen and exit on older Safari", async () => {
  const doc = {
    webkitFullscreenElement: null as object | null,
    documentElement: {
      webkitRequestFullscreen: vi.fn(() => {
        doc.webkitFullscreenElement = {};
      }),
    },
    webkitExitFullscreen: vi.fn(() => {
      doc.webkitFullscreenElement = null;
    }),
  };
  vi.stubGlobal("document", doc);
  vi.stubGlobal("screen", {});
  const display = new ImmersiveDisplay(true);
  expect(display.supported).toBe(true);
  await expect(display.enter()).resolves.toBe(true);
  expect(doc.webkitFullscreenElement).not.toBeNull();
  await expect(display.toggle()).resolves.toBe(true);
  expect(doc.webkitFullscreenElement).toBeNull();
});

it.each(["apple", "media"])(
  "recognizes %s standalone mode without requesting fullscreen",
  async (mode) => {
    const { doc, orientation } = fixture();
    vi.stubGlobal("navigator", { standalone: mode === "apple" });
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: mode === "media" && query === "(display-mode: standalone)",
    }));
    const display = new ImmersiveDisplay(true);
    expect(display.standalone).toBe(true);
    await expect(display.enter()).resolves.toBe(true);
    await expect(display.toggle()).resolves.toBe(true);
    expect(doc.documentElement.requestFullscreen).not.toHaveBeenCalled();
    expect(doc.exitFullscreen).not.toHaveBeenCalled();
    expect(orientation.lock).toHaveBeenCalledWith("landscape");
  },
);

it("deduplicates entry requests while fullscreen is still pending", async () => {
  const { doc } = fixture();
  let finish!: () => void;
  doc.documentElement.requestFullscreen.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const display = new ImmersiveDisplay(false);
  const first = display.enter();
  const second = display.enter();
  expect(doc.documentElement.requestFullscreen).toHaveBeenCalledTimes(1);
  finish();
  await expect(first).resolves.toBe(true);
  await expect(second).resolves.toBe(true);
});

it("does not wait for a browser's unresolved orientation lock", async () => {
  const { orientation } = fixture();
  orientation.lock.mockImplementation(() => new Promise<void>(() => {}));
  const result = new ImmersiveDisplay(true).enter();
  await expect(
    Promise.race([
      result,
      new Promise((resolve) => setTimeout(() => resolve("blocked"), 40)),
    ]),
  ).resolves.toBe(true);
});

it("does not request fullscreen when the browser explicitly disables it", async () => {
  const { doc } = fixture();
  Object.assign(doc, { fullscreenEnabled: false });
  const display = new ImmersiveDisplay(true);
  expect(display.supported).toBe(false);
  await expect(display.enter()).resolves.toBe(false);
  expect(doc.documentElement.requestFullscreen).not.toHaveBeenCalled();
});

it("provides Home Screen guidance on iPhone without fullscreen APIs", async () => {
  const { doc } = fixture();
  Object.defineProperty(doc.documentElement, "requestFullscreen", {
    value: undefined,
  });
  vi.stubGlobal("navigator", { userAgent: "iPhone", platform: "iPhone" });
  const display = new ImmersiveDisplay(true);
  expect(display.supported).toBe(false);
  expect(display.fallbackMessage).toMatch(/Add to Home Screen/);
  expect(display.fallbackMessage).toMatch(/Safari/);
  await expect(display.enter()).resolves.toBe(false);
});

it("lets Play wait for an entry transition without requesting fullscreen again", async () => {
  const { doc } = fixture();
  let finish!: () => void;
  doc.documentElement.requestFullscreen.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const display = new ImmersiveDisplay(false);
  void display.enter();
  let ready = false;
  const settled = display.whenSettled().then(() => {
    ready = true;
  });
  await Promise.resolve();
  expect(ready).toBe(false);
  finish();
  await settled;
  expect(ready).toBe(true);
  expect(doc.documentElement.requestFullscreen).toHaveBeenCalledTimes(1);
});

it("releases Play if the browser never completes a fullscreen request", async () => {
  vi.useFakeTimers();
  const { doc } = fixture();
  doc.documentElement.requestFullscreen.mockImplementation(
    () => new Promise<void>(() => {}),
  );
  const display = new ImmersiveDisplay(false);
  const result = display.enter();
  const settled = display.whenSettled();
  await vi.advanceTimersByTimeAsync(1500);
  await expect(result).resolves.toBe(false);
  await expect(settled).resolves.toBeUndefined();
});

it("waits for legacy WebKit fullscreen change events before releasing Play", async () => {
  const events = new EventTarget();
  const doc = {
    webkitFullscreenElement: null as object | null,
    documentElement: { webkitRequestFullscreen() {} },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  };
  vi.stubGlobal("document", doc);
  const display = new ImmersiveDisplay(false);
  let ready = false;
  const result = display.enter();
  const settled = display.whenSettled().then(() => {
    ready = true;
  });
  await Promise.resolve();
  expect(ready).toBe(false);
  doc.webkitFullscreenElement = {};
  events.dispatchEvent(new Event("webkitfullscreenchange"));
  await expect(result).resolves.toBe(true);
  await settled;
  expect(ready).toBe(true);
});
