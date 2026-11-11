import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mockBackend, enterCasino } from "./mock-backend.mjs";

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-gpu"],
});
const errors = [];
const snapshot = (page) => page.evaluate(() => window.vaccoinQA.snapshot());
async function ready(page) {
  page.on("pageerror", (error) => errors.push(error.message));
  await mockBackend(page, { savedName: true });
  await page.goto("http://127.0.0.1:5173/?qa");
  await enterCasino(page);
  await page.waitForFunction(() => window.vaccoinQA);
  await page.clock.fastForward(20);
}
try {
  const mobile = await browser.newPage({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 0.25,
  });
  await mobile.clock.install();
  await mobile.clock.pauseAt(new Date(Date.now() + 1000));
  await ready(mobile);
  await mobile.evaluate(() => {
    document.documentElement.requestFullscreen = () =>
      new Promise((resolve) => {
        window.dispatchEvent(new Event("blur"));
        setTimeout(resolve, 150);
      });
  });
  await mobile.locator("#play").tap();
  await mobile.clock.fastForward(250);
  const start = await snapshot(mobile);
  assert.equal(
    start.controlsActive,
    true,
    "fullscreen entry blur must not leave a new round paused",
  );
  assert.equal(
    await mobile.locator("#pause-menu").isVisible(),
    false,
    "normal Play must not show Resume",
  );
  assert.equal(start.countdown, 3);
  assert.equal(start.remaining, 60);
  await mobile.keyboard.down("w");
  await mobile.evaluate(() => {
    document.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
    window.vaccoinQA.collect(100);
  });
  await mobile.clock.fastForward(1000);
  assert.deepEqual(
    (await snapshot(mobile)).position,
    start.position,
    "movement stays frozen during countdown",
  );
  assert.equal((await snapshot(mobile)).score, 0, "countdown blocks scoring");
  assert.equal((await snapshot(mobile)).remaining, 60);
  assert.equal((await snapshot(mobile)).countdown, 2);
  await mobile.clock.fastForward(1000);
  assert.equal((await snapshot(mobile)).countdown, 1);
  await mobile.clock.fastForward(1000);
  await mobile.clock.fastForward(200);
  assert((await snapshot(mobile)).position[2] < start.position[2] - 0.1);
  await mobile.keyboard.up("w");
  await mobile.evaluate(() => window.dispatchEvent(new Event("blur")));
  assert.equal((await snapshot(mobile)).controlsActive, false);
  await mobile.clock.fastForward(20);
  assert.equal(await mobile.locator("#pause-menu").isVisible(), true);
  await mobile.locator("#play").tap();
  await mobile.clock.fastForward(200);
  assert.equal((await snapshot(mobile)).controlsActive, true);
  assert.equal(
    (await snapshot(mobile)).countdown,
    0,
    "resume does not restart the countdown",
  );
  await mobile.close();

  const desktop = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 0.25,
  });
  await desktop.clock.install();
  await desktop.clock.pauseAt(new Date(Date.now() + 1000));
  await ready(desktop);
  await desktop.locator("#play").click();
  await desktop.clock.fastForward(20);
  await desktop.clock.fastForward(200);
  assert.equal(
    (await snapshot(desktop)).controlsActive,
    true,
    "native menu transition retains mouse capture",
  );
  assert.equal(await desktop.locator("#pause-menu").isVisible(), false);
  assert.equal((await snapshot(desktop)).remaining, 60);
  assert.equal((await snapshot(desktop)).countdown, 3);
  await desktop.keyboard.down("w");
  const before = await snapshot(desktop);
  await desktop.clock.fastForward(400);
  assert.deepEqual((await snapshot(desktop)).position, before.position);
  await desktop.clock.fastForward(3000);
  await desktop.clock.fastForward(200);
  assert((await snapshot(desktop)).position[2] < before.position[2] - 0.1);
  await desktop.keyboard.up("w");
  await desktop.keyboard.press("Escape");
  assert.equal((await snapshot(desktop)).controlsActive, false);
  await desktop.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: fullscreen transition starts active, 3/2/1 freezes movement/scoring with timer at 60, desktop capture survives menu transition, later blur/Escape pause, Resume continues",
  );
} finally {
  await browser.close();
}
