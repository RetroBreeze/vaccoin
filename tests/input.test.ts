import { expect, it } from "vitest";
import { PlayIntent } from "../src/input";
it("restarts unlocked rounds after mouse capture instead of resuming", () => {
  const intent = new PlayIntent();
  intent.request(true);
  expect(intent.acquired("playing")).toBe("start");
  expect(intent.acquired("playing")).toBe("none");
});
it("waits for the capture event for both promise and void pointer APIs", () => {
  const intent = new PlayIntent();
  intent.request(false);
  expect(intent.acquired("title")).toBe("start");
  intent.request(false);
  expect(intent.acquired("playing")).toBe("resume");
  intent.cancel();
  expect(intent.acquired("title")).toBe("none");
});
