import { chromium, devices } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { mockBackend, enterCasino } from "./mock-backend.mjs";
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    ...devices["Pixel 9 landscape"],
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await mockBackend(page, { savedName: true });
  await page.goto("http://127.0.0.1:5173/?qa");
  await enterCasino(page);
  await page.waitForFunction(() => window.vaccoinQA);
  await page.clock.fastForward(100);
  assert(
    (await page.evaluate(() => window.vaccoinQA.snapshot().drawCalls)) > 0,
  );
  const camera = () =>
    page.evaluate(() => window.vaccoinQA.snapshot().cameraPosition);
  const before = await camera();
  await page.clock.fastForward(2000);
  assert.notDeepEqual(
    await camera(),
    before,
    "casino camera floats while the menu is visible",
  );
  const dimensions = await page
    .locator("#world")
    .evaluate((c) => ({ width: c.width, height: c.height }));
  assert(
    dimensions.width <= 960 && dimensions.height <= 540,
    "menu background uses a bounded render resolution",
  );
  const opacity = await page
    .locator("#lobby")
    .evaluate((e) => getComputedStyle(e).backgroundColor);
  assert(!/^rgb\(/.test(opacity), "menu surface leaves the casino visible");
  await page.screenshot({ path: "test-results/floating-casino-menu.png" });
  await page.locator("#workshop-open").tap();
  await page.clock.fastForward(100);
  await page.locator("#shop-menu").waitFor({ state: "visible" });
  const shopBefore = await camera();
  await page.clock.fastForward(2000);
  assert.notDeepEqual(
    await camera(),
    shopBefore,
    "casino continues behind shop",
  );
  await page.screenshot({ path: "test-results/floating-casino-shop.png" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.fastForward(100);
  const still = await camera();
  await page.clock.fastForward(3000);
  assert.deepEqual(
    await camera(),
    still,
    "reduced motion holds the casino camera still",
  );
  await page.locator("#workshop-back").tap();
  await page.clock.fastForward(100);
  await page.locator("#lobby").waitFor({ state: "visible" });
  const surface = await page
    .locator("#lobby")
    .evaluate((e) => ({ height: e.clientHeight, content: e.scrollHeight }));
  assert(
    surface.content <= surface.height + 1,
    "landscape layout still fits without scrolling",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS transparent casino menus, floating camera, shop background, reduced motion and bounded background rendering",
  );
} finally {
  await browser.close();
}
