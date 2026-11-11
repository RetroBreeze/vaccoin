import { mockBackend, enterCasino } from "./mock-backend.mjs";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-gpu"],
});
try {
  const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    }),
    errors = [];
  await mockBackend(page, { offline: true, savedName: true });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5173/?qa");
  await enterCasino(page);
  await page.waitForFunction(() => window.vaccoinQA);
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await page.waitForFunction(() => window.vaccoinQA.snapshot().locked && window.vaccoinQA.snapshot().countdown === 0);
  await page.evaluate(() => window.vaccoinQA.teleport(-5, 0, 18));
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent("mousedown", { button: 0 })),
  );
  await page.waitForFunction(() => window.vaccoinQA.snapshot().destroyed === 1);
  await page.waitForTimeout(130);
  const small = await page.evaluate(() => window.vaccoinQA.snapshot());
  assert.equal(small.coins, 12240);
  assert(small.active > 100);
  await page.screenshot({ path: "test-results/small-coin-explosion.png" });
  await page.waitForTimeout(350);
  await page.screenshot({ path: "test-results/small-shower-stream.png" });
  await page.keyboard.press("r");
  await page.evaluate(() => window.vaccoinQA.teleport(11, 0, 23));
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent("mousedown", { button: 0 })),
  );
  await page.keyboard.down("w");
  await page.waitForFunction(() => window.vaccoinQA.snapshot().destroyed === 1);
  await page.keyboard.up("w");
  await page.waitForTimeout(120);
  const large = await page.evaluate(() => window.vaccoinQA.snapshot());
  assert.equal(large.coins, 12540);
  assert(large.active >= 540);
  assert(large.active <= 1800);
  await page.screenshot({ path: "test-results/large-coin-explosion.png" });
  await page.waitForTimeout(700);
  await page.screenshot({ path: "test-results/large-shower-stream.png" });
  const after = await page.evaluate(() => window.vaccoinQA.snapshot());
  assert.equal(after.score, after.collected);
  assert.equal(after.alive + after.collected, after.coins);
  await page.keyboard.press("r");
  const reset = await page.evaluate(() => window.vaccoinQA.snapshot());
  assert.equal(reset.active, 0);
  assert.equal(reset.coins, 12000);
  assert.equal(reset.destroyed, 0);
  assert.deepEqual(errors, []);
  await writeFile(
    "test-results/explosions-report.json",
    JSON.stringify({ small, large, after, errors }, null, 2),
  );
  console.log(
    "PASS: 240/540-coin explosions, held suction, bounded active pool, exact scoring and restart",
  );
} finally {
  await browser.close();
}
