# Vaccoin signature vacuum

Canonical reference: `public/assets/logo.png`. The illustration depicts a purple flared suction head, gold mouth band, cyan coupling and ribbed lavender hose. It does not depict a canister or a separate handle. This model reconstructs those visible parts, with a recessed intake and a finished hose end completing the unseen surfaces.

Rebuild from the repository root:

```sh
blender --background --python scripts/build-vacuum.py
```

Output: `vaccoin-vacuum.glb`, 1,374 triangles, five meshes/materials, approximately 104 KB, no textures or external buffer dependencies. glTF axes: Y up, nozzle faces -Z. The `Nozzle` node is the mouth centre. Named material slots: `body`, `trim`, `dark`, `accent`, `coupler`.

The runtime uses shared loaded geometry and inexpensive Lambert materials. The asset loads once; a small procedural head/hose remains visible if the request fails. Workshop colours still work, and DEFAULT restores the logo palette. Visual motion and FOV fitting are independent of the original coin collection target. Coin burst particles originate at the new mouth.

Verification commands:

```sh
npm run build
npm test
# With npm run dev running:
node scripts/vacuum-browser-test.mjs
# Fast isolated asset, loading/fallback and FOV checks:
node scripts/vacuum-browser-test.mjs --asset-only
```

The browser check writes gameplay, three model views, and FOV framing captures to `test-results/vacuum/`. Gameplay captures use a reduced device pixel ratio to also check the silhouette at low resolution; the game's renderer settings are unchanged.

Verification limitation: this environment intermittently timed out or closed its headless browser during full gameplay screenshots. Isolated asset checks passed; gameplay collection and screenshots succeeded in earlier runs, but the complete existing browser suite remains unverified.
