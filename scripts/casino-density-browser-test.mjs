import { chromium } from "@playwright/test";
import { mockBackend, enterCasino } from "./mock-backend.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const origin = process.env.CASINO_TEST_ORIGIN ?? "http://localhost:5173";
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-gpu"],
});
const page = await browser.newPage({
  viewport: { width: 960, height: 540 },
  deviceScaleFactor: 1.5,
});
const errors = [];
page.setDefaultTimeout(30000);
page.on("pageerror", (e) => errors.push(e.message));
await page.clock.install();
await page.clock.pauseAt(new Date(Date.now() + 1000));
await mockBackend(page, { offline: true, savedName: true, appOrigin: origin });
try {
  await page.goto(origin + "/?qa");
  await enterCasino(page);
  await page.waitForFunction(() => !!window.vaccoinQA, null, {
    timeout: 60000,
  });
  await page.clock.fastForward(20);
  const resolution = (target = page) =>
    target.locator("#world").evaluate((c) => ({
      width: c.width,
      height: c.height,
      ratio: devicePixelRatio,
      css: getComputedStyle(c).imageRendering,
      antialias: c.getContext("webgl2").getContextAttributes().antialias,
    }));
  const initial = await resolution();
  assert.equal(initial.width, 960);
  assert.equal(initial.height, 540);
  assert.equal(initial.css, "auto");
  assert.equal(initial.antialias, false);
  await page.locator("#play").click({ noWaitAfter: true, timeout: 60000 });
  await page.clock.fastForward(20);
  const gameplay = await resolution();
  assert(gameplay.width > initial.width);
  assert(gameplay.width * gameplay.height <= 1920 * 1080);
  assert.equal(gameplay.antialias, false);
  const count = await page.evaluate(() => window.vaccoinQA.snapshot().coins);
  assert(count > 30000);
  await page.clock.fastForward(3100);
  await page.evaluate(() => window.vaccoinQA.teleport(12, 0, 22, 0, -0.2));
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent("mousedown", { button: 0 })),
  );
  let score = 0;
  for (let frame = 0; frame < 30 && score <= 100; frame++) {
    await page.clock.fastForward(100);
    score = await page.evaluate(() => window.vaccoinQA.snapshot().score);
  }
  assert(score > 100, "vacuum collects actual casino items during active play");
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent("mouseup", { button: 0 })),
  );
  await page.setViewportSize({ width: 640, height: 400 });
  await page.clock.fastForward(20);
  const resized = await resolution();
  assert(Math.abs(resized.width / resized.height - 1.6) < 0.01);
  assert(resized.width <= 960 && resized.height <= 600);
  const snapshot = await page.evaluate(() => window.vaccoinQA.snapshot());
  await page.close();

  const mobile = await browser.newPage({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  mobile.setDefaultTimeout(30000);
  mobile.on("pageerror", (e) => errors.push(e.message));
  await mobile.clock.install();
  await mobile.clock.pauseAt(new Date(Date.now() + 1000));
  await mockBackend(mobile, {
    offline: true,
    savedName: true,
    appOrigin: origin,
  });
  await mobile.goto(origin + "/?qa");
  await enterCasino(mobile);
  await mobile.waitForFunction(() => !!window.vaccoinQA);
  await mobile.clock.fastForward(20);
  await mobile.evaluate(() => {
    document.documentElement.requestFullscreen = undefined;
  });
  await mobile.locator("#play").tap();
  await mobile.clock.fastForward(30);
  const mobileGameplay = await resolution(mobile);
  assert.equal(mobileGameplay.ratio, 3);
  assert.equal(mobileGameplay.width, 1266);
  assert.equal(mobileGameplay.height, 585);
  assert.equal(mobileGameplay.antialias, false);
  await mobile.setViewportSize({ width: 932, height: 430 });
  await mobile.clock.fastForward(30);
  const mobileResized = await resolution(mobile);
  assert.equal(mobileResized.width, 1398);
  assert.equal(mobileResized.height, 645);
  assert(mobileResized.width * mobileResized.height <= 1280 * 720);
  await mobile.close();
  assert.deepEqual(errors, []);
  const report = {
    initial,
    gameplay,
    resized,
    mobileGameplay,
    mobileResized,
    looseItems: count,
    corridorPoints: snapshot.score,
    errors,
  };
  await writeFile(
    "test-results/casino-density-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  if (!page.isClosed())
    console.error(
      await page.evaluate(() => ({
        snapshot: window.vaccoinQA?.snapshot(),
        status: document.querySelector("#status")?.textContent,
      })),
    );
  throw error;
} finally {
  await browser.close();
}
