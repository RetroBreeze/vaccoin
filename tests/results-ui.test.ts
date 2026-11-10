import { expect, it, vi } from "vitest";
import { UI, type UIState } from "../src/ui";
vi.mock("../src/pixel-font", () => ({ pixelText: vi.fn() }));
import { pixelText } from "../src/pixel-font";

it("renders all ten standings, final score, personal best, rank and retry state", () => {
  vi.stubGlobal("innerWidth", 540);
  vi.stubGlobal("innerHeight", 540);
  const ctx = { clearRect: vi.fn(), fillRect: vi.fn() };
  const control = () => ({
    style: {},
    addEventListener: vi.fn(),
    setAttribute: vi.fn(),
    textContent: "",
  });
  const retry = control();
  const canvas = { getContext: () => ctx, width: 0, height: 0 };
  const ui = new UI(
    canvas as unknown as HTMLCanvasElement,
    control() as unknown as HTMLButtonElement,
    control() as unknown as HTMLButtonElement,
    retry as unknown as HTMLButtonElement,
  );
  const state: UIState = {
    phase: "results",
    score: 437,
    best: 900,
    personalBest: 800,
    rank: 12,
    remaining: 0,
    sucking: false,
    locked: false,
    time: 0,
    muted: false,
    error: "",
    persisted: true,
    leaderboardStatus: "SCORE SUBMITTED / RANKINGS UNAVAILABLE",
    leaderboardReadStatus: "NO SCORES YET",
    retryLabel: "RETRY RANKINGS",
    loading: false,
    canRetry: true,
    entries: Array.from({ length: 10 }, (_, i) => ({
      name: `Player ${i + 1}`,
      rank: i + 1,
      score: 1000 - i,
    })),
  };
  ui.draw(state, 0.016);
  const texts = vi.mocked(pixelText).mock.calls.map((c) => c[1]);
  expect(texts).toContain("437");
  expect(texts).toContain("PERSONAL BEST 800");
  expect(texts).toContain("RANK 12");
  expect(texts).toContain("10. Player 10");
  expect(texts).toContain("991");
  expect(texts).toContain("SCORE SUBMITTED / RANKINGS UNAVAILABLE");
  expect(texts).toContain("RETRY RANKINGS");
  expect(texts).not.toContain("RETRY ONLINE");
  expect(retry.style).toHaveProperty("display", "block");
  vi.mocked(pixelText).mockClear();
  ui.draw(
    {
      ...state,
      entries: [],
      leaderboardStatus: "PERSONAL BEST UNAVAILABLE / INVALID API RESPONSE",
    },
    0.016,
  );
  const emptyTexts = vi.mocked(pixelText).mock.calls.map((c) => c[1]);
  expect(emptyTexts).toContain("NO SCORES YET");
  expect(emptyTexts).not.toContain("LEADERBOARD OFFLINE");
  vi.unstubAllGlobals();
});
