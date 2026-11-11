import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { mockBackend } from "./mock-backend.mjs";
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--use-angle=gl", "--enable-gpu"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mockBackend(page, { savedName: true });
  await page.addInitScript(() => {
    window.entryCalls = [];
    Element.prototype.requestFullscreen = function () {
      window.entryCalls.push({
        api: "fullscreen",
        active: navigator.userActivation.isActive,
      });
      return Promise.reject(new Error("Unsupported test device"));
    };
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      window.entryCalls.push({
        api: "audio",
        active: navigator.userActivation.isActive,
      });
      return original.call(this);
    };
  });
  await page.goto("http://127.0.0.1:5173/?qa");
  // This must be present immediately, even while game assets load.
  await page
    .getByRole("button", { name: "Click or tap to start", exact: true })
    .waitFor({ timeout: 5000 });
  assert.equal(await page.locator("#play").isVisible(), false);
  await page.screenshot({ path: "test-results/casino-entry.png" });
  await page
    .getByRole("button", { name: "Click or tap to start", exact: true })
    .tap();
  await page.waitForFunction(() => window.vaccoinQA);
  await page
    .getByRole("button", { name: "PLAY", exact: true })
    .waitFor({ state: "visible" });
  const calls = await page.evaluate(() => window.entryCalls);
  assert(calls.some((c) => c.api === "fullscreen" && c.active));
  assert(calls.some((c) => c.api === "audio" && c.active));
  assert.equal(
    await page.evaluate(() => window.vaccoinQA.snapshot().phase),
    "title",
  );
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await page.screenshot({
      path: `test-results/casino-menu-${viewport.width}.png`,
    });
    assert.equal(
      await page.locator("button button").count(),
      0,
      "menu controls are never nested",
    );
    for (const id of [
      "play",
      "leaderboard-open",
      "achievements-open",
      "workshop-open",
      "account-open",
    ]) {
      const b = page.locator(`#${id}`);
      await b.scrollIntoViewIfNeeded();
      const box = await b.boundingBox();
      assert(
        box && box.width >= 48 && box.height >= 48,
        `${id} comfortable at ${viewport.width}`,
      );
      assert(
        box.x >= 0 && box.x + box.width <= viewport.width + 1,
        `${id} fits width`,
      );
    }
    await page.locator("#leaderboard-open").tap();
    await page.locator("#leaderboard-back").tap();
    await page.locator("#achievements-open").tap();
    await page
      .getByRole("heading", { name: "Achievements", exact: true })
      .waitFor();
    await page.waitForFunction(
      () => document.activeElement.id === "achievements-open",
    );
    await page.locator("#achievements-open").tap();
    await page.locator("#workshop-open").tap();
    await page
      .getByRole("heading", { name: "Shop", exact: true })
      .waitFor();
    await page.screenshot({
      path: `test-results/casino-shop-${viewport.width}.png`,
    });
    await page.locator("#workshop-back").tap();
    await page.locator("#account-open").tap();
    await page.locator("#account-back").tap();
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator("#play").tap();
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().phase === "playing" && window.vaccoinQA.snapshot().countdown === 0,
  );
  for (let pause = 0; pause < 2; pause++) {
    await page.locator("#pause").tap();
    await page
      .waitForFunction(
        () => document.activeElement.id === "play",
        {},
        { timeout: 10000 },
      )
      .catch(async (error) => {
        console.log(
          "Pause focus failure",
          pause,
          await page.evaluate(() => ({
            focused: document.activeElement.id,
            phase: window.vaccoinQA.snapshot().phase,
            active: window.vaccoinQA.snapshot().controlsActive,
          })),
        );
        throw error;
      });
    await page.locator("#play").tap();
    await page.waitForFunction(
      () => window.vaccoinQA.snapshot().controlsActive && window.vaccoinQA.snapshot().countdown === 0,
    );
  }
  await page.waitForFunction(() => window.vaccoinQA.snapshot().countdown === 0);
  await page.evaluate(() => {
    window.vaccoinQA.collect(12000);
    window.vaccoinQA.expire();
  });
  await page.locator("#achievement-toast").waitFor({ state: "visible" });
  await page.locator("#main-menu").waitFor({ state: "visible" });
  await page.screenshot({ path: "test-results/casino-results.png" });
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().workshop.progress.wallet === 12000,
  );
  await page.locator("#workshop-open").tap();
  await page.locator("#workshop-next").tap();
  await page.getByRole("button", { name: "BUY + EQUIP", exact: true }).tap();
  await page.waitForFunction(
    () =>
      window.vaccoinQA.snapshot().workshop.progress.equipped === "brick-red",
  );
  assert.equal(
    await page.evaluate(
      () => window.vaccoinQA.snapshot().workshop.progress.wallet,
    ),
    9500,
  );
  await page.locator("#workshop-back").tap();
  await page.locator("#main-menu").tap();
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().phase === "title",
  );
  assert.equal(await page.locator("#entry-screen").isVisible(), false);
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().workshop.status === "CLOUD SAVED",
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Click or tap to start", exact: true })
    .tap();
  await page.waitForFunction(
    () =>
      window.vaccoinQA?.snapshot().workshop.progress.equipped === "brick-red",
  );
  assert.equal(
    await page.evaluate(
      () => window.vaccoinQA.snapshot().workshop.progress.wallet,
    ),
    9500,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS responsive casino menus, gesture audio/fullscreen, fallback, navigation, touch targets, results return",
  );
} finally {
  await browser.close();
}
