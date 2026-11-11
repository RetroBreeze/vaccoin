import { chromium } from "@playwright/test";
import { mockBackend } from "./mock-backend.mjs";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
await mkdir("test-results/vacuum", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-gpu", "--use-gl=angle", "--use-angle=gl"],
});
try {
  let page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 0.25,
  });
  await mockBackend(page, { offline: true, savedName: false });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (!process.argv.includes("--asset-only")) {
    await page.goto("http://127.0.0.1:5173/?qa");
    await page.waitForFunction(() => !!window.vaccoinQA);
    await page.getByRole("textbox", { name: "DISPLAY NAME" }).fill("Vacuum QA");
    await page
      .getByRole("button", { name: "PLAY", exact: true })
      .click({ noWaitAfter: true });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: "test-results/vacuum/game-idle.png" });
    await page.mouse.down();
    await page.waitForTimeout(1800);
    await page.screenshot({ path: "test-results/vacuum/game-suction.png" });
    assert((await page.evaluate(() => window.vaccoinQA.snapshot())).score > 0);
    await page.mouse.up();
    await page.keyboard.down("w");
    await page.keyboard.press("Space");
    await page.waitForTimeout(400);
    await page.screenshot({ path: "test-results/vacuum/game-jump.png" });
    await page.keyboard.up("w");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: "test-results/vacuum/game-portrait.png" });
    console.log("Gameplay captures and collection passed");
  }
  await page.close();
  page = await browser.newPage({
    viewport: { width: 960, height: 720 },
    deviceScaleFactor: 1,
  });
  page.on("pageerror", (e) => errors.push(e.message));
  // Isolated asset inspection using the production loader and renderer.
  await page.route("**/vacuum-qa", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><body style="margin:0"></body>',
    }),
  );
  await page.goto("http://127.0.0.1:5173/vacuum-qa");
  await page.setViewportSize({ width: 960, height: 720 });
  const stats = await page.evaluate(async () => {
    const T = await import("/node_modules/three/build/three.module.js");
    const { GLTFLoader } =
      await import("/node_modules/three/examples/jsm/loaders/GLTFLoader.js");
    const gltf = await new GLTFLoader().loadAsync(
      "/assets/vacuum/vaccoin-vacuum.glb",
    );
    let triangles = 0,
      meshes = 0;
    gltf.scene.traverse((o) => {
      if (o.isMesh) {
        meshes++;
        triangles +=
          (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
      }
    });
    document.body.innerHTML = "";
    const r = new T.WebGLRenderer({ antialias: false });
    r.setSize(480, 360);
    r.domElement.style.cssText =
      "width:960px;height:720px;image-rendering:pixelated";
    document.body.append(r.domElement);
    r.setClearColor(0x211b30);
    r.outputColorSpace = T.SRGBColorSpace;
    const scene = new T.Scene();
    scene.add(gltf.scene, new T.HemisphereLight(0xffffff, 0x665577, 2));
    const light = new T.DirectionalLight(0xffffff, 3);
    light.position.set(-3, 5, -2);
    scene.add(light);
    const c = new T.PerspectiveCamera(40, 4 / 3, 0.01, 20);
    window.assetQA = {
      r,
      scene,
      c,
      model: gltf.scene,
      draw(pos) {
        c.position.set(...pos);
        c.lookAt(-0.1, 0, 0.15);
        r.render(scene, c);
      },
    };
    window.assetQA.draw([2, 1.8, -3]);
    return {
      triangles,
      meshes,
      nozzle: !!gltf.scene.getObjectByName("Nozzle"),
    };
  });
  assert(stats.triangles >= 1000 && stats.triangles <= 3000);
  assert.equal(stats.meshes, 5);
  assert(stats.nozzle);
  for (const [name, pos] of [
    ["front", [2, 1.8, -3]],
    ["side", [3, 1, 0.6]],
    ["rear", [-2, 1.6, 3]],
  ]) {
    await page.evaluate((pos) => window.assetQA.draw(pos), pos);
    await page.screenshot({ path: `test-results/vacuum/model-${name}.png` });
  }
  // Exercise real viewmodel loading, workshop recolour, and projection extremes.
  await page.evaluate(async () => {
    const { Vacuum } = await import("/src/vacuum.ts");
    const q = window.assetQA;
    q.scene.remove(q.model);
    q.scene.add(q.c);
    q.c.position.set(0, 0, 0);
    q.c.rotation.set(0, 0, 0);
    const v = new Vacuum(q.c);
    v.equip("gold");
    const first = v.load();
    if (first !== v.load()) throw Error("Duplicate model load");
    await first;
    if (v.loadState !== "loaded") throw Error("GLB did not load");
    v.equip("default");
    q.v = v;
    q.c.layers.set(1);
    q.scene.traverse((o) => {
      if (o.isLight) o.layers.enable(1);
    });
  });
  for (const [name, fov, aspect] of [
    ["wide", 110, 2.4],
    ["narrow", 50, 0.46],
    ["normal", 78, 16 / 9],
  ]) {
    const width = aspect < 1 ? 390 : 960,
      height = Math.round(width / aspect);
    await page.setViewportSize({ width, height });
    await page.evaluate(
      ({ fov, aspect, width, height }) => {
        const q = window.assetQA;
        q.r.setSize(width / 2, height / 2, false);
        q.r.domElement.style.width = width + "px";
        q.r.domElement.style.height = height + "px";
        q.c.fov = fov;
        q.c.aspect = aspect;
        q.c.updateProjectionMatrix();
        q.v.update(1 / 60, 1, true, 14, 100, 8, false);
        q.r.render(q.scene, q.c);
        if (!q.v.nozzleTarget.toArray().every(Number.isFinite))
          throw Error("Invalid muzzle");
      },
      { fov, aspect, width, height },
    );
    await page.screenshot({ path: `test-results/vacuum/framing-${name}.png` });
  }
  await page.route("**/assets/vacuum/vaccoin-vacuum.glb", (route) =>
    route.abort(),
  );
  await page.evaluate(async () => {
    const { Vacuum } = await import("/src/vacuum.ts?failure-check");
    const q = window.assetQA;
    const v = new Vacuum(q.c);
    await v.load();
    if (v.loadState !== "error" || !v.group.children.length)
      throw Error("Missing loading fallback");
  });
  assert.deepEqual(errors, []);
  console.log("Vacuum checks passed", stats);
} finally {
  await browser.close();
}
