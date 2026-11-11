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
  await page.waitForFunction(() => window.vaccoinQA.snapshot().locked);
  const results = [];
  for (const [x, y, z, targetY] of [
    [-14, 0, 16.5, 6],
    [14, 0, 16.5, 6],
    [-23, -6, -24.5, 0],
    [23, -6, -24.5, 0],
  ]) {
    await page.evaluate(
      ([x, y, z]) => window.vaccoinQA.teleport(x, y, z),
      [x, y, z],
    );
    await page.keyboard.down("w");
    await page.waitForTimeout(240);
    await page.keyboard.up("w");
    await page.waitForFunction(
      (y) => window.vaccoinQA.snapshot().position[1] > y + 1,
      targetY,
      { timeout: 2000 },
    );
    await page.screenshot({ path: `test-results/spring-air-${x}-${y}.png` });
    await page.waitForTimeout(1500);
    const state = await page.evaluate(() => window.vaccoinQA.snapshot());
    assert(Math.abs(state.position[1] - targetY) < 0.1, JSON.stringify(state));
    results.push(state.position);
  }
  // A player should not need to release the approach key for a vault launch.
  await page.evaluate(() => window.vaccoinQA.teleport(-23, -6, -24.5));
  await page.keyboard.down("w");
  await page.waitForFunction(
    () => {
      const p = window.vaccoinQA.snapshot().position;
      return p[1] === 0 && p[2] > -10;
    },
    null,
    { timeout: 3000 },
  );
  await page.keyboard.up("w");
  await page.evaluate(() => window.vaccoinQA.teleport(0, 0, -8));
  await page.keyboard.down("w");
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().position[2] < -24,
    null,
    { timeout: 8000 },
  );
  await page.keyboard.up("w");
  const floor = await page.evaluate(() => window.vaccoinQA.snapshot());
  assert(floor.position[2] < -24);
  assert.equal(floor.position[1], 0);
  await page.screenshot({ path: "test-results/repaired-floor.png" });
  await page.evaluate(() => window.vaccoinQA.teleport(14, 0, 18, 0, -0.3));
  await page.waitForTimeout(100);
  await page.screenshot({ path: "test-results/springboard.png" });
  await page.keyboard.press("r");
  const reset = await page.evaluate(() => window.vaccoinQA.snapshot());
  assert.deepEqual(reset.position, [0, 0, 20]);
  assert.deepEqual(errors, []);
  await writeFile(
    "test-results/springboards-report.json",
    JSON.stringify(
      { landings: results, floor: floor.position, errors },
      null,
      2,
    ),
  );
  console.log(
    "PASS: four springboard landings, central floor crossing, restart; no browser errors",
  );
} finally {
  await browser.close();
}
