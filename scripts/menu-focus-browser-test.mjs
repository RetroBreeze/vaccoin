import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const origin = process.env.CASINO_TEST_ORIGIN ?? "http://127.0.0.1:5173";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Exercise native focus and the real menu renderer without the WebGL scene.
  await page.route("**/qa-menu-focus", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<body class="casino-entered"></body>',
    }),
  );
  await page.goto(`${origin}/qa-menu-focus`);
  const focus = await page.evaluate(async () => {
    for (const id of ["player-name", "saved-player-name"]) {
      const element = document.createElement("div");
      element.id = id;
      document.body.append(element);
    }
    for (const id of [
      "play",
      "leaderboard-open",
      "achievements-open",
      "workshop-open",
      "account-open",
      "sound",
    ]) {
      const button = document.createElement("button");
      button.id = id;
      document.body.append(button);
    }
    const { MenuUI } = await import("/src/menu-ui.ts");
    const menus = new MenuUI();
    const state = {
      phase: "title",
      achievementsOpen: true,
      achievementStatus: "LOADING ACHIEVEMENTS",
      achievements: [
        {
          id: "test",
          title: "Collector",
          description: "Collect coins.",
          unlocked: false,
        },
      ],
    };
    menus.draw(state);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const focused = () => document.activeElement.id;
    const initial = focused();
    state.achievementStatus = "SINGLE RUN / PERMANENT UNLOCKS";
    menus.draw(state);
    const afterLoaded = focused();
    const statusHidden = document.querySelector(".achievement-status").hidden;
    state.achievementStatus = "LOADING ACHIEVEMENTS";
    menus.draw(state);
    const afterRefresh = focused();
    menus.draw(state);
    return {
      initial,
      afterLoaded,
      afterRefresh,
      afterUnchanged: focused(),
      statusHidden,
    };
  });
  assert.equal(
    focus.initial,
    "achievements-open",
    "opening achievements focuses Back",
  );
  assert.equal(
    focus.statusHidden,
    true,
    "loading status disappears when data arrives",
  );
  assert.equal(
    focus.afterLoaded,
    "achievements-open",
    "removing loading status preserves Back focus",
  );
  assert.equal(
    focus.afterRefresh,
    "achievements-open",
    "restoring loading status preserves Back focus",
  );
  assert.equal(
    focus.afterUnchanged,
    "achievements-open",
    "unchanged menu frames preserve Back focus",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: achievement status updates preserve native Back button focus",
  );
} finally {
  await browser.close();
}
