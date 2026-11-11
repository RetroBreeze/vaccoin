import { describe, expect, it } from "vitest";
import {
  AdaptiveResolution,
  renderPixelRatio,
  type RenderViewport,
} from "../src/rendering-policy";

const phone: RenderViewport = {
  width: 844,
  height: 390,
  devicePixelRatio: 3,
  mobile: true,
  menu: false,
};

describe("framebuffer pixel budget", () => {
  it("avoids rendering millions of pixels on a high-DPR phone", () => {
    const ratio = renderPixelRatio(phone);
    expect(phone.width * phone.height * ratio ** 2).toBeLessThan(1_000_000);
    expect(ratio).toBeGreaterThanOrEqual(1);
  });

  it("bounds tablet and desktop costs while preserving the viewport aspect", () => {
    for (const [mobile, budget] of [
      [true, 1_000_000],
      [false, 2_100_000],
    ] as const) {
      const viewport = { ...phone, width: 3840, height: 2160, mobile };
      const ratio = renderPixelRatio(viewport);
      expect(viewport.width * viewport.height * ratio ** 2).toBeLessThan(
        budget,
      );
      expect(ratio).toBeGreaterThan(0);
    }
  });

  it("retains native desktop resolution when already within budget", () => {
    expect(
      renderPixelRatio({
        ...phone,
        width: 1920,
        height: 1080,
        devicePixelRatio: 1,
        mobile: false,
      }),
    ).toBe(1);
  });

  it("does not supersample a low-DPR display", () => {
    expect(
      renderPixelRatio({ ...phone, devicePixelRatio: 1 }),
    ).toBeLessThanOrEqual(1);
  });

  it("preserves resolution across orientation changes", () => {
    expect(renderPixelRatio(phone)).toBe(
      renderPixelRatio({ ...phone, width: phone.height, height: phone.width }),
    );
  });

  it("keeps menu limits independent of gameplay quality", () => {
    const menu = { ...phone, menu: true, width: 1920, height: 1080 };
    expect(renderPixelRatio(menu, 0.65)).toBe(0.5);
    expect(renderPixelRatio(menu, 1)).toBe(0.5);
  });

  it("reduces actual framebuffer area with the adaptive scale", () => {
    const full = renderPixelRatio(phone);
    expect(renderPixelRatio(phone, 0.65) ** 2).toBeLessThan(full ** 2 / 2);
  });

  it("keeps a transient zero-sized viewport finite", () => {
    const ratio = renderPixelRatio({ ...phone, width: 0, height: 0 });
    expect(Number.isFinite(ratio)).toBe(true);
    expect(ratio).toBeGreaterThan(0);
  });
});

function feed(
  policy: AdaptiveResolution,
  count: number,
  frameMs: number,
  active = true,
) {
  let changes = 0;
  for (let i = 0; i < count; i++)
    changes += Number(policy.observeFrame(frameMs, active));
  return changes;
}

describe("adaptive gameplay resolution", () => {
  it("reduces quality when active frames are consistently slower than 250ms", () => {
    const policy = new AdaptiveResolution();
    feed(policy, 20, 500);
    expect(policy.scale).toBeLessThan(1);
    expect(policy.scale).toBeGreaterThanOrEqual(0.6);
  });

  it("does not carry a long frame from an inactive tab into resumed sampling", () => {
    const policy = new AdaptiveResolution();
    for (let i = 0; i < 20; i++) {
      feed(policy, 1, 500);
      feed(policy, 1, 500, false);
      feed(policy, 15, 1000 / 60);
    }
    expect(policy.scale).toBe(1);
  });

  it("holds quality through isolated stutters but lowers it during sustained slow frames", () => {
    const policy = new AdaptiveResolution();
    feed(policy, 60, 1000 / 60);
    feed(policy, 1, 80);
    feed(policy, 60, 1000 / 60);
    expect(policy.scale).toBe(1);
    expect(feed(policy, 40, 1000 / 30)).toBeGreaterThan(0);
    expect(policy.scale).toBeLessThan(1);
  });

  it("requires sustained recovery before restoring quality", () => {
    const policy = new AdaptiveResolution();
    feed(policy, 40, 1000 / 30);
    const reduced = policy.scale;
    feed(policy, 180, 1000 / 60);
    expect(policy.scale).toBe(reduced);
    feed(policy, 480, 1000 / 60);
    expect(policy.scale).toBe(1);
  });

  it("does not treat menus, hidden-tab gaps, or the first resumed frame as slow gameplay", () => {
    const policy = new AdaptiveResolution();
    feed(policy, 1000, 1000 / 24, false);
    feed(policy, 1, 5000);
    feed(policy, 1, 200);
    feed(policy, 60, 1000 / 60);
    expect(policy.scale).toBe(1);
  });

  it("does not accumulate partial slow windows across pauses", () => {
    const policy = new AdaptiveResolution();
    for (let i = 0; i < 20; i++) {
      feed(policy, 15, 1000 / 30);
      feed(policy, 1, 1000 / 24, false);
    }
    expect(policy.scale).toBe(1);
  });

  it("bounds resolution on permanently slow hardware and avoids repeated resizes at the floor", () => {
    const policy = new AdaptiveResolution();
    feed(policy, 300, 50);
    expect(policy.scale).toBeLessThan(1);
    expect(policy.scale).toBeGreaterThanOrEqual(0.6);
    expect(feed(policy, 300, 50)).toBe(0);
  });

  it("ignores invalid timing samples", () => {
    const policy = new AdaptiveResolution();
    for (const ms of [NaN, Infinity, -1, 0]) feed(policy, 500, ms);
    feed(policy, 40, 1000 / 30);
    expect(policy.scale).toBeLessThan(1);
  });
});
