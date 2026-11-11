import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { mockBackend, enterCasino } from "./mock-backend.mjs";
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-gpu"],
});
try {
  for (const origin of process.argv.slice(2).length
    ? process.argv.slice(2)
    : ["http://localhost:5173"]) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    const calls = await mockBackend(page, { appOrigin: origin });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${origin}/?qa`);
    await enterCasino(page);
    await page.waitForFunction(() => window.vaccoinQA);
    assert.equal(calls.signups, 0);
    await page.getByRole("textbox", { name: "DISPLAY NAME" }).fill("Mara");
    await page.getByRole("button", { name: "PLAY", exact: true }).click();
    await page.waitForFunction(
      () => window.vaccoinQA.snapshot().phase === "playing" && window.vaccoinQA.snapshot().countdown === 0,
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
      () => window.vaccoinQA.snapshot().phase === "playing" && window.vaccoinQA.snapshot().countdown === 0,
    );
    assert.equal(
      (await page.evaluate(() => window.vaccoinQA.snapshot())).score,
      0,
    );
    await page.reload();
    await enterCasino(page);
    await page.waitForFunction(() =>
      window.vaccoinQA?.snapshot().online.startsWith("GLOBAL"),
    );
    assert.equal(calls.signups, 1);
    assert.equal(calls.profiles, 1);
    assert.equal(await page.locator("#player-name").isVisible(), false);
    // A 200 response can still fail the SDK contract. Public reads must stay visible.
    await page.route("**/leaderboards/vaccoin/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ invalid: true }),
      }),
    );
    const partial = await page.evaluate(async () => {
      const { Leaderboard } = await import("/src/supagame.ts");
      const { configuredGameServices } = await import("/src/game-services.ts");
      const board = new Leaderboard(undefined, configuredGameServices());
      await board.connect("Mara");
      return {
        status: board.status,
        entries: board.entries.length,
        retry: board.retryLabel,
      };
    });
    assert.match(
      partial.status,
      /PERSONAL BEST UNAVAILABLE \/ INVALID API RESPONSE/,
    );
    assert.doesNotMatch(partial.status, /OFFLINE/);
    assert.equal(partial.entries, 10);
    assert.equal(partial.retry, "RETRY RANKINGS");
    assert.deepEqual(errors, []);
    console.log(
      `${origin} PASS: name confirmation, persisted anonymous session, actual final coins, one submission, personal best, rank, top 10, restart and reload (HTTP mocked)`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
