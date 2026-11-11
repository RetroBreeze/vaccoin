import { expect, it, vi } from "vitest";
import { UI, type UIState } from "../src/ui";
vi.mock("../src/pixel-font", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/pixel-font")>()),
  pixelText: vi.fn(),
}));
import { pixelText } from "../src/pixel-font";

it("draws the gameplay score and rounded-up remaining time", () => {
  vi.stubGlobal("innerWidth", 844);
  vi.stubGlobal("innerHeight", 390);
  const ctx = { fillRect: vi.fn(), clearRect: vi.fn() };
  const ui = new UI({ getContext: () => ctx } as unknown as HTMLCanvasElement);
  vi.mocked(pixelText).mockClear();
  ui.draw(
    {
      phase: "playing",
      score: 1234,
      remaining: 25.2,
      time: 1,
      locked: true,
    } as UIState,
    0.016,
  );
  const text = vi.mocked(pixelText).mock.calls.map((call) => call[1]);
  expect(text).toContain("1,234");
  expect(text).toContain("26");
  expect(text).toContain("POINTS");
  vi.unstubAllGlobals();
});

it.each([
  [3, "READY"],
  [2, "GET SET"],
  [1, "GOLD!"],
] as const)(
  "draws countdown %i as compact centred %s without a panel",
  (countdown, label) => {
    vi.stubGlobal("innerWidth", 756);
    vi.stubGlobal("innerHeight", 308);
    const ctx = { fillRect: vi.fn(), clearRect: vi.fn() };
    const ui = new UI({
      getContext: () => ctx,
    } as unknown as HTMLCanvasElement);
    vi.mocked(pixelText).mockClear();
    ui.draw(
      {
        phase: "playing",
        score: 0,
        remaining: 60,
        time: 0,
        locked: true,
        countdown,
      } as UIState,
      0.016,
    );
    const calls = vi
      .mocked(pixelText)
      .mock.calls.filter((call) => call[1] === label);
    expect(calls.length).toBeGreaterThan(0);
    const [, , x, y, scale, , align] = calls.at(-1)!;
    expect(x).toBe(ui.w / 2);
    expect(y + (7 * scale) / 2).toBeCloseTo(270, 0);
    expect(scale).toBeLessThanOrEqual(4);
    expect(align).toBe("center");
    expect(ctx.fillRect).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  },
);
