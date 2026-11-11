import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { mockBackend, enterCasino } from "./mock-backend.mjs";
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-gpu"],
});
const errors = [];
const snapshot = (page) => page.evaluate(() => window.vaccoinQA.snapshot());
async function ready(page, savedName = true) {
  page.on("pageerror", (error) => errors.push(error.message));
  await mockBackend(page, { offline: true, savedName });
  await page.goto("http://127.0.0.1:5173/?qa");
  await enterCasino(page);
  await page.waitForFunction(() => window.vaccoinQA);
}
const centre = async (page, id) => {
  const box = await page.locator(id).boundingBox();
  assert(box, id);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
try {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  const mobile = await context.newPage();
  await mobile.addInitScript(() => {
    HTMLCanvasElement.prototype.requestPointerLock = () => {
      throw Error("Mobile must not request pointer lock");
    };
    // Test the unsupported APIs fallback, which must still allow landscape play.
    Element.prototype.requestFullscreen = undefined;
  });
  await ready(mobile, false);
  await mobile.getByRole("textbox", { name: "DISPLAY NAME" }).fill("Mara");
  await mobile.screenshot({ path: "test-results/touch-title.png" });
  await mobile.getByRole("button", { name: "PLAY", exact: true }).tap();
  await mobile.waitForFunction(
    () => window.vaccoinQA.snapshot().controlsActive && window.vaccoinQA.snapshot().countdown === 0,
  );
  assert.equal((await snapshot(mobile)).locked, false);
  assert.equal((await snapshot(mobile)).controlMode, "touch");
  const cdp = await context.newCDPSession(mobile);
  const move = await centre(mobile, "#touch-move");
  const look = { x: 620, y: 140 };
  const before = await snapshot(mobile);
  const touches = [
    { ...move, id: 1 },
    { ...look, id: 2 },
  ];
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: touches,
  });
  touches[0].x += 35;
  touches[0].y -= 30;
  touches[1].x += 55;
  touches[1].y -= 20;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: touches,
  });
  await mobile.waitForFunction(() => window.vaccoinQA.snapshot().vacuumHeld);
  await mobile.waitForTimeout(600);
  const moved = await snapshot(mobile);
  assert(moved.yaw < before.yaw);
  assert(moved.pitch > before.pitch);
  assert.notDeepEqual(moved.position, before.position);
  await mobile.screenshot({ path: "test-results/touch-landscape.png" });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await mobile.waitForFunction(() => !window.vaccoinQA.snapshot().vacuumHeld);
  // Captured action fingers keep aiming and holding their action outside the button.
  for (const [id, dx] of [
    ["#touch-look", -130],
    ["#touch-jump", 70],
  ]) {
    const point = await centre(mobile, id);
    const start = await snapshot(mobile);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...point, id: 4 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: point.x + dx, y: point.y - 90, id: 4 }],
    });
    await mobile.waitForFunction(
      ({ yaw, pitch }) => {
        const state = window.vaccoinQA.snapshot();
        return Math.abs(state.yaw - yaw) > 0.05 && state.pitch > pitch + 0.05;
      },
      { yaw: start.yaw, pitch: start.pitch },
    );
    assert.equal(await mobile.locator(id).getAttribute("data-held"), "true");
    if (id === "#touch-look")
      assert.equal((await snapshot(mobile)).vacuumHeld, true);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    assert.equal(await mobile.locator(id).getAttribute("data-held"), null);
    await mobile.waitForFunction(() => !window.vaccoinQA.snapshot().vacuumHeld);
  }
  await mobile.getByRole("button", { name: "Jump", exact: true }).tap();
  await mobile.waitForFunction(
    () => window.vaccoinQA.snapshot().position[1] > 0.2,
  );
  await mobile.getByRole("button", { name: "Pause controls" }).tap();
  await mobile.waitForFunction(
    () => !window.vaccoinQA.snapshot().controlsActive,
  );
  await mobile.getByRole("button", { name: "RESUME", exact: true }).tap();
  await mobile.waitForFunction(
    () => window.vaccoinQA.snapshot().controlsActive && window.vaccoinQA.snapshot().countdown === 0,
  );
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.locator("#rotate-device").waitFor({ state: "visible" });
  await mobile.waitForFunction(
    () => !window.vaccoinQA.snapshot().controlsActive,
  );
  await mobile.screenshot({ path: "test-results/touch-portrait.png" });
  await mobile.setViewportSize({ width: 844, height: 390 });
  await mobile.locator("#rotate-device").waitFor({ state: "hidden" });
  await mobile.getByRole("button", { name: "RESUME", exact: true }).tap();
  await mobile.waitForFunction(
    () => window.vaccoinQA.snapshot().controlsActive && window.vaccoinQA.snapshot().countdown === 0,
  );
  await mobile.evaluate(() => window.dispatchEvent(new Event("blur")));
  await mobile.waitForFunction(
    () => !window.vaccoinQA.snapshot().controlsActive,
  );
  await mobile.evaluate(() => window.vaccoinQA.expire());
  await mobile.waitForFunction(
    () => window.vaccoinQA.snapshot().phase === "results",
  );
  assert.equal(await mobile.locator("#touch-controls").isVisible(), false);
  await mobile.getByRole("button", { name: "PLAY AGAIN", exact: true }).tap();
  await mobile.waitForFunction(
    () => window.vaccoinQA.snapshot().controlsActive && window.vaccoinQA.snapshot().countdown === 0,
  );
  assert.equal((await snapshot(mobile)).score, 0);
  assert.equal((await snapshot(mobile)).locked, false);
  await context.close();
  console.log(
    "PASS: mobile play without pointer lock/fullscreen support, simultaneous move/look/vacuum, aiming while holding VAC/JUMP outside their bounds, cancellation, jump, pause, portrait fallback and resume",
  );

  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  await page.addInitScript(() => {
    window.testPad = {
      index: 0,
      connected: true,
      mapping: "standard",
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    Object.defineProperty(navigator, "getGamepads", {
      value: () => (window.testPad ? [window.testPad] : []),
    });
  });
  await ready(page);
  const button = async (index, down) =>
    page.evaluate(
      ([i, down]) => {
        window.testPad.buttons[i] = { pressed: down, value: down ? 1 : 0 };
      },
      [index, down],
    );
  await button(9, true);
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().phase === "playing" && window.vaccoinQA.snapshot().countdown === 0,
  );
  await button(9, false);
  assert.equal((await snapshot(page)).locked, false);
  assert.equal((await snapshot(page)).controlMode, "gamepad");
  await page.evaluate(() => {
    window.testPad.axes = [1, -1, 1, -1];
  });
  await button(7, true);
  await page.waitForFunction(() => window.vaccoinQA.snapshot().vacuumHeld);
  await page.waitForTimeout(700);
  const controlled = await snapshot(page);
  assert(controlled.position[0] > 0);
  assert(controlled.yaw < 0);
  await page.evaluate(() => {
    window.testPad.axes = [0, 0, 0, 0];
  });
  await button(7, false);
  await button(0, true);
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().position[1] > 0.2,
  );
  await button(0, false);
  await button(9, true);
  await page.waitForFunction(() => !window.vaccoinQA.snapshot().controlsActive);
  await button(9, false);
  await page.waitForTimeout(250);
  await button(9, true);
  await page.waitForFunction(() => window.vaccoinQA.snapshot().controlsActive);
  await button(9, false);
  await page.evaluate(() => {
    window.testPad = null;
  });
  await page.waitForFunction(() => !window.vaccoinQA.snapshot().controlsActive);
  await page.getByRole("button", { name: "RESUME", exact: true }).click();
  await page.waitForFunction(() => window.vaccoinQA.snapshot().locked, null, {
    timeout: 3000,
  });
  assert.equal((await snapshot(page)).controlMode, "mouse");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !window.vaccoinQA.snapshot().locked);
  await page
    .getByRole("button", { name: "Enter fullscreen", exact: true })
    .click();
  await page.waitForFunction(() => !!document.fullscreenElement);
  await page
    .getByRole("button", { name: "Exit fullscreen", exact: true })
    .click();
  await page.waitForFunction(() => !document.fullscreenElement);
  await page.evaluate(() => {
    window.vaccoinQA.expire();
    window.testPad = {
      index: 0,
      connected: true,
      mapping: "standard",
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
  });
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().phase === "results",
  );
  await button(0, true);
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().phase === "playing" && window.vaccoinQA.snapshot().countdown === 0,
  );
  assert.equal((await snapshot(page)).controlMode, "gamepad");
  assert.equal((await snapshot(page)).score, 0);
  assert.equal((await snapshot(page)).locked, false);
  await page.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: standard gamepad start, movement, look, trigger, jump, pause/resume, disconnect safety and fullscreen toggle",
  );
} finally {
  await browser.close();
}
