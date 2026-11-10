import { mockBackend } from "./mock-backend.mjs";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-gpu"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
await mockBackend(page, { offline: true, savedName: true });
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.addInitScript(() => {
    // Exercise old non-Promise acquisition and a browser denying persistent storage.
    const original = HTMLElement.prototype.requestPointerLock;
    HTMLElement.prototype.requestPointerLock = function () {
      original.call(this);
    };
    Object.defineProperty(window, "localStorage", {
      get() {
        throw Error("Storage denied");
      },
    });
    const RealAudio = window.AudioContext;
    window.AudioContext = class extends RealAudio {
      constructor(...args) {
        super(...args);
        window.qaAudio = this;
      }
      createGain() {
        const gain = super.createGain();
        if (!window.qaMaster) window.qaMaster = gain;
        return gain;
      }
    };
  });
  await page.goto("http://127.0.0.1:5173/?qa");
  await page.waitForFunction(() => window.vaccoinQA);
  await page.getByRole("textbox", { name: "DISPLAY NAME" }).fill("Mara");
  await page.locator("#display-name").evaluate((input) => input.blur());
  await page.keyboard.press("m");
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await page.waitForFunction(
    () => window.vaccoinQA.snapshot().phase === "playing",
  );
  assert.equal(await page.evaluate(() => window.qaMaster.gain.value), 0);
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent("mousedown", { button: 0 })),
  );
  await page.waitForTimeout(1200);
  assert((await page.evaluate(() => window.vaccoinQA.snapshot())).score > 0);
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForTimeout(1300);
  await page.keyboard.press("r");
  await page.waitForFunction(() => window.vaccoinQA.snapshot().locked);
  const restarted = await page.evaluate(() => window.vaccoinQA.snapshot());
  assert.equal(restarted.score, 0);
  assert(restarted.remaining > 59);
  await page.evaluate(() => window.vaccoinQA.expire());
  await page.waitForTimeout(100);
  await page.screenshot({ path: "test-results/storage-unavailable.png" });
  assert.equal(
    (await page.evaluate(() => window.vaccoinQA.snapshot())).phase,
    "results",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: void pointer-lock API, mute-before-activation, storage denial, R while unlocked",
  );
} finally {
  await browser.close();
}
