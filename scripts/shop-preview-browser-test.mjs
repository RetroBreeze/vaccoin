import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
await mkdir("test-results/shop", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let loads = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("vaccoin-vacuum.glb")) loads++;
  });
  await page.route("**/shop-qa", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: '<!doctype html><head><link rel="stylesheet" href="/src/style.css"></head><body class="casino-entered" style="margin:0"><canvas id="ui"></canvas></body>',
    }),
  );
  await page.goto("http://127.0.0.1:5173/shop-qa");
  await page.evaluate(async () => {
    const { Workshop } = await import("/src/workshop.ts");
    const { WorkshopUI } = await import("/src/workshop-ui.ts");
    const { Vacuum } = await import("/src/vacuum.ts");
    const { PerspectiveCamera } =
      await import("/node_modules/three/build/three.module.js");
    const records = new Map();
    const store = {
      async read(k) {
        return structuredClone(records.get(k) ?? null);
      },
      async update(k, fn) {
        const n = fn(structuredClone(records.get(k) ?? null));
        records.set(k, n);
        return n;
      },
    };
    const options = { namespace: "shop-qa", store, identity: async () => null };
    const shop = new Workshop(options);
    await shop.initialize();
    await shop.complete({ id: "qa-run", score: 100000 });
    const canvas = document.querySelector("#ui");
    canvas.width = 960;
    canvas.height = 540;
    canvas.style.cssText = "width:100vw;height:100vh;image-rendering:pixelated";
    const style = document.createElement("style");
    style.textContent =
      ".leaderboard-control{position:fixed;opacity:0;cursor:pointer}";
    document.head.append(style);
    const ui = { ctx: canvas.getContext("2d"), w: 960 };
    ui.ctx.imageSmoothingEnabled = false;
    const panel = new WorkshopUI(ui, shop, () => {});
    const held = new Vacuum(new PerspectiveCamera());
    await held.load();
    const draw = () => {
      ui.ctx.clearRect(0, 0, ui.w, 540);
      panel.draw(true);
      requestAnimationFrame(draw);
    };
    panel.setOpen(true);
    draw();
    window.shopQA = { shop, panel, held, ui, canvas, options, Workshop };
  });
  await page.waitForFunction(
    () => window.shopQA.panel.preview.state === "ready",
  );
  const palettes = ["default", "brick-red", "chrome", "hazard", "neon", "gold"];
  const colours = [];
  for (let i = 0; i < palettes.length; i++) {
    if (i) await page.getByRole("button", { name: ">", exact: true }).click();
    await page.waitForFunction(
      (id) => window.shopQA.panel.preview.colour === id,
      palettes[i],
    );
    colours.push(
      await page.evaluate(() =>
        window.shopQA.panel.preview.materials.get("body").color.getHex(),
      ),
    );
    assert.equal(
      await page.evaluate(() => window.shopQA.held.cosmetic),
      "default",
    );
    await page.screenshot({ path: `test-results/shop/${palettes[i]}.png` });
  }
  assert.equal(new Set(colours).size, 6);
  assert.equal(loads, 1);
  await page.getByRole("button", { name: "BUY + EQUIP", exact: true }).click();
  await page.waitForFunction(
    () => window.shopQA.shop.progress.equipped === "gold",
  );
  assert.equal(
    await page.evaluate(() => window.shopQA.shop.progress.wallet),
    65000,
  );
  await page.evaluate(async () => {
    const q = window.shopQA;
    const restored = new q.Workshop(q.options);
    await restored.initialize();
    if (restored.progress.equipped !== "gold")
      throw Error("Colour not persisted");
    q.held.equip(restored.progress.equipped);
  });
  await page.getByRole("button", { name: ">", exact: true }).click();
  await page.getByRole("button", { name: "EQUIP COLOUR", exact: true }).click();
  await page.waitForFunction(
    () => window.shopQA.shop.progress.equipped === "default",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    const q = window.shopQA;
    q.ui.w = 540;
    q.canvas.width = 540;
    q.ui.ctx.imageSmoothingEnabled = false;
  });
  await page.screenshot({ path: "test-results/shop/mobile.png" });
  await page.getByRole("button", { name: "BACK", exact: true }).click();
  const stopped = await page.evaluate(
    () => window.shopQA.panel.preview.lastFrame,
  );
  await page.waitForTimeout(150);
  assert.equal(
    await page.evaluate(() => window.shopQA.panel.preview.lastFrame),
    stopped,
  );
  // Fresh document resets the shared asset cache and exercises failed loading.
  await page.route("**/assets/vacuum/vaccoin-vacuum.glb", (r) => r.abort());
  await page.reload();
  await page.evaluate(async () => {
    const { VacuumPreview } = await import("/src/vacuum-preview.ts");
    const { COSMETICS } = await import("/src/workshop-state.ts");
    const p = new VacuumPreview();
    window.failedPreview = p;
    p.draw(
      document.querySelector("canvas").getContext("2d"),
      COSMETICS[0],
      0,
      0,
      310,
      130,
    );
  });
  await page.waitForFunction(() => window.failedPreview.state === "error");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: six 3D palettes, one GLB load, isolated colours, purchase/equip/persistence, default restore, mobile, hidden rendering and load failure",
  );
} finally {
  await browser.close();
}
