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
  await mobile.waitForFunction(
    () => window.vaccoinQA.snapshot().phase === "playing",
  );
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
  assert.deepEqual(
    start.cameraPosition,
    [start.position[0], start.position[1] + 1.7, start.position[2]],
    "countdown uses the normal player camera",
  );
  assert(
    start.vacuumPosition[2] < -0.5 &&
      start.vacuumPosition[0] > 0 &&
      start.vacuumPosition[1] < 0,
    "vacuum is already in its normal lower-right pose",
  );
  await mobile.clock.fastForward(20);
  assert.equal(
    await mobile.locator("#lobby").isVisible(),
    false,
    "countdown renders the gameplay view",
  );
  await mobile.screenshot({
    path: "test-results/countdown-normal-view.png",
    scale: "css",
  });
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
  assert.equal(await mobile.locator("#touch-jump").count(), 0);
  const grounded = await snapshot(mobile);
  await mobile.touchscreen.tap(620, 140);
  await mobile.clock.fastForward(60);
  assert.equal(
    (await snapshot(mobile)).position[1],
    grounded.position[1],
    "single tap does not jump",
  );
  await mobile.touchscreen.tap(620, 140);
  await mobile.clock.fastForward(100);
  assert(
    (await snapshot(mobile)).position[1] > grounded.position[1] + 0.1,
    "double tap jumps",
  );
  await mobile.evaluate(() => window.dispatchEvent(new Event("blur")));
  assert.equal((await snapshot(mobile)).controlsActive, false);
  await mobile.clock.fastForward(20);
  assert.equal(await mobile.locator("#pause-menu").isVisible(), true);
  assert.equal(await mobile.locator("#pause-menu .menu-note").count(), 0);
  const pauseBox = await mobile
    .locator("#pause-menu .menu-content")
    .boundingBox();
  assert(
    Math.abs(pauseBox.x + pauseBox.width / 2 - 422) < 1,
    "pause centred horizontally",
  );
  assert(
    Math.abs(pauseBox.y + pauseBox.height / 2 - 195) < 1,
    "pause centred vertically",
  );
  await mobile.screenshot({
    path: "test-results/pause-centred.png",
    scale: "css",
  });
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
  assert(
    (await snapshot(desktop)).vacuumPosition[2] < -0.5,
    "desktop countdown also has the resting vacuum pose",
  );
  await desktop.keyboard.down("w");
  const before = await snapshot(desktop);
  await desktop.clock.fastForward(400);
  assert.deepEqual((await snapshot(desktop)).position, before.position);
  await desktop.clock.fastForward(3000);
  await desktop.clock.fastForward(200);
  assert((await snapshot(desktop)).position[2] < before.position[2] - 0.1);
  await desktop.keyboard.up("w");
  await desktop.keyboard.press("Escape");
  await desktop.waitForFunction(
    () => !window.vaccoinQA.snapshot().controlsActive,
  );
  assert.equal((await snapshot(desktop)).controlsActive, false);
  await desktop.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: fullscreen transition starts active, READY/GET SET/GOLD countdown freezes movement/scoring with timer at 60, double-tap jumping, centred pause, desktop capture survives menu transition, later blur/Escape pause, Resume continues",
  );
} finally {
  await browser.close();
}
