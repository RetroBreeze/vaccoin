import { chromium } from "@playwright/test";
import { mockBackend, enterCasino } from "./mock-backend.mjs";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const origin = process.env.CASINO_TEST_ORIGIN ?? "http://localhost:5175";
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-gpu"],
});
const page = await browser.newPage({
  viewport: { width: 960, height: 540 },
  deviceScaleFactor: 1.5,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await mockBackend(page, { offline: true, savedName: true, appOrigin: origin });
try {
  await page.goto(origin + "/?qa");
  await enterCasino(page);
  await page.waitForFunction(() => !!window.vaccoinQA, null, {
    timeout: 60000,
  });
  const resolution = () =>
    page.locator("#world").evaluate((c) => ({
      width: c.width,
      height: c.height,
      ratio: devicePixelRatio,
      css: getComputedStyle(c).imageRendering,
      antialias: c.getContext("webgl2").getContextAttributes().antialias,
    }));
  const initial = await resolution();
  assert.equal(initial.width, 1440);
  assert.equal(initial.height, 810);
  assert.equal(initial.css, "auto");
  assert(initial.antialias);
  await page
    .getByRole("button", { name: "PLAY", exact: true })
    .click({ noWaitAfter: true, timeout: 60000 });
  const count = await page.evaluate(() => window.vaccoinQA.snapshot().coins);
  assert(count > 30000);
  await page.evaluate(() => window.vaccoinQA.teleport(12, 0, 22, 0, -0.2));
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent("mousedown", { button: 0 })),
  );
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().score > 100,
    null,
    { timeout: 30000 },
  );
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent("mouseup", { button: 0 })),
  );
  await page.screenshot({ path: "test-results/casino-native-density.png" });
  await page.evaluate(() =>
    window.vaccoinQA.teleport(-12, 5, 8, -Math.PI / 2, -0.45),
  );
  await page.screenshot({ path: "test-results/casino-balcony-final.png" });
  await page.setViewportSize({ width: 640, height: 400 });
  const resized = await resolution();
  assert.equal(resized.width, 960);
  assert.equal(resized.height, 600);
  const snapshot = await page.evaluate(() => window.vaccoinQA.snapshot());
  assert.deepEqual(errors, []);
  const report = {
    initial,
    resized,
    looseItems: count,
    corridorPoints: snapshot.score,
    errors,
  };
  await writeFile(
    "test-results/casino-density-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
