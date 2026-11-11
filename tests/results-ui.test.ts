import { expect, it, vi } from "vitest";
import { UI, type UIState } from "../src/ui";
vi.mock("../src/pixel-font", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/pixel-font")>()),
  pixelText: vi.fn(),
}));
import { pixelText } from "../src/pixel-font";

it("renders a concise results screen with standings, score, best, rank and retry", () => {
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
  expect(texts).toContain("BEST 800");
  expect(texts).toContain("RANK 12");
  expect(texts).toContain("10. Player 10");
  expect(texts).toContain("991");
  expect(texts).not.toContain("SCORE SUBMITTED / RANKINGS UNAVAILABLE");
  expect(texts).toContain("TOP 10");
  expect(texts).not.toContain("LOCAL BEST KEPT THIS SESSION");
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

it("rolls title entries without network activity and renders live states and notices", () => {
  vi.stubGlobal("innerWidth", 844);
  vi.stubGlobal("innerHeight", 390);
  const control = () => ({
    style: {},
    addEventListener: vi.fn(),
    setAttribute: vi.fn(),
    textContent: "",
  });
  const ctx = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
  };
  const ui = new UI(
    { getContext: () => ctx } as unknown as HTMLCanvasElement,
    control() as unknown as HTMLButtonElement,
    control() as unknown as HTMLButtonElement,
    control() as unknown as HTMLButtonElement,
  );
  const state = {
    phase: "title",
    time: 0,
    liveStatus: "CONNECTED",
    liveEntries: [
      { rank: 1, name: "FIRST", score: 50 },
      { rank: 2, name: "SECOND", score: 40, isPlayer: true },
    ],
    rankNotice: "YOU ENTERED THE TOP 10!",
  } as UIState;
  vi.mocked(pixelText).mockClear();
  ui.draw(state, 0.016);
  expect(
    vi.mocked(pixelText).mock.calls.some((c) => c[1].includes("FIRST")),
  ).toBe(true);
  state.time = 3;
  vi.mocked(pixelText).mockClear();
  ui.draw(state, 0.016);
  expect(
    vi
      .mocked(pixelText)
      .mock.calls.some((c) => c[1].includes("SECOND") && c[5] === "#ffcf58"),
  ).toBe(true);
  expect(
    vi.mocked(pixelText).mock.calls.some((c) => c[1] === state.rankNotice),
  ).toBe(true);
  state.liveEntries = [];
  state.liveStatus = "RECONNECTING";
  vi.mocked(pixelText).mockClear();
  ui.draw(state, 0.016);
  expect(
    vi.mocked(pixelText).mock.calls.some((c) => c[1].includes("RECONNECTING")),
  ).toBe(true);
});

it("marks your leaderboard row with supported pixel-font brackets", () => {
  vi.stubGlobal("innerWidth", 960);
  vi.stubGlobal("innerHeight", 540);
  const control = () =>
    ({
      style: {},
      addEventListener: vi.fn(),
      setAttribute: vi.fn(),
      textContent: "",
    }) as unknown as HTMLButtonElement;
  const ctx = { clearRect: vi.fn(), fillRect: vi.fn() };
  const ui = new UI(
    { getContext: () => ctx } as unknown as HTMLCanvasElement,
    control(),
    control(),
    control(),
    { open: control(), top: control(), around: control(), back: control() },
  );
  vi.mocked(pixelText).mockClear();
  ui.draw(
    {
      phase: "title",
      leaderboardOpen: true,
      browseEntries: [{ rank: 1, name: "MARA", score: 100, isPlayer: true }],
    } as UIState,
    0.016,
  );
  expect(vi.mocked(pixelText).mock.calls.map((call) => call[1])).toContain(
    "1. MARA [YOU]",
  );
  vi.unstubAllGlobals();
});

it("draws gameplay achievement notices below the score and timer", () => {
  vi.stubGlobal("innerWidth", 540);
  vi.stubGlobal("innerHeight", 720);
  const control = () =>
    ({
      style: {},
      addEventListener: vi.fn(),
      setAttribute: vi.fn(),
    }) as unknown as HTMLButtonElement;
  const ctx = { fillRect: vi.fn() };
  const ui = new UI(
    { getContext: () => ctx } as unknown as HTMLCanvasElement,
    control(),
    control(),
    control(),
  );
  vi.mocked(pixelText).mockClear();
  ui.drawAchievements(
    {
      phase: "playing",
      achievementNotice: {
        id: "run-coins-500",
        title: "First haul",
        description: "Collect 500 coins in one run.",
      },
    } as UIState,
    control(),
  );
  const title = vi
    .mocked(pixelText)
    .mock.calls.find((call) => call[1] === "ACHIEVEMENT UNLOCKED");
  expect(title).toBeDefined();
  expect(title![3]).toBeGreaterThanOrEqual(90);
  vi.unstubAllGlobals();
});
