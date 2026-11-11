import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { mockBackend } from "./mock-backend.mjs";

const origin = process.env.CASINO_TEST_ORIGIN ?? "http://localhost:5175";
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-gpu"],
});
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await mockBackend(page, { offline: true, savedName: true, appOrigin: origin });
const errors = [],
  requests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => requests.push(r.url()));
const snap = () => page.evaluate(() => window.vaccoinQA.snapshot());
const teleport = (...args) =>
  page.evaluate((args) => window.vaccoinQA.teleport(...args), args);
const hold = (down) =>
  page.evaluate(
    (down) =>
      document.dispatchEvent(
        new MouseEvent(down ? "mousedown" : "mouseup", { button: 0 }),
      ),
    down,
  );
try {
  await page.goto(origin + "/?qa");
  console.log("Page loaded");
  await page.waitForFunction(() => !!window.vaccoinQA, null, {
    timeout: 60000,
  });
  await page
    .getByRole("button", { name: "PLAY", exact: true })
    .click({ noWaitAfter: true, timeout: 60000 });
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().phase === "playing",
  );
  console.log("Playing");
  const initialCoins = (await snap()).coins;
  const resolution = await page.locator("#world").evaluate((c) => ({
    width: c.width,
    height: c.height,
    expectedWidth: Math.floor(innerWidth * devicePixelRatio),
    expectedHeight: Math.floor(innerHeight * devicePixelRatio),
  }));
  assert.equal(resolution.width, resolution.expectedWidth);
  assert.equal(resolution.height, resolution.expectedHeight);
  await page.screenshot({ path: "test-results/casino-entrance.png" });
  console.log("Entrance captured");
  await page.keyboard.press("r");
  await hold(true);
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().score > 300,
    null,
    { timeout: 15000 },
  );
  await hold(false);
  const opening = await snap();
  assert(opening.score > opening.collected);
  assert.equal(opening.score, opening.collectibleScore);
  assert.equal(opening.alive + opening.collected, opening.coins);
  await page.keyboard.press("r");
  await teleport(-34, 0, 9);
  await page.keyboard.down("w");
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().position[1] >= 4.99,
    null,
    { timeout: 45000 },
  );
  await page.keyboard.up("w");
  assert((await snap()).position[1] >= 4.99);
  await teleport(-12, 5, 8, -Math.PI / 2, -0.45);
  await page.screenshot({ path: "test-results/casino-balcony.png" });
  await teleport(27, 5, -9, 0, -0.12);
  await page.screenshot({ path: "test-results/casino-high-limit.png" });
  await page.keyboard.press("r");
  await teleport(24, 0, -9, Math.PI);
  await page.keyboard.down("w");
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().position[1] <= -4.99,
    null,
    { timeout: 45000 },
  );
  await page.keyboard.up("w");
  await teleport(27, -5, -9, 0, -0.12);
  await page.screenshot({ path: "test-results/casino-counting.png" });
  await page.keyboard.press("r");
  await teleport(-30.9, 0, -22, 0, -0.05);
  await page.screenshot({ path: "test-results/casino-slots.png" });
  await hold(true);
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().destroyed >= 1,
    null,
    { timeout: 20000 },
  );
  await hold(false);
  const burst = await snap();
  assert(burst.coins > initialCoins);
  await page.keyboard.press("r");
  const reset = await snap();
  assert.equal(reset.score, 0);
  assert.equal(reset.destroyed, 0);
  assert.equal(reset.coins, initialCoins);
  assert.equal(reset.alive, initialCoins);
  await page.evaluate(() => window.vaccoinQA.expire());
  assert.equal((await snap()).phase, "results");
  assert(!requests.some((url) => url.endsWith(".zip")));
  assert(requests.some((url) => url.includes("casino/slot-gold.glb")));
  assert.deepEqual(errors, []);
  const report = {
    opening: {
      score: opening.score,
      items: opening.collected,
      drawCalls: opening.drawCalls,
      triangles: opening.triangles,
      averageFrameMs: opening.averageFrameMs,
    },
    burst: { destroyed: burst.destroyed, items: burst.coins },
    reset: { score: reset.score, items: reset.coins },
    errors,
  };
  await writeFile(
    "test-results/casino-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
