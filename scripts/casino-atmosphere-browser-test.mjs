import { chromium } from "@playwright/test";
import { mockBackend, enterCasino } from "./mock-backend.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const origin = process.env.CASINO_TEST_ORIGIN ?? "http://127.0.0.1:5175";
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-gpu"],
});
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } }),
    errors = [];
  await mockBackend(page, {
    offline: true,
    savedName: true,
    appOrigin: origin,
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /shader|WebGL|THREE/.test(m.text()))
      errors.push(m.text());
  });
  await mkdir("test-results", { recursive: true });
  await page.goto(origin + "/?qa");
  await enterCasino(page);
  await page.waitForFunction(() => !!window.vaccoinQA, null, {
    timeout: 60000,
  });
  await page
    .getByRole("button", { name: "PLAY", exact: true })
    .click({ noWaitAfter: true, timeout: 60000 });
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().phase === "playing" && window.vaccoinQA.snapshot().countdown === 0,
  );
  for (const [name, position] of [
    ["entrance", [0, 0, 35, 0, -0.08]],
    ["slots", [-30.9, 0, -22, 0, -0.08]],
    ["entrance-back", [0, 0, 0, Math.PI, 0.08]],
    ["balcony", [-12, 5, 8, -Math.PI / 2, -0.35]],
  ]) {
    await page.evaluate((p) => window.vaccoinQA.teleport(...p), position);
    await page.screenshot({ path: `test-results/casino-golden-${name}.png` });
    console.log("Captured", name);
  }
  await page.keyboard.press("r");
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
  const snapshot = await page.evaluate(() => window.vaccoinQA.snapshot());
  const size = await page
    .locator("#world")
    .evaluate((c) => [
      c.width,
      c.height,
      innerWidth * devicePixelRatio,
      innerHeight * devicePixelRatio,
    ]);
  assert.equal(size[0], size[2]);
  assert.equal(size[1], size[3]);
  assert.equal(snapshot.score, snapshot.collectibleScore);
  assert.deepEqual(errors, []);
  const report = {
    score: snapshot.score,
    drawCalls: snapshot.drawCalls,
    triangles: snapshot.triangles,
    averageFrameMs: snapshot.averageFrameMs,
    errors,
  };
  await writeFile(
    "test-results/casino-atmosphere-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(report);
} finally {
  await browser.close();
}
