# Verification — 9 November 2026

Environment: Node 26.13, Linux, Chromium via Playwright, 1280×720 browser viewport, 480×270 internal world rendering. Hardware-backed WebGL reports ANGLE / Mesa Intel Graphics (ADL GT2). Measurements are from automated local runs, not a guarantee for all hardware.

## Automated checks

- `npm test`: 22 tests pass. Covers seeded population/reset, one coin = one point, duplicate prevention, pool capacity and active cap, spatial queries, elapsed-time expiry, both ramp directions, jumping/landing on all three elevations, deck/ramp occlusion, ramp underside collision, ballistic coins versus pillars, reachable nozzle targets near ramps, pointer-lock restart intent, local PB persistence and storage/online failure handling.
- `npm run build`: strict TypeScript and Vite production build pass. About 619 KB minified JavaScript / 161 KB gzip, 740 KB of selected source assets, approximately 1.4 MB total uncompressed build. Vite's single-chunk size advisory is nonblocking; most of the bundle is Three.js and its glTF loader.
- `npm audit`: no reported vulnerabilities in the final lockfile.
- `npm run test:browser`: real WebGL/Pointer Lock pass. Opening suction collects **1,023 coins in approximately three seconds**, with score matching removed collectibles exactly. Actual keyboard movement reaches the +6m gallery, descends to -6m and returns. Both destruction types release real coins. Mute, unlocked clock progression, expiry, PB, instantaneous reset and 800×600 resize pass. No page errors.
- `node scripts/compatibility-test.mjs`: passes with simulated void-returning Pointer Lock, denied localStorage, mute before AudioContext creation, and R while unlocked. This is compatibility simulation in Chromium, not testing actual Safari/Firefox.
- `node scripts/full-round-test.mjs`: uses keyboard movement without teleportation and waits for real elapsed-time expiry. The tuned route lands within the requested 3,000–6,000 range. Exact latest measurements live in `test-results/full-round-report.json`.
- `node scripts/production-test.mjs`: production asset loading, WebGL, Pointer Lock, suction and restart smoke test; confirms development-only QA hooks are absent. Requires `npm run preview -- --port 4173`.

Screenshots and raw browser reports are in ignored `test-results/`. The normal browser scenario averaged **16.67 ms/frame (~60 FPS)** with a maximum sampled frame interval of 16.8 ms. The final instrumented 60-second run scored **5,137 coins**, took **59.98 seconds** from the post-start measurement point, averaged **17.00 ms/frame (~59 FPS)** and had a maximum sampled interval of **166.7 ms**. Chromium reported nine long tasks, including initial load; no JavaScript errors occurred. One earlier run recorded an approximately 3-second frame gap; it did not recur in the instrumented repeat, so its cause is unresolved rather than claimed fixed. Human performance playtesting should watch for intermittent hitches.

## Review fixes

A separate implementation reviewer found ramp underside penetration, ballistic coins lodging inside pillars, and R resuming instead of restarting when the mouse was released. Each was reproduced and fixed with regressions. Persistence wording, mute-before-activation and non-Promise Pointer Lock were also corrected. Visual review found nozzle clipping at close walls and inaccessible suction targets when the nozzle extended through a ramp; rendering now uses a separate depth pass and the physical collection point stays reachable. Final visual review also reduced collection sparks so they cannot swell across the camera, and moved the vault sign above its landmark. The 22-test suite, production build and production browser smoke test were rerun successfully after those presentation changes.

The user approved an eight-sided replacement collectible during implementation. It uses the original KayKit palette and 48 triangles, reducing the opening scene from about 3.9 million to 622,000 triangles. The detailed original glTF coin remains the mint emblem. Original glTF materials remain on all imported models.

## Limits and manual playtesting

- The Supagame TypeScript package is an empty reserved package. No live authentication, leaderboard or submission has been tested or claimed. The adapter is offline by default; connection/submission failure handling is tested with synthetic bridges.
- Human playtesting is still needed for audio mix, mouse sensitivity, long-session comfort, route balance and how quickly first-time players learn the vault/gallery shortcuts. The scripted route establishes attainability, not a player score distribution.
- Actual Firefox, Safari, mobile/touch and lower-end graphics devices were not tested. The game is designed for a desktop keyboard and mouse. Software-rendered Chromium is substantially slower and is not the performance target.
- Web Audio activation and mute are verified programmatically; subjective sound quality is not verified by an automated browser.
- Client scores remain client-authoritative and are not cheat-proof. Range checks and run IDs are not an anti-cheat system.

## Floor and springboard follow-up

Closed the central mint-floor opening over the vault while keeping both side ramps open, and widened the descent ramps to meet the outer walls. Added four automatic springboards with directional chevrons, spring animation and a short launch sound. Two connect the mint to the galleries; two return from the vault. Launch steering preserves enough travel to reach the higher floor even while holding the approach key. Resting coins leave the pads visible, and restart clears launch motion and animation.

`npm test`: 27 tests pass. `npm run build`: passes. `node scripts/springboards-test.mjs`: all four higher-floor landings, held-key vault launch, central floor crossing and restart pass in Chromium with no page errors. The existing browser gameplay suite also passes with the new layout. No explanatory UI or arena text was added.

## Coin explosion follow-up

Crates now split into pooled shell fragments and erupt into 240 (small) or 540 (large) actual coins. The coins fly outward/upward for 0.35–0.60 seconds before held suction can catch them. Excess eruptions queue behind the 1,800-active-coin limit instead of becoming static piles. Total available coins are now 19,200; the local validation boundary shares the same constant. Faster showers collide with pillar caps and spill off them so coins cannot settle inside or become stranded on top.

`npm test`: 31 tests pass, including visible eruption under continuous suction, overflow scheduling, exact accounting, higher score bounds, reset and gallery-level pillar collisions. `npm run build` passes. `node scripts/explosions-test.mjs` passes for both crate types with screenshots, exact counts, active cap, scoring and restart. The normal browser gameplay suite also passes. No UI text was added.

## Immersive display, touch and gamepad follow-up

Added fullscreen via the top-right button or F, an automatic mobile fullscreen/landscape request, and a portrait rotate prompt when native locking is unavailable. Touch uses a left movement stick, right look surface, jump and hold-vacuum buttons. Standard gamepads use left/right sticks, A/Cross jump, RT vacuum and Start to start/stop/resume controls. Input stops on blur, hidden pages, portrait rotation and active gamepad disconnect; the existing 60-second wall clock continues. Desktop mouse activation can take over after a controller disconnect.

`npm test`: 69 tests pass. TypeScript and production build pass. All eight browser scripts pass: controls, desktop gameplay, leaderboard, production, compatibility, full round, springboards and explosions. The new controls browser check uses Chromium mobile emulation with real simultaneous touch pointers and a simulated standard gamepad; it covers name confirmation, movement/look/suction, cancellation, jump, control suspension, portrait fallback, mouse takeover, fullscreen entry/exit, round results and restart. The full round collected/displayed 4,095 coins and completed with no browser errors. Screenshots of mobile name entry, touch gameplay and the portrait prompt were inspected.

Review fixes were reproduced before implementation: controller disconnect previously prevented mouse takeover; rejected extra touch fingers previously cleared the held visual state of the owning finger. Regression coverage now passes for both. All backend HTTP remains mocked during browser checks; no test scores reached the hosted leaderboard.

Native fullscreen and landscape lock depend on the browser and device. Physical iOS/Android devices and physical controllers have not been tested in this environment. The existing Vite bundle-size warning remains non-blocking. No gameplay physics, round duration, scoring, assets, dependencies or backend deployments were changed.
