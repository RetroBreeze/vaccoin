import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
await mkdir("test-results/shop", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 480 },
  });
  await page.route("**/faces-qa", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: '<!doctype html><body style="margin:0;background:#142638;display:grid;grid-template-columns:repeat(4,300px)"></body>',
    }),
  );
  await page.goto("http://127.0.0.1:5173/faces-qa");
  const result = await page.evaluate(async () => {
    const T = await import("/node_modules/three/build/three.module.js");
    const { loadVacuumModel, createVacuumMaterials } =
      await import("/src/vacuum-model.ts");
    const model = await loadVacuumModel(createVacuumMaterials());
    const centre = new T.Box3().setFromObject(model).getCenter(new T.Vector3());
    model.position.sub(centre);
    const scene = new T.Scene();
    scene.background = new T.Color(0x142638);
    scene.add(model, new T.HemisphereLight(0xffffff, 0x554268, 2));
    const light = new T.DirectionalLight(0xffffff, 1.5);
    light.position.set(2, 5, -3);
    scene.add(light);
    const renderer = new T.WebGLRenderer({ antialias: false });
    renderer.setSize(300, 220);
    renderer.outputColorSpace = T.SRGBColorSpace;
    const camera = new T.OrthographicCamera(-1.5, 1.5, 1.1, -1.1, 0.1, 20);
    const views = [
      [3, 2, -0.7],
      [-3, 2, 0.7],
      [0, 2, -3],
      [0, -2, -3],
      [0, 2, 3],
      [0, -2, 3],
      [3, -2, 0],
      [-3, -2, 0],
    ];
    const capture = document.createElement("canvas");
    capture.width = 300;
    capture.height = 220;
    const ctx = capture.getContext("2d");
    let missing = 0;
    for (let i = 0; i < views.length; i++) {
      camera.position.set(...views[i]);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      const tile = document.createElement("canvas");
      tile.width = 300;
      tile.height = 240;
      const c = tile.getContext("2d");
      c.drawImage(renderer.domElement, 0, 0);
      c.fillStyle = "#ffffff";
      c.font = "13px monospace";
      c.fillText(`View ${i + 1}: ${views[i].join(", ")}`, 12, 234);
      document.body.append(tile);
      const saved = [];
      model.traverse((o) => {
        if (o.isMesh) {
          saved.push([o, o.material]);
          o.material = new T.MeshBasicMaterial({
            color: 0xffffff,
            side: o.material.side,
          });
        }
      });
      scene.background.set(0x000000);
      renderer.render(scene, camera);
      ctx.drawImage(renderer.domElement, 0, 0);
      const actual = ctx.getImageData(0, 0, 300, 220).data;
      for (const [mesh] of saved) {
        mesh.material.side = T.DoubleSide;
        mesh.material.needsUpdate = true;
      }
      renderer.render(scene, camera);
      ctx.drawImage(renderer.domElement, 0, 0);
      const complete = ctx.getImageData(0, 0, 300, 220).data;
      for (let p = 0; p < actual.length; p += 4)
        if (complete[p] > 0 && actual[p] === 0) missing++;
      for (const [mesh, material] of saved) {
        mesh.material.dispose();
        mesh.material = material;
      }
      scene.background.set(0x142638);
    }
    renderer.dispose();
    return { missing, views: views.length };
  });
  await page.screenshot({
    path: `test-results/shop/faces-${process.argv.includes("--before") ? "before" : "after"}.png`,
  });
  console.log(result);
  assert.equal(
    result.missing,
    0,
    "Surfaces disappear after applying colour materials",
  );
} finally {
  await browser.close();
}
