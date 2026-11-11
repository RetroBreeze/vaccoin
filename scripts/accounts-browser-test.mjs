import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mockBackend } from "./mock-backend.mjs";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-gpu"],
});
try {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({
      viewport,
      isMobile: viewport.width < 500,
      hasTouch: viewport.width < 500,
    });
    const errors = [];
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.error(e.message);
    });
    await mockBackend(page, { savedName: true });
    await page.goto(
      `${process.env.ACCOUNTS_TEST_ORIGIN ?? "http://127.0.0.1:5173"}/?qa`,
    );
    await page.waitForFunction(() => !!window.vaccoinQA);
    await page.getByRole("button", { name: "ACCOUNT", exact: true }).click();
    await page
      .getByRole("button", { name: "LINK GOOGLE", exact: true })
      .waitFor({ state: "visible" });
    assert(
      await page
        .getByRole("button", { name: "SIGN IN WITH GOOGLE", exact: true })
        .isVisible(),
    );
    assert.equal(
      await page.locator("#rotate-device").isVisible(),
      false,
      "Account controls must be readable in portrait",
    );
    await page.screenshot({
      path: `test-results/accounts-${viewport.width}.png`,
    });
    await page
      .getByRole("button", { name: "RETURN TO GUEST GAME", exact: true })
      .click();
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("PASS desktop/mobile guest account controls; backend mocked");
} finally {
  await browser.close();
}
