import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mockBackend } from "./mock-backend.mjs";
const origin = process.env.DELETE_TEST_ORIGIN ?? "http://127.0.0.1:5174";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-gpu"],
});
const slots = new Map(),
  receipts = new Map();
const slot = "vacuum-workshop";
const data = {
  schemaVersion: 1,
  wallet: 100,
  totalCoinsEarned: 100,
  completedRuns: 1,
  owned: ["default"],
  equipped: "default",
  preferences: { muted: false },
  applied: { old: "run" },
};
slots.set(slot, {
  slot,
  revision: 1,
  schemaVersion: 1,
  kind: "json",
  data,
  metadata: {},
  sizeBytes: 1,
  deleted: false,
  objectPath: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
let offlineB = false;
try {
  const pages = [];
  for (const width of [1280, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: width === 390 ? 844 : 720 },
    });
    page.on("pageerror", e => console.error("PAGE ERROR", e.message));
    pages.push(page);
    await mockBackend(page, { savedName: true });
    await page.route("**/functions/v1/supagame/v1/**", async (route) => {
      if (!route.request().url().includes("/saves")) return route.fallback();
      if (width === 390 && offlineB) return route.abort("internetdisconnected");
      const reply = (value, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(value),
        });
      const key = new URL(route.request().url()).pathname.split("/").at(-1);
      const old = slots.get(key);
      if (key === "saves")
        return reply({ slots: [...slots.values()].filter((s) => !s.deleted) });
      if (route.request().method() === "GET")
        return old && !old.deleted
          ? reply({ save: old })
          : reply({ code: "SAVE_NOT_FOUND", message: "Missing" }, 404);
      const body = route.request().postDataJSON();
      if (receipts.has(body.operationId))
        return reply({ save: receipts.get(body.operationId) });
      if (body.expectedRevision !== (old?.revision ?? 0))
        return reply(
          { code: "SAVE_CONFLICT", message: "Changed", current: old ?? null },
          409,
        );
      if (body.action === "delete" && (!old || old.deleted))
        return reply({ code: "SAVE_NOT_FOUND", message: "Missing" }, 404);
      const next = {
        slot: key,
        revision: (old?.revision ?? 0) + 1,
        schemaVersion: 1,
        kind: "json",
        data: body.data ?? null,
        metadata: body.metadata ?? {},
        sizeBytes: 1,
        deleted: body.action === "delete",
        objectPath: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      slots.set(key, next);
      receipts.set(body.operationId, next);
      return reply({ save: next });
    });
    await page.route(`${origin}/delete-harness`, route => route.fulfill({contentType:'text/html', body:`<html><head><link rel="stylesheet" href="/src/style.css"></head><body class="casino-entered"><canvas width="960" height="540" style="width:100vw;height:100vh"></canvas><script type="module">
      import { configuredGameConnection } from '/src/game-services.ts';
      import { Workshop } from '/src/workshop.ts';
      import { Accounts } from '/src/accounts.ts';
      import { AccountUI } from '/src/account-ui.ts';
      import { MenuSurface } from '/src/menu-surface.ts';
      import { createIndexedDbStore } from '/node_modules/.vite/deps/@supagame_sdk-ts_browser.js';
      const connection = configuredGameConnection();
      await connection.game.players.ensureAnonymousSession();
      const workshop = new Workshop({saves:connection.game.saves, store:createIndexedDbStore('delete-browser'), namespace:'test',identity:async()=>(await connection.supabase.auth.getSession()).data.session?.user.id??null});
      await workshop.initialize();
      const account = new Accounts(connection.game, workshop, 'test');
      await account.refresh();
      const ui = new AccountUI({ctx:document.querySelector('canvas').getContext('2d'),w:960},account,()=>{});
      const opener = new MenuSurface('delete-test-lobby');
      function draw(){
        if (account.open) opener.hide();
        else { opener.begin(); opener.button('account', document.querySelector('#account-open'), 'ACCOUNT'); opener.end(); }
        ui.draw(true); requestAnimationFrame(draw);
      } draw();
      window.vaccoinQA = {snapshot:()=>({workshop:{progress:workshop.progress,status:workshop.status,ready:workshop.ready}}),workshopSync:()=>workshop.sync()};
    </script></body></html>`}));
    await page.goto(`${origin}/delete-harness`);

    await page.waitForFunction(
      () => window.vaccoinQA?.snapshot().workshop.progress.wallet === 100,
    );
  }
  const [a, b] = pages;
  offlineB = true;
  await a.locator("#account-open").click();
  await a.locator("#account-deleteSave").click();
  await expect(a.locator("#account-confirm")).toHaveText("DELETE CLOUD SAVE");
  await a.locator("#account-decline").click();
  assert.equal(slots.get(slot).deleted, false);
  await a.locator("#account-deleteSave").click();
  await expect(a.locator("#account-confirm")).toHaveAttribute("aria-describedby", "account-delete-description");
  await expect(a.locator("#account-delete-description")).toContainText("not permanent erasure");
  await a.locator("#account-confirm").click();
  await expect(a.locator("#account-startFresh")).toBeVisible();
  await a.waitForFunction(() =>
    window.vaccoinQA.snapshot().workshop.status.includes("CLOUD SAVE DELETED"),
  );
  assert.equal(slots.get(slot).deleted, true);
  await a.reload();
  await a.waitForFunction(
    () => window.vaccoinQA?.snapshot().workshop.ready === false,
  );
  offlineB = false;
  await b.evaluate(() => window.vaccoinQA.workshopSync());
  assert.equal(
    await b.evaluate(
      () => window.vaccoinQA.snapshot().workshop.progress.wallet,
    ),
    0,
  );
  await b.locator("#account-open").click();
  await expect(b.locator("#account-startFresh")).toBeVisible();
  await b.locator("#account-deleteSave").click();
  await b.screenshot({ path: "/tmp/vaccoin-cloud-delete-mobile.png" });
  await b.locator("#account-decline").click();
  await b.locator("#account-startFresh").click();
  await b.waitForFunction(() => window.vaccoinQA.snapshot().workshop.ready);
  assert.equal(
    slots.get(slot).deleted,
    true,
    "start fresh alone does not autosave",
  );
  console.log(
    "PASS: confirmation/cancel, delete/reload, second authenticated context reconnect, mobile UI, explicit start fresh",
  );
} finally {
  await browser.close();
}
