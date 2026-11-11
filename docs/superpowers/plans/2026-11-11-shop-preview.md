# Shop colour preview plan

Use the existing six colour schemes and purchase/equip flow. Rename visible Workshop labels to Shop, retaining persistent save keys and cosmetic IDs. Replace the pixel illustration with a gently rotating GLB preview in the existing canvas panel.

- Share the cached vacuum GLB loader and named material palettes between preview and gameplay. Correct DEFAULT to the logo palette.
- Render a small isolated preview only while the shop is visible. Cache a 2D copy between frames, handle loading/WebGL failures, and respect reduced motion.
- Verify colour isolation/reset, purchase/equip persistence, loading failures, mobile framing, build and unit tests. Keep unrelated Supagame work untouched.

Completed. Build and all 169 unit tests pass. The focused browser test covers six distinct previews, one shared model request, independent materials, purchase/equip/local restoration, returning to DEFAULT, portrait layout, no preview rendering when hidden, and failed loading. Existing vacuum asset/FOV browser checks pass. An actual-game smoke check passed opening Shop, browsing with insufficient funds, closing it, and checking for page errors. Screenshots are in test-results/shop/.
