import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mockBackend } from "./mock-backend.mjs";

const origin = process.argv[2] || "http://localhost:5173";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-gpu"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  const calls = await mockBackend(page, { appOrigin: origin, savedName: true });
  let remoteName = "Mara";
  let rejectSave = false;
  await page.route("**/players/me", async (route) => {
    if (route.request().method() === "PATCH") {
      if (rejectSave)
        return route.fulfill({ status: 503, json: { message: "Offline" } });
      remoteName = route.request().postDataJSON().displayName;
    }
    return route.fallback();
  });
  await page.route("**/leaderboards/vaccoin/entries?*", (route) =>
    route.fulfill({
      json: {
        entries: [
          {
            playerId: "11111111-1111-4111-8111-111111111111",
            displayName: remoteName,
            rank: 1,
            score: 100,
            achievedAt: "2026-11-10T00:00:00Z",
          },
        ],
        nextCursor: null,
      },
    }),
  );
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/?qa`);
  await page.waitForFunction(
    () => window.vaccoinQA?.snapshot().live.status === "CONNECTED",
  );
  await expect(page.locator("#current-player-name")).toHaveText("Mara");
  await page.getByRole("button", { name: "Change name", exact: true }).click();
  await page.locator("#display-name").fill("x");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  assert.equal(
    await page.locator("#display-name").evaluate((el) => el.checkValidity()),
    false,
  );
  await page.locator("#display-name").fill("Nova");
  await page.locator("#display-name").press("Enter");
  await expect(page.locator("#current-player-name")).toHaveText("Nova");
  await expect(page.locator("#saved-player-name")).toBeVisible();
  assert.equal(remoteName, "Nova");
  assert.equal(
    await page.evaluate(() => localStorage.getItem("vaccoin.display-name.v1")),
    "Nova",
  );
  assert.equal(
    (await page.evaluate(() => window.vaccoinQA.snapshot())).phase,
    "title",
  );
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().live.entries[0]?.name === "Nova",
  );
  remoteName = "REMOTE";
  calls.broadcast();
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().live.entries[0]?.name === "REMOTE",
  );
  await page.setViewportSize({ width: 540, height: 540 });
  await page.getByRole("button", { name: "Change name", exact: true }).click();
  const actions = await page.locator("#name-actions").boundingBox();
  const play = await page.locator("#play").boundingBox();
  await page.screenshot({ path: "test-results/name-editor-narrow.png" });
  assert.ok(
    actions.y + actions.height <= play.y,
    "name actions do not overlap play",
  );
  await page.locator("#display-name").fill("Ignored");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("#current-player-name")).toHaveText("Nova");
  rejectSave = true;
  await page.getByRole("button", { name: "Change name", exact: true }).click();
  await page.locator("#display-name").fill("Failed");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator("#name-help")).toHaveText(
    "Couldn't save. Try again.",
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("vaccoin.display-name.v1")),
    "Nova",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "LEADERBOARD", exact: true }).click();
  await expect(page.locator("#saved-player-name")).toBeHidden();
  assert.equal(calls.submissions.length, 0);
  assert.deepEqual(errors, []);
  const touchPage = await browser.newPage({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  });
  await mockBackend(touchPage, { appOrigin: origin, savedName: true });
  await touchPage.goto(`${origin}/?qa`);
  await touchPage
    .getByRole("button", { name: "Change name", exact: true })
    .click();
  await touchPage.waitForTimeout(100);
  const touchActions = await touchPage.locator("#name-actions").boundingBox();
  const touchPlay = await touchPage.locator("#play").boundingBox();
  assert.ok(
    touchActions.y + touchActions.height <= touchPlay.y,
    "touch landscape name actions do not overlap play",
  );
  console.log(
    "PASS: saved name, rename, validation, Enter, Cancel, failure recovery, narrow layout and realtime refresh (mocked)",
  );
} finally {
  await browser.close();
}
