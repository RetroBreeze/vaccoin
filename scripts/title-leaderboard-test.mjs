import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { mockBackend, enterCasino } from "./mock-backend.mjs";

const origin = process.argv[2] || "http://localhost:5173";
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-gpu"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  page.setDefaultTimeout(30000);
  const calls = await mockBackend(page, { appOrigin: origin });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${origin}/?qa`);
  await enterCasino(page);
  await page.waitForFunction(() => window.vaccoinQA);
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().live.status === "CONNECTED",
  );
  const initialSessions = calls.signups;
  await page.screenshot({ path: "test-results/title-redesign-desktop.png" });
  await page.getByRole("button", { name: "LEADERBOARD", exact: true }).focus();
  await page.keyboard.press("Enter");
  assert.equal(
    (await page.evaluate(() => window.vaccoinQA.snapshot())).leaderboardBrowser
      .open,
    true,
    "Enter opens the leaderboard",
  );
  await page.waitForFunction(
    () =>
      document
        .querySelector("#leaderboard-top")
        ?.getAttribute("aria-pressed") === "true",
  );
  assert.equal(await page.locator("#player-name").isVisible(), false);
  assert.equal(await page.locator("#play").isVisible(), false);
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().leaderboardBrowser.entries.length === 10,
  );
  assert.equal(
    calls.signups,
    initialSessions,
    "browsing creates no additional sessions",
  );
  await page.getByRole("button", { name: "AROUND YOU", exact: true }).click();
  await page.waitForFunction(() =>
    window.vaccoinQA
      .snapshot()
      .leaderboardBrowser.status.includes("PLAY A ROUND"),
  );
  assert.equal(
    calls.signups,
    initialSessions,
    "browsing creates no additional sessions",
  );
  await page.getByRole("button", { name: "BACK", exact: true }).click();
  await page.locator("#player-name").waitFor({ state: "visible" });
  assert.equal(
    (await page.evaluate(() => window.vaccoinQA.snapshot())).phase,
    "title",
  );
  await page.getByRole("button", { name: "LEADERBOARD", exact: true }).focus();
  await page.keyboard.press("Space");
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().leaderboardBrowser.open,
  );
  await page.keyboard.press("Escape");

  await page.evaluate(() => {
    const identity = Object.keys(localStorage).find(key => key.startsWith('vaccoin.workshop.identity:'));
    const namespace = identity.slice('vaccoin.workshop.identity:'.length);
    const player = localStorage.getItem(identity);
    localStorage.setItem(`vaccoin.display-name.v1:${namespace}:${player}`, 'Mara');
  });
  const playerId = "11111111-1111-4111-8111-111111111111";
  const entries = Array.from({ length: 125 }, (_, i) => ({
    playerId:
      i === 103
        ? playerId
        : `22222222-2222-4222-8222-${String(i + 1).padStart(12, "0")}`,
    displayName: i === 103 ? "Mara" : `Player ${i + 1}`,
    rank: i + 1,
    score: 19000 - i * 100,
    achievedAt: "2026-11-10T00:00:00Z",
  }));
  await page.route("**/leaderboards/vaccoin/me", (route) =>
    route.fulfill({ json: entries[103] }),
  );
  await page.route("**/leaderboards/vaccoin/entries?*", (route) => {
    const url = new URL(route.request().url());
    const start = url.searchParams.has("cursor") ? 100 : 0;
    const limit = Number(url.searchParams.get("limit"));
    return route.fulfill({
      json: {
        entries: entries.slice(start, start + limit),
        nextCursor: start + limit < 125 ? "page2" : null,
      },
    });
  });
  await page.reload();
  await enterCasino(page);
  await page.waitForFunction(() => window.vaccoinQA);
  await page.getByRole("button", { name: "LEADERBOARD", exact: true }).click();
  await page.getByRole("button", { name: "TOP 100", exact: true }).click();
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().leaderboardBrowser.entries.length === 100,
  );
  assert.equal(await page.locator("#leaderboard-top100").getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator("#leaderboard-top").getAttribute("aria-pressed"), "false");
  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 756, height: 308 }]) {
    await page.setViewportSize(viewport);
    const rows = page.locator("#rankings-menu .standings");
    await rows.evaluate(el => { el.scrollTop = 0; });
    await rows.focus();
    await page.keyboard.press("End");
    await page.waitForFunction(() => {
      const el = document.querySelector("#rankings-menu .standings");
      return el.scrollTop > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
    });
    assert.equal(await rows.locator("li").count(), 100);
    assert.equal(await rows.locator("li").last().locator(".standing-rank").textContent(), "100");
    assert.equal(await rows.evaluate(el => el.scrollWidth <= el.clientWidth), true);
    await page.screenshot({ path: `test-results/top100-${viewport.width}.png` });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("button", { name: "AROUND YOU", exact: true }).click();
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().leaderboardBrowser.entries.length === 11,
  );
  const board = (await page.evaluate(() => window.vaccoinQA.snapshot()))
    .leaderboardBrowser;
  assert.deepEqual(
    board.entries.map((e) => e.rank),
    [99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109],
  );
  assert.equal(board.entries[5].isPlayer, true);
  await page.screenshot({ path: "test-results/title-leaderboard.png" });
  await page.setViewportSize({ width: 540, height: 540 });
  await page.screenshot({ path: "test-results/title-leaderboard-narrow.png" });
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => !window.vaccoinQA.snapshot().leaderboardBrowser.open,
  );
  assert.equal(await page.locator("#play").isVisible(), true);
  await page.screenshot({ path: "test-results/title-redesign-narrow.png" });
  await page.route("**/leaderboards/vaccoin/entries?*", (route) =>
    route.fulfill({
      status: 503,
      json: { code: "UNAVAILABLE", message: "Try later" },
    }),
  );
  await page.getByRole("button", { name: "LEADERBOARD", exact: true }).click();
  await page
    .getByRole("button", { name: "RETRY RANKINGS", exact: true })
    .waitFor({ state: "visible" });
  await page.unroute("**/leaderboards/vaccoin/entries?*");
  await page
    .getByRole("button", { name: "RETRY RANKINGS", exact: true })
    .click();
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().leaderboardBrowser.entries.length === 10,
  );
  assert.equal(calls.submissions.length, 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: title leaderboard, public top ten, scrollable top 100 at desktop/portrait/landscape sizes, unranked state, nearby pagination, highlighted player, back and Escape (HTTP mocked)",
  );
} finally {
  await browser.close();
}
