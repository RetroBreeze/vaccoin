import { chromium, devices } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { mockBackend, enterCasino } from "./mock-backend.mjs";
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [];
async function tap(page, selector) {
  await page.locator(selector).tap();
  await page.clock.fastForward(20);
}
async function fits(page, label) {
  const view = label.split("-")[0];
  const id = {
    lobby: "lobby",
    name: "lobby",
    rankings: "rankings-menu",
    achievements: "achievements-menu",
    shop: "shop-menu",
    account: "account-menu",
    delete: "account-menu",
    results: "results-menu",
  }[view];
  await page.locator(`#${id}`).waitFor({ state: "visible" });
  const geometry = await page.evaluate(() => {
    const screen = [...document.querySelectorAll(".menu-screen")].find(
      (e) => !e.hidden,
    );
    const controls = [...screen.querySelectorAll("button, input")]
      .map((e) => {
        const r = e.getBoundingClientRect();
        return { id: e.id, x: r.x, y: r.y, width: r.width, height: r.height };
      })
      .filter((r) => r.width && r.height);
    return {
      width: innerWidth,
      height: innerHeight,
      scrollHeight: screen.scrollHeight,
      clientHeight: screen.clientHeight,
      scrollWidth: screen.scrollWidth,
      clientWidth: screen.clientWidth,
      controls,
    };
  });
  assert(
    geometry.scrollHeight <= geometry.clientHeight + 1,
    `${label}: vertical overflow ${geometry.scrollHeight}/${geometry.clientHeight}`,
  );
  assert(
    geometry.scrollWidth <= geometry.clientWidth + 1,
    `${label}: horizontal overflow`,
  );
  for (const c of geometry.controls) {
    assert(
      c.x >= -1 &&
        c.y >= -1 &&
        c.x + c.width <= geometry.width + 1 &&
        c.y + c.height <= geometry.height + 1,
      `${label}: ${c.id} on screen ${JSON.stringify(c)}`,
    );
    assert(c.width >= 44 && c.height >= 44, `${label}: ${c.id} touch target`);
  }
  for (let i = 0; i < geometry.controls.length; i++) {
    for (const b of geometry.controls.slice(i + 1)) {
      const a = geometry.controls[i];
      const overlap =
        Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 &&
        Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1;
      assert(!overlap, `${label}: ${a.id} overlaps ${b.id}`);
    }
  }
  await page.screenshot({ path: `test-results/landscape-${label}.png` });
}
try {
  const page = await browser.newPage({
    ...devices["Pixel 9 landscape"],
    deviceScaleFactor: 1,
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await mockBackend(page, { savedName: true });
  await page.goto("http://127.0.0.1:5173/?qa");
  await enterCasino(page);
  await page.waitForFunction(() => window.vaccoinQA);
  await page.clock.fastForward(20);
  await page.evaluate(() => {
    document.documentElement.requestFullscreen = undefined;
  });
  // Allow SDK subscription/retry timers to progress while rendering one frame per step.
  for (let attempt = 0; attempt < 20; attempt++) {
    if (
      await page.evaluate(
        () => window.vaccoinQA.snapshot().live.entries.length === 10,
      )
    )
      break;
    await page.clock.fastForward(250);
    await page.waitForTimeout(50);
  }
  assert.equal(
    await page.evaluate(() => window.vaccoinQA.snapshot().live.entries.length),
    10,
    "mock live top ten loaded",
  );
  for (const viewport of [
    devices["Pixel 9 landscape"].viewport,
    devices["Pixel 9 landscape"].screen,
    { width: 924, height: 412 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.clock.fastForward(20);
    const ref = `${viewport.width}x${viewport.height}`;
    await fits(page, `lobby-${ref}`);
    await tap(page, "#change-name");
    await fits(page, `name-${ref}`);
    await tap(page, "#cancel-name");
    await tap(page, "#leaderboard-open");
    await page.waitForFunction(
      () =>
        window.vaccoinQA.snapshot().leaderboardBrowser.entries.length === 10,
    );
    await fits(page, `rankings-${ref}`);
    await tap(page, "#leaderboard-back");
    await tap(page, "#achievements-open");
    await fits(page, `achievements-${ref}`);
    await tap(page, "#achievements-open");
    await tap(page, "#workshop-open");
    await fits(page, `shop-${ref}`);
    assert.equal(await page.locator("#shop-menu #sound").count(), 0);
    assert.equal(await page.locator("#workshop-sync").count(), 0);
    await tap(page, "#workshop-back");
    await tap(page, "#account-open");
    await fits(page, `account-${ref}`);
    await tap(page, "#account-deleteSave");
    await fits(page, `delete-${ref}`);
    await tap(page, "#account-decline");
    await tap(page, "#account-back");
    await tap(page, "#play");
    await page.waitForFunction(
      () => window.vaccoinQA.snapshot().phase === "playing",
    );
    await page.evaluate(() => window.vaccoinQA.expire());
    await page.clock.fastForward(20);
    await page.locator("#main-menu").waitFor({ state: "visible" });
    await page.waitForFunction(
      () => window.vaccoinQA.snapshot().entries.length === 10,
    );
    await fits(page, `results-${ref}`);
    await tap(page, "#main-menu");
  }
  assert.equal(
    await page.locator("#menu-coins").count(),
    0,
    "falling coins removed",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS Pixel 9 landscape: no scrolling, controls visible, name editor, rankings, achievements, shop, account, deletion and no falling coins",
  );
} finally {
  await browser.close();
}
