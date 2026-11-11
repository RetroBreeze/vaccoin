import { mockBackend, enterCasino } from "./mock-backend.mjs";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-gpu"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
await mockBackend(page, { offline: true, savedName: true });
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:5173/?qa");
  await enterCasino(page);
  await page.waitForFunction(() => window.vaccoinQA);
  await page.keyboard.press("m");
  let started;
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().phase === "playing" && window.vaccoinQA.snapshot().countdown === 0,
  );
  started = Date.now();
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent("mousedown", { button: 0 })),
  );
  await page.evaluate(() => {
    window.qaLongTasks = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        window.qaLongTasks.push({
          start: entry.startTime,
          duration: entry.duration,
        });
    }).observe({ type: "longtask", buffered: true });
  });
  await page.waitForTimeout(3000);
  const move = async (key, ms) => {
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
  };
  await move("a", 1600);
  await move("s", 700);
  await move("w", 2500);
  await move("d", 3100);
  await move("w", 900);
  await move("a", 3100);
  await move("s", 1600);
  await move("d", 1600);
  const mid = await page.evaluate(() => window.vaccoinQA.snapshot());
  console.log("Mid-round", mid);
  await page.screenshot({ path: "test-results/full-round-mid.png" });
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().phase === "results",
    null,
    { timeout: 65000 },
  );
  const longTasks = await page.evaluate(() => window.qaLongTasks);
  const elapsed = Date.now() - started,
    result = await page.evaluate(() => window.vaccoinQA.snapshot());
  assert.equal(result.score, result.collected);
  assert(result.score >= 3000);
  assert(result.score <= 19200);
  assert(elapsed >= 59000 && elapsed < 64000, `elapsed ${elapsed}`);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: "test-results/full-round-results.png" });
  await writeFile(
    "test-results/full-round-report.json",
    JSON.stringify({ elapsed, mid, result, longTasks, errors }, null, 2),
  );
  console.log(JSON.stringify({ elapsed, result, longTasks, errors }, null, 2));
} finally {
  await browser.close();
}
