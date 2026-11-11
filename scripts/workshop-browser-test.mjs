import { chromium } from "@playwright/test";
import { mockBackend } from "./mock-backend.mjs";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
try {
  for (const [label, width, height] of [
    ["desktop", 1280, 720],
    ["mobile", 540, 720],
    ["touch", 844, 390],
  ]) {
    const page = await browser.newPage({
        viewport: { width, height },
        ...(label === "touch" ? { hasTouch: true, isMobile: true } : {}),
      }),
      errors = [];
    page.setDefaultTimeout(20000);
    page.on("pageerror", (e) => errors.push(e.message));
    const calls = await mockBackend(page, { savedName: true });
    // Exercise the secure randomness fallback used on HTTP LAN origins.
    await page.addInitScript(() =>
      Object.defineProperty(crypto, "randomUUID", { value: undefined }),
    );
    await page.goto("http://127.0.0.1:5173/?qa");
    await page.waitForFunction(
      () => window.vaccoinQA?.snapshot().workshop.ready,
    );
    await page
      .getByRole("button", { name: "SHOP", exact: true })
      .click();
    await page.waitForFunction(() => window.vaccoinQA.snapshot().workshop.open);
    await page.screenshot({ path: `test-results/workshop-empty-${label}.png` });
    await page.getByRole("button", { name: "BACK", exact: true }).click();
    await page.getByRole("button", { name: "PLAY", exact: true }).click();
    if (label === "touch")
      console.log(
        "Touch play requested",
        await page.evaluate(() => ({
          state: window.vaccoinQA.snapshot().phase,
          error: document.querySelector("#status")?.textContent,
          size: [innerWidth, innerHeight],
        })),
      );
    await page.waitForFunction(
      () => window.vaccoinQA.snapshot().phase === "playing",
    );
    await page.evaluate(() => {
      window.vaccoinQA.workshopRun(12000);
    });
    await page.waitForFunction(
      () => window.vaccoinQA.snapshot().workshop.progress.wallet === 12000,
    );
    await page.waitForFunction(
      () => window.vaccoinQA.snapshot().workshop.status === "CLOUD SAVED",
    );
    assert.equal(calls.submissions.length, 1);
    await page
      .getByRole("button", { name: "SHOP", exact: true })
      .click();
    await page.getByRole("button", { name: ">", exact: true }).click();
    await page
      .getByRole("button", { name: "BUY + EQUIP", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        window.vaccoinQA.snapshot().workshop.progress.equipped === "brick-red",
    );
    await page.waitForFunction(
      () => window.vaccoinQA.snapshot().workshop.status === "CLOUD SAVED",
    );
    await page.screenshot({ path: `test-results/workshop-owned-${label}.png` });
    await page.getByRole("button", { name: "BACK", exact: true }).click();
    await page.reload();
    await page.waitForFunction(
      () =>
        window.vaccoinQA?.snapshot().workshop.progress.equipped === "brick-red",
    );
    assert.equal(
      (await page.evaluate(() => window.vaccoinQA.snapshot())).workshop.progress
        .wallet,
      9500,
    );
    calls.saveOffline = true;
    await page
      .getByRole("button", { name: "SHOP", exact: true })
      .click();
    await page.getByRole("button", { name: ">", exact: true }).click();
    await page
      .getByRole("button", { name: "BUY + EQUIP", exact: true })
      .click();
    await page.waitForFunction(
      () => window.vaccoinQA.snapshot().workshop.progress.equipped === "chrome",
    );
    await page.reload();
    await page.waitForFunction(
      () =>
        window.vaccoinQA?.snapshot().workshop.progress.equipped === "chrome",
    );
    assert.equal(
      (await page.evaluate(() => window.vaccoinQA.snapshot())).workshop.progress
        .wallet,
      3500,
    );
    calls.saveOffline = false;
    await page.evaluate(() => window.vaccoinQA.workshopSync());
    await page.waitForFunction(
      () => window.vaccoinQA.snapshot().workshop.status === "CLOUD SAVED",
    );
    await page.getByRole("button", { name: "PLAY", exact: true }).click();
    if (label === "touch")
      console.log(
        "Touch play requested",
        await page.evaluate(() => ({
          state: window.vaccoinQA.snapshot().phase,
          error: document.querySelector("#status")?.textContent,
          size: [innerWidth, innerHeight],
        })),
      );
    await page.waitForFunction(
      () => window.vaccoinQA.snapshot().phase === "playing",
    );
    assert.equal(
      (await page.evaluate(() => window.vaccoinQA.snapshot())).workshop
        .cosmetic,
      "chrome",
    );
    await page.screenshot({
      path: `test-results/workshop-equipped-${label}.png`,
    });
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(
    "PASS desktop/mobile Workshop, HTTP UUID fallback, run credit, purchase/equip, cloud restore, IndexedDB reload, offline purchase/reconnect, gameplay materials, leaderboard compatibility",
  );
} finally {
  await browser.close();
}
