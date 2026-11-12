import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mockBackend, enterCasino } from "./mock-backend.mjs";

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-gpu"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 0.5,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await mockBackend(page, { savedName: true });
  await page.goto("http://127.0.0.1:5173/?qa");
  await enterCasino(page);
  await page.waitForFunction(() => window.vaccoinQA);
  await page.clock.fastForward(20);
  await page.locator("#play").click();
  await page.clock.fastForward(3200);
  const snapshot = () => page.evaluate(() => window.vaccoinQA.snapshot());
  const advance = async (frames) => {
    for (let i = 0; i < frames; i++) await page.clock.fastForward(100);
  };
  assert.equal((await snapshot()).controlsActive, true);
  const initial = await snapshot();
  await page.evaluate(() => window.vaccoinQA.teleport(4, 0, 7, 0, -0.62));
  await page.clock.fastForward(20);
  await page.screenshot({
    path: "test-results/furniture-intact.png",
    scale: "css",
  });
  // Dispatch the held button without Playwright moving the captured cursor.
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent("mousedown", { button: 0 })),
  );
  await advance(5);
  assert.equal(
    (await snapshot()).destroyed,
    0,
    "suction takes sustained contact",
  );
  await page.screenshot({
    path: "test-results/furniture-straining.png",
    scale: "css",
  });
  await advance(7);
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent("mouseup", { button: 0 })),
  );
  const vacuumed = await snapshot();
  assert.equal(
    vacuumed.destroyed,
    2,
    "coffee table and its lamp break together",
  );
  assert.equal(
    vacuumed.coins - initial.coins,
    6,
    "table and lamp release six ordinary coins",
  );
  await page.screenshot({
    path: "test-results/furniture-broken.png",
    scale: "css",
  });
  console.log("PASS: vacuum breaks rendered table and lamp with small payout");

  const chairId = await page.evaluate(
    () =>
      window.vaccoinQA
        .furniture()
        .find(
          (o) => o.key === "chair" && o.x === 5 && o.y === -5 && o.z === 6.4,
        ).id,
  );
  const chair = () =>
    page.evaluate((id) => window.vaccoinQA.furniture()[id], chairId);
  await page.evaluate(() => window.vaccoinQA.teleport(5, -5, 7.4));
  await page.keyboard.down("w");
  await advance(3);
  await page.keyboard.up("w");
  const running = await snapshot();
  assert.equal(running.destroyed, 2, "running does not destroy props");
  assert.equal(running.coins, vacuumed.coins, "pushing does not pay coins");
  assert(
    running.velocity[2] < -10,
    "player keeps running speed through furniture",
  );
  assert(
    running.position[2] < 6.4,
    "player runs through the original chair position",
  );
  const tumbling = await chair();
  assert(tumbling.tossed && tumbling.moving && !tumbling.broken);
  assert(Math.abs(tumbling.rx) + Math.abs(tumbling.rz) > 0.1);
  await page.evaluate(() => window.vaccoinQA.teleport(5, -5, 9, 0, -0.25));
  await page.clock.fastForward(20);
  await page.screenshot({
    path: "test-results/furniture-tumbling.png",
    scale: "css",
  });
  await advance(40);
  const landed = await chair();
  assert.equal(landed.moving, false, "tumbling chair settles");
  assert.equal(landed.broken, false);
  await page.evaluate(
    (o) =>
      window.vaccoinQA.teleport(
        o.x,
        -5,
        o.z + 2,
        0,
        Math.atan2(o.y + 0.51 + 5 - 1.7, 2),
      ),
    landed,
  );
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent("mousedown", { button: 0 })),
  );
  await advance(12);
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent("mouseup", { button: 0 })),
  );
  assert.equal(
    (await chair()).broken,
    true,
    "vacuum destroys the chair at its new location",
  );
  console.log(
    "PASS: running tumbles furniture without losing speed or awarding coins; vacuum destroys it after landing",
  );

  await page.keyboard.press("r");
  await page.clock.fastForward(3200);
  assert.equal((await snapshot()).destroyed, 0);
  assert.equal((await snapshot()).coins, initial.coins);
  const restored = await chair();
  assert.equal(restored.tossed, false);
  assert.equal(restored.broken, false);
  assert.deepEqual(
    [restored.x, restored.y, restored.z, restored.rx, restored.rz],
    [5, -5, 6.4, 0, 0],
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: restart restores all furniture transforms; no browser errors",
  );
} finally {
  await browser.close();
}
