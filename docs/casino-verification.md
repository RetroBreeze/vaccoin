# Casino rebuild verification — 11 November 2026

The approved atrium-and-wings design is implemented in the working tree. It uses a 84 × 76 footprint, three storeys, twelve main rooms, two stair cores, connecting passages, balconies and a drop shortcut. 184 slot machines have fixed burst contents. After the density revision, six collectible kinds total 61,757 items and 115,432 possible points (45,997 initially loose).

## Checks

- The original baseline passed 133 tests. The expanded suite passes 162 tests, including the concurrent account/control changes in this workspace.
- `npm run build` passes the strict TypeScript check and Vite production build. Vite retains its existing large-JavaScript-chunk advisory.
- `scripts/casino-browser-test.mjs` passes with mocked backend traffic: real WebGL loading, weighted suction, keyboard stair traversal up/down, slot bursting, full reset, expiry and absence of ZIP requests. It writes screenshots and `test-results/casino-report.json`.
- `node scripts/production-test.mjs` passes against the built preview: asset loading, WebGL, pointer lock, suction and restart, with development QA hooks absent.
- Unit coverage includes both stair cores in both directions; wall/door/deck occlusion; balcony drop; fixed placement/type reset; separate item and point accounting; exact full payout capacity; close pickup occlusion across a railing; solid atrium columns; ground treasure visibility from balconies; and real external asset textures.
- Independent review identified atrium visibility, close-pickup occlusion and missing column collision. All three were corrected. Source asset inspection additionally identified collision helper meshes and one-pixel embedded placeholders in the slot/table packs; the importer removes helpers and binds the supplied original texture PNGs.

## Performance and playtesting limits

The selected runtime casino assets occupy about 2.3 MB. The original 650+ MB archives remain in `public/assets` and are excluded from the production build. Static casino submeshes are merged by material; repeated slot machines use instanced rendering. Architecture and loot are not hidden by camera height, so stairwells and balcony views retain adjoining floors.

This environment's Chromium reports **ANGLE / SwiftShader**, a software renderer. The compact revision submits approximately 174 draw calls and 3.7 million triangles at the entrance. Software-rendered frames in the native-resolution browser run took roughly 1.7 seconds each. This is too slow for comfortable play in this software renderer and is not evidence of hardware 60 FPS. Hardware desktop and mobile performance must be playtested before release.

The environment is deliberately much larger than the mint. The automated checks establish navigability, not optimal score routes or a proven expert full-casino traversal time. Human runs should tune corridor travel, room reward density and high-value detours against the 60-second clock. No claim is made that every item can be collected in one round.

## Release boundary

No remote deployment or leaderboard reset was performed. Existing account identities, workshop saves and leaderboard APIs remain intact. The new score validator uses the exact total point budget rather than physical item count. Existing workshop balances are preserved, and new completed runs earn their point value.

The casino's scores are not directly comparable to historical mint scores. Before public launch, create a casino leaderboard season or separate board and update its achievement bindings; retain the old board as history. This requires a release decision rather than silently deleting player records during a local rebuild.

Existing mint-specific browser scripts have old teleport coordinates and crate/springboard assumptions. Use the casino browser script for the new environment; production and account/control integration checks remain separate.

## Native-resolution and density revision

At the user's request, world rendering now uses the actual viewport dimensions and device-pixel ratio with antialiasing, rather than the former 270-pixel internal height. The world's CSS no longer forces pixelated upscaling; the pixel-art HUD and original asset textures retain their authored styles.

Loot covers all walkable floors on a deterministic 0.8-unit grid with jitter, with additional room, entrance and atrium piles. Stairs follow their actual slope. Coverage tests sample all three storeys' main corridors, rear passages and both stair cores, requiring at least 30 reachable valuables within four units. A real-player simulation collects points during every half-second interval of a full corridor run.

`scripts/casino-density-browser-test.mjs` passes: native 1440×810 backing buffer at a 960×540 viewport/DPR 1.5, resize to 960×600 at 640×400, antialiasing enabled, CSS scaling disabled, corridor pickup and no browser errors. The screenshot/report are in `test-results/casino-native-density.png` and `casino-density-report.json`.

