import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mockBackend } from "./mock-backend.mjs";
const origin = process.env.ACCOUNTS_TEST_ORIGIN ?? "http://127.0.0.1:5173";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-gpu"],
});
const guestId = "11111111-1111-4111-8111-111111111111",
  targetId = "22222222-2222-4222-8222-222222222222";
const progress = (wallet, owned = ["default"], equipped = "default") => ({
  schemaVersion: 1,
  totalCoinsEarned: wallet,
  wallet,
  completedRuns: 1,
  owned,
  equipped,
  preferences: { muted: false },
  applied: {},
});
const record = (data, revision = 1) => ({
  slot: "vacuum-workshop",
  revision,
  schemaVersion: 1,
  kind: "json",
  metadata: {},
  sizeBytes: JSON.stringify(data).length,
  deleted: false,
  objectPath: null,
  createdAt: "2026-11-10T00:00:00Z",
  updatedAt: "2026-11-10T00:00:00Z",
  data,
});
try {
  for (const [strategy, width] of [
    ["cloud", 1280],
    ["guest", 390],
    ["merge", 1280],
    ["link", 390],
  ]) {
    const page = await browser.newPage({
        viewport: { width, height: width === 390 ? 844 : 720 },
        isMobile: width === 390, hasTouch: width === 390,
      }),
      errors = [];
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.log("PAGE ERROR", e.message);
    });
    await mockBackend(page, { savedName: true });
    let active = guestId,
      mode = "signIn",
      linked = false;
    const saves = new Map([
        [guestId, record(progress(75, ["default", "chrome"], "chrome"))],
        [
          targetId,
          record(progress(200, ["default", "brick-red"], "brick-red"), 4),
        ],
      ]),
      receipts = new Map();
    const user = () => ({
      id: active,
      aud: "authenticated",
      role: "authenticated",
      is_anonymous: !linked,
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-11-10T00:00:00Z",
      identities: linked
        ? [
            {
              id: "google",
              identity_id: "google",
              user_id: active,
              provider: "google",
              created_at: "",
              updated_at: "",
            },
          ]
        : [],
    });
    const jwt = () =>
      `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: active, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.mock`;
    const reply = (route, value, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(value),
      });
    const redirect = async (route, url) => {
      const callback = new URL(url);
      callback.searchParams.set("code", "mock-once");
      await route.fulfill({
        status: 302,
        headers: { location: callback.href },
        body: "",
      });
    };
    await page.route("https://oauth.mock/**", async (route) =>
      redirect(
        route,
        new URL(route.request().url()).searchParams.get("redirect_to"),
      ),
    );
    await page.route("**/auth/v1/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/user/identities/authorize")) {
        mode = "link";
        return reply(route, {
          url: `https://oauth.mock/?redirect_to=${encodeURIComponent(url.searchParams.get("redirect_to"))}`,
        });
      }
      if (url.pathname.endsWith("/authorize")) {
        mode = "signIn";
        return redirect(route, url.searchParams.get("redirect_to"));
      }
      if (
        url.pathname.endsWith("/token") &&
        url.searchParams.get("grant_type") === "pkce"
      ) {
        linked = true;
        if (mode === "signIn") active = targetId;
        return reply(route, {
          access_token: jwt(),
          refresh_token: "mock-refresh",
          token_type: "bearer",
          expires_in: 3600,
          user: user(),
        });
      }
      if (url.pathname.endsWith("/user")) return reply(route, user());
      return route.fallback();
    });
    await page.route("**/functions/v1/supagame/v1/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/players/me"))
        return reply(route, {
          playerId: active,
          displayName: active === targetId ? "Google Player" : "Mara",
          createdAt: "2026-11-10T00:00:00Z",
        });
      if (!url.pathname.includes("/saves")) return route.fallback();
      const current = saves.get(active);
      if (url.pathname.endsWith("/saves"))
        return reply(route, { slots: [current] });
      if (route.request().method() === "GET")
        return reply(route, { save: current });
      const body = route.request().postDataJSON();
      if (receipts.has(body.operationId))
        return reply(route, { save: receipts.get(body.operationId) });
      if (body.expectedRevision !== current.revision)
        return reply(
          route,
          { code: "SAVE_CONFLICT", message: "Changed", current },
          409,
        );
      const next = record(body.data, current.revision + 1);
      saves.set(active, next);
      receipts.set(body.operationId, next);
      return reply(route, { save: next });
    });
    console.log("OPEN", strategy);
    await page.goto(`${origin}/?qa`);
    await page.waitForFunction(
      () => window.vaccoinQA?.snapshot().workshop.status === "CLOUD SAVED",
    );
    console.log("READY", strategy);
    await page.getByRole("button", { name: "ACCOUNT", exact: true }).click();
    await page
      .getByRole("button", {
        name: strategy === "link" ? "LINK GOOGLE" : "SIGN IN WITH GOOGLE",
        exact: true,
      })
      .click();
    console.log("AUTH STARTED", strategy);
    // Full navigation recreates the SDK and restores the durable snapshot.
    if (strategy === "link") {
      await page.waitForURL((url) => !url.searchParams.has("code"));
      await page
        .getByRole("button", { name: "ACCOUNT", exact: true })
        .waitFor({ state: "visible" });
      await page.getByRole("button", { name: "ACCOUNT", exact: true }).click();
      await page
        .getByRole("button", { name: "SIGN OUT", exact: true })
        .waitFor({ state: "visible" });
      assert.equal(active, guestId);
      assert.equal(saves.get(guestId).data.wallet, 75);
    } else {
      await page
        .getByRole("button", { name: "KEEP GOOGLE PROGRESS", exact: true })
        .waitFor({ state: "visible" });
      await page.screenshot({
        path: `test-results/accounts-conflict-${strategy}.png`,
      });
      await page
        .getByRole("button", {
          name:
            strategy === "cloud"
              ? "KEEP GOOGLE PROGRESS"
              : strategy === "guest"
                ? "KEEP GUEST PROGRESS"
                : "MERGE PROGRESS",
          exact: true,
        })
        .click();
      if (strategy !== "cloud")
        await page
          .getByRole("button", { name: "CONFIRM", exact: true })
          .click();
      await page
        .getByRole("button", { name: "ACCOUNT", exact: true })
        .waitFor({ state: "visible" });
      assert.equal(active, targetId);
      assert.equal(
        saves.get(targetId).data.wallet,
        strategy === "guest" ? 75 : 200,
      );
      assert.equal(saves.get(guestId).data.wallet, 75);
      if (strategy === "merge")
        assert.deepEqual(saves.get(targetId).data.owned, [
          "default",
          "brick-red",
          "chrome",
        ]);
      if (strategy === "cloud") assert.equal(saves.get(targetId).revision, 4);
    }
    assert.deepEqual(errors, []);
    console.log(
      `PASS mocked OAuth ${strategy}, ${width}px, redirect persistence and isolated saves`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
