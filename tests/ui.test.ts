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
