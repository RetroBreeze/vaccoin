import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { mockBackend } from "./mock-backend.mjs";
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-gpu"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  const calls = await mockBackend(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5173/?qa");
  await page.waitForFunction(() => window.vaccoinQA);
  assert.equal(calls.signups, 0);
  await page.getByRole("textbox", { name: "DISPLAY NAME" }).fill("Mara");
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().phase === "playing",
  );
  await page.waitForFunction(() =>
    window.vaccoinQA.snapshot().online.startsWith("GLOBAL"),
  );
  assert.equal(calls.signups, 1);
  assert.equal(calls.profiles, 1);
  assert.equal(calls.submissions.length, 0);
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent("mousedown", { button: 0 })),
  );
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.vaccoinQA.expire());
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().online === "SCORE SUBMITTED",
  );
  const state = await page.evaluate(() => window.vaccoinQA.snapshot());
  assert(state.score > 0);
  assert.equal(state.score, state.collected);
  assert.equal(calls.submissions.length, 1);
  assert.equal(calls.submissions[0].score, state.score);
  assert.match(calls.submissions[0].submissionKey, /^[0-9a-f-]{36}$/);
  assert.equal(state.personalBest, state.score);
  assert.equal(state.rank, 12);
  assert.equal(state.entries.length, 10);
  await page.screenshot({ path: "test-results/leaderboard-results.png" });
  await page.setViewportSize({ width: 540, height: 540 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: "test-results/leaderboard-narrow.png" });
  await page.evaluate(() => window.vaccoinQA.expire());
  await page.waitForTimeout(300);
  assert.equal(calls.submissions.length, 1);
  await page.waitForTimeout(1300);
  await page.getByRole("button", { name: "PLAY AGAIN", exact: true }).click();
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().phase === "playing",
  );
  assert.equal(
    (await page.evaluate(() => window.vaccoinQA.snapshot())).score,
    0,
  );
  await page.reload();
  await page.waitForFunction(() =>
    window.vaccoinQA?.snapshot().online.startsWith("GLOBAL"),
  );
  assert.equal(calls.signups, 1);
  assert.equal(calls.profiles, 1);
  assert.equal(await page.locator("#player-name").isVisible(), false);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: name confirmation, persisted anonymous session, actual final coins, one submission, personal best, rank, top 10, restart and reload (HTTP mocked)",
  );
} finally {
  await browser.close();
}
