import { mockBackend, enterCasino } from "./mock-backend.mjs";
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
await mockBackend(page, { offline: true, savedName: false });
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().startsWith("Failed to load resource"))
    errors.push(m.text());
});
const snapshot = () => page.evaluate(() => window.vaccoinQA.snapshot());
try {
  await page.goto("http://127.0.0.1:5173/?qa");
  await enterCasino(page);
  await page.waitForFunction(() => !!window.vaccoinQA);
  const nameInput = page.getByRole("textbox", { name: "DISPLAY NAME" });
  await nameInput.waitFor({ state: "visible" });
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  assert.equal((await snapshot()).phase, "title");
  await nameInput.fill("Mara");
  await nameInput.press("r");
  await nameInput.press("m");
  assert.equal((await snapshot()).phase, "title");
  assert.equal((await snapshot()).muted, false);
  await nameInput.fill("Mara");
  await page.screenshot({ path: "test-results/title.png" });
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().phase === "playing" && window.vaccoinQA.snapshot().countdown === 0,
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
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().position[1] > 5.5,
    null,
    { timeout: 8000 },
  );
  await page.keyboard.up("w");
  const upstairs = await snapshot();
  assert(upstairs.position[1] > 5.5, JSON.stringify(upstairs));
  await page.screenshot({ path: "test-results/gallery.png" });
  await page.evaluate(() => window.vaccoinQA.teleport(20.5, 0, -9));
  await page.keyboard.down("w");
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().position[1] < -5,
    null,
    { timeout: 8000 },
  );
  await page.keyboard.up("w");
  const downstairs = await snapshot();
  assert(downstairs.position[1] < -5, JSON.stringify(downstairs));
  await page.screenshot({ path: "test-results/vault.png" });
  await page.keyboard.down("s");
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().position[1] > -0.1,
    null,
    { timeout: 8000 },
  );
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
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().destroyed >= 2,
    null,
    { timeout: 5000 },
  );
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
  await page.waitForFunction(() =>
    window.vaccoinQA.snapshot().online.includes("UNAVAILABLE"),
  );
  const result = await snapshot();
  assert.equal(result.phase, "results");
  assert.equal(result.best, result.score);
  assert.match(result.online, /UNAVAILABLE/);
  await page.screenshot({ path: "test-results/results.png" });
  // Wait beyond Chromium's post-escape pointer-lock cooldown.
  await page.waitForTimeout(1300);
  await page.getByRole("button", { name: "PLAY AGAIN", exact: true }).click();
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().phase === "playing" && window.vaccoinQA.snapshot().countdown === 0,
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
  await page.reload();
  await enterCasino(page);
  await page.waitForFunction(() => !!window.vaccoinQA);
  assert.equal(await page.locator("#player-name").isVisible(), false);
  assert.equal(await page.locator("#display-name").inputValue(), "Mara");
  await page.evaluate(() => localStorage.removeItem("vaccoin.display-name.v1"));
  await page.reload();
  await enterCasino(page);
  await page.waitForFunction(() => !!window.vaccoinQA);
  await nameInput.fill("New Player");
  await nameInput.press("Enter");
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().phase === "playing" && window.vaccoinQA.snapshot().countdown === 0,
  );
  assert.equal(await page.locator("#player-name").isVisible(), false);
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
