import { afterEach, expect, it, vi } from "vitest";
import type { AudioEngine } from "../src/audio";
import { installEntryScreen } from "../src/entry-screen";
import { ImmersiveDisplay } from "../src/immersive";

afterEach(() => vi.unstubAllGlobals());

function fixture(standalone = false) {
  const button = Object.assign(new EventTarget(), { disabled: true });
  const prompt = { textContent: "LOADING…" };
  const guidance = { hidden: true, textContent: "" };
  const entry = { hidden: false, querySelector: () => prompt };
  vi.stubGlobal("document", {
    documentElement: {},
    getElementById: (id: string) =>
      ({
        "entry-screen": entry,
        "enter-casino": button,
        "entry-display-help": guidance,
      })[id],
    body: { classList: { add() {} } },
  });
  vi.stubGlobal("navigator", { userAgent: "iPhone", standalone });
  vi.stubGlobal("screen", {});
  const audio = { unlock: vi.fn(async () => {}) } as unknown as AudioEngine;
  const entered = installEntryScreen(audio, new ImmersiveDisplay(true));
  return { button, guidance, entry, entered };
}

it("shows installation guidance only at entry when native fullscreen is unsupported", () => {
  const { guidance, button, entry, entered } = fixture();
  expect(guidance.hidden).toBe(false);
  expect(guidance.textContent).toMatch(/Add to Home Screen/);
  expect(button.disabled).toBe(false);
  button.dispatchEvent(new Event("click"));
  expect(entered()).toBe(true);
  expect(entry.hidden).toBe(true);
});

it("does not suggest installing an already standalone game", () => {
  const { guidance } = fixture(true);
  expect(guidance.hidden).toBe(true);
});
