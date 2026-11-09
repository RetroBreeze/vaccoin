import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-gpu"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const snapshot = () => page.evaluate(() => window.vaccoinQA.snapshot());
try {
  await page.goto("http://127.0.0.1:5173/?qa");
  await page.waitForFunction(() => !!window.vaccoinQA);
  await page.screenshot({ path: "test-results/title.png" });
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().phase === "playing",
  );
  assert.equal((await snapshot()).locked, true);
  console.log("Started", await snapshot());
  await page.screenshot({ path: "test-results/start.png" });
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent("mousedown", { button: 0 })),
  );
  await page.waitForTimeout(3000);
  const opening = await snapshot();
  assert(opening.score > 300, JSON.stringify(opening));
  assert.equal(opening.score, opening.collected);
  await page.screenshot({ path: "test-results/suction.png" });
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent("mouseup", { button: 0 })),
  );
  // Actual keyboard traversal up and down wide ramps, then jump/drop.
  await page.evaluate(() => window.vaccoinQA.teleport(-23, 0, 25));
  await page.keyboard.down("w");
  await page.waitForTimeout(1800);
  await page.keyboard.up("w");
  const upstairs = await snapshot();
  assert(upstairs.position[1] > 5.5, JSON.stringify(upstairs));
  await page.screenshot({ path: "test-results/gallery.png" });
  await page.evaluate(() => window.vaccoinQA.teleport(20.5, 0, -9));
  await page.keyboard.down("w");
  await page.waitForTimeout(1450);
  await page.keyboard.up("w");
  const downstairs = await snapshot();
  assert(downstairs.position[1] < -5, JSON.stringify(downstairs));
  await page.screenshot({ path: "test-results/vault.png" });
  await page.keyboard.down("s");
  await page.waitForTimeout(1500);
  await page.keyboard.up("s");
  assert((await snapshot()).position[1] > -0.1);
  // Vacuum a green crate, then smash a large one using movement speed.
  await page.evaluate(() => window.vaccoinQA.teleport(-5, 0, 18));
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent("mousedown", { button: 0 })),
  );
  await page.waitForTimeout(1100);
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent("mouseup", { button: 0 })),
  );
  assert((await snapshot()).destroyed >= 1);
  await page.evaluate(() => window.vaccoinQA.teleport(11, 0, 23));
  await page.keyboard.down("w");
  await page.waitForTimeout(650);
  await page.keyboard.up("w");
  assert((await snapshot()).destroyed >= 2);
  assert((await snapshot()).coins > 12000);
  // Mute, unlock, ensure clock advances and expiry stops input/scoring.
  await page.keyboard.press("m");
  assert.equal((await snapshot()).muted, true);
  await page.evaluate(() => document.exitPointerLock());
  const before = await snapshot();
  await page.waitForTimeout(300);
  const unlocked = await snapshot();
  assert(unlocked.remaining < before.remaining);
  assert.equal(unlocked.score, before.score);
  await page.evaluate(() => window.vaccoinQA.expire());
  await page.waitForTimeout(100);
  const result = await snapshot();
  assert.equal(result.phase, "results");
  assert.equal(result.best, result.score);
  assert.match(result.online, /UNAVAILABLE/);
  await page.screenshot({ path: "test-results/results.png" });
  // Wait beyond Chromium's post-escape pointer-lock cooldown.
  await page.waitForTimeout(1300);
  await page.getByRole("button", { name: "PLAY AGAIN", exact: true }).click();
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().phase === "playing",
  );
  const reset = await snapshot();
  assert.equal(reset.score, 0);
  assert.equal(reset.collected, 0);
  assert.equal(reset.coins, 12000);
  assert.equal(reset.active, 0);
  assert.equal(reset.destroyed, 0);
  assert(reset.remaining > 59);
  await page.setViewportSize({ width: 800, height: 600 });
  await page.waitForTimeout(100);
  await page.screenshot({ path: "test-results/scaling.png" });
  assert.deepEqual(errors, []);
  const report = { opening, upstairs, downstairs, result, reset, errors };
  await writeFile(
    "test-results/browser-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