Mesh allocations follow each kind/floor's population; partial matrix uploads update changed ranges while preserving pending uploads for hidden floors. The performance sample above uses the compact revision. Hardware/mobile performance still needs playtesting, especially on balconies/stairs with multiple storeys visible.

## Quarkery palette revision

All twenty-four runtime casino GLBs and their textures now use the supplied Quarkery red-and-gold variants across architecture, furniture, slots and tables. The extraction manifest records the selected palette. The Lucky Seven export contains a stray Original-palette light texture reference; extraction remaps it to its supplied Quarkery counterpart and rejects unresolved external references. Obsolete extracted textures are removed using the previous manifest; the source archives remain intact.


## Compact furnished revision

The footprint is now 84 × 76, with five-unit storeys. Slot rooms contain forty machines each in split back-to-back banks; another twenty-four machines line the entrance and upper promenade. Table rooms contain six tables with chairs; lounge seating, palms, cocktail tables, lamps, bins and ornate door frames furnish the remaining space. The shared furniture definitions also generate rotation-aware collision boxes. Main aisles align with doors, and a connectivity test reaches all twelve room centres from the entrance.

Removed camera-height visibility switching for architecture and treasure. The depth buffer now resolves adjoining storeys, preventing floors from disappearing while climbing or looking down through the atrium. A regression crosses the former culling boundaries. Static spatial lookups restrict coin/body collision checks to nearby geometry; machine instancing tests cover bursting, disappearance and exact reset transforms.

The baked casino textures now use diffuse Lambert lighting rather than physically based shading. The final balcony uses the supplied Quarkery exterior railing modules.

Final browser verification passed with 45,997 loose items: opening sweep 972 points from 606 items, ten machine bursts, exact reset, both stair directions and no page errors. Native DPR/resize checks passed at 1440×810 and 960×600. The final balcony screenshot (`test-results/casino-balcony-final.png`) confirms ornate railings and visible ground-floor geometry through the atrium.


## Golden atmosphere pass

Reduced uniform fill, added warm distance haze and filmic tone mapping. A 128 × 384 RGB light atlas supplies localized golden pools to all world materials, including instanced coins and machines. Ceiling pendants, depth-tested soft halos, gently animated cabinet marquee bulbs and 150 sparse gold motes give the rooms life. No shadow maps, extra full-scene render pass or resolution reduction were added. Cabinet bulbs extinguish when a machine bursts and restore on reset.

Independent review caught marquee points inside two cabinet variants; moved them forward while preserving depth testing. All 164 tests and the production build pass. Existing Vite chunk-size advisory remains. Hardware performance is still unverified.

Final atmosphere browser pass captured entrance, slot room and balcony views, preserved native backing-buffer size and collected 974 correctly accounted points after restart, with no JavaScript or WebGL shader errors. The sampled scene submitted 181 draw calls and approximately 3.73 million triangles; software rendering remains slow (~1.85 seconds/frame), so this is not a hardware FPS claim. Screenshots: `test-results/casino-golden-*.png`; report: `test-results/casino-atmosphere-report.json`.


## Paradise polish and signage correction

Added instanced pink/cyan/champagne neon outlines, staggered architectural star glints, tiered chandelier crystals, jackpot signs and gold-selective view highlights. No added full-scene render pass. Browser verification retained native resolution, collected 972 correctly accounted points after restart and reported no JavaScript/WebGL errors.

User reported mirrored and unsupported signage. Replaced DoubleSide text with separate FrontSide faces, physical boards/frames/hangers; corrected north door orientation, removed repeated/unsupported atrium and stair labels, and limited wayfinding to actual stair approaches. Ads now sit on room walls and the jackpot banner attaches to a lintel joining the atrium columns. Ray/UV regressions prove text reads left-to-right from both approaches and panels have backing/ceiling connections. Final mounted entrance/slot screenshots were visually checked. All 166 tests and the production build pass; local preview4173 is refreshed. Hardware performance remains unverified.
