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
  await mockBackend(page, { savedName: true });
  await page.goto("http://127.0.0.1:5173/?qa");
  await enterCasino(page);
  await page.evaluate(() => {
    document.documentElement.requestFullscreen = undefined;
  });
  await page.waitForFunction(
    () =>
      window.vaccoinQA?.snapshot().achievements.rows.length === 6 &&
      window.vaccoinQA.snapshot().live.entries.length === 10,
  );
  for (const viewport of [
    devices["Pixel 9 landscape"].viewport,
    devices["Pixel 9 landscape"].screen,
    { width: 924, height: 412 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    const ref = `${viewport.width}x${viewport.height}`;
    await fits(page, `lobby-${ref}`);
    await page.locator("#change-name").tap();
    await fits(page, `name-${ref}`);
    await page.locator("#cancel-name").tap();
    await page.locator("#leaderboard-open").tap();
    await page.waitForFunction(
      () =>
        window.vaccoinQA.snapshot().leaderboardBrowser.entries.length === 10,
    );
    await fits(page, `rankings-${ref}`);
    await page.locator("#leaderboard-back").tap();
    await page.locator("#achievements-open").tap();
    await fits(page, `achievements-${ref}`);
    await page.locator("#achievements-open").tap();
    await page.locator("#workshop-open").tap();
    await fits(page, `shop-${ref}`);
    await page.locator("#workshop-back").tap();
    await page.locator("#account-open").tap();
    await fits(page, `account-${ref}`);
    await page.locator("#account-deleteSave").tap();
    await fits(page, `delete-${ref}`);
    await page.locator("#account-decline").tap();
    await page.locator("#account-back").tap();
    await page.locator("#play").tap();
    await page.waitForFunction(
      () => window.vaccoinQA.snapshot().phase === "playing",
    );
    await page.evaluate(() => window.vaccoinQA.expire());
    await page.locator("#main-menu").waitFor({ state: "visible" });
    await page.waitForFunction(
      () => window.vaccoinQA.snapshot().entries.length === 10,
    );
    await fits(page, `results-${ref}`);
    await page.locator("#main-menu").tap();
  }
  const rain = page.locator("#menu-coins");
  await rain.waitFor({ state: "visible" });
  const before = await rain.evaluate((c) => c.toDataURL());
  await page.waitForTimeout(150);
  assert.notEqual(
    await rain.evaluate((c) => c.toDataURL()),
    before,
    "menu coin rain animates",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(100);
  const still = await rain.evaluate((c) => c.toDataURL());
  await page.waitForTimeout(150);
  assert.equal(
    await rain.evaluate((c) => c.toDataURL()),
    still,
    "reduced motion holds coins still",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS Pixel 9 landscape: no scrolling, controls visible, name editor, rankings, achievements, shop, account, deletion and coin rain",
  );
} finally {
  await browser.close();
}
