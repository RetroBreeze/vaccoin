import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-gpu"],
});
try {
  const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    }),
    errors = [],
    failed = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(r.url());
  });
  await page.goto("http://127.0.0.1:4173/?qa");
  await page.getByRole("button", { name: "PLAY", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => typeof window.vaccoinQA), "undefined");
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await page.waitForFunction(() => document.pointerLockElement?.id === "world");
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent("mousedown", { button: 0 })),
  );
  await page.waitForTimeout(250);
  await page.screenshot({ path: "test-results/production-suction.png" });
  await page.waitForTimeout(1000);
  await page.keyboard.press("r");
  assert.match(await page.locator("#status").textContent(), /Round started/);
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  console.log(
    "PASS: production assets, WebGL, pointer lock, suction, restart; QA hooks absent",
  );
} finally {
  await browser.close();
}
