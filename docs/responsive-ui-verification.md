# Responsive casino UI verification — 2026-11-11

The interface now uses native HTML/CSS menu surfaces. The gameplay HUD remains on canvas, and the shop uses a dedicated canvas only for its 3D vacuum preview. Casino styling uses plum, green felt, cream and gold. The existing logo pulses on a single fullscreen entry button; reduced-motion preferences disable animation.

Entry invokes audio unlocking and immersive display directly from the same trusted click/tap handler, before awaiting either API. A failed or missing fullscreen API does not block entry. The button is disabled until its handler is attached, which happens before game asset loading. Returning from results opens the lobby without repeating entry.

## Passing checks

- `npm test`: 167 tests in 27 files. Removed obsolete canvas menu assertions; retained HUD coverage and added native menu browser coverage.
- `npm run build`: TypeScript and Vite production build pass. Existing large-bundle advisory remains.
- `npm run test:browser:ui`: trusted audio/fullscreen calls and rejected fullscreen fallback; portrait phone, landscape phone and desktop viewport layouts; 48px touch controls; leaderboard/shop/account/achievement navigation; keyboard focus; repeated pause/resume; visible achievement notices on results; score credit, colour purchase/equip and persisted restoration after reload; Main Menu return without re-entry. Backend HTTP and WebSockets are mocked.
- `node scripts/name-edit-test.mjs`: name validation, saving, Enter, cancellation, failed save recovery, live name changes and narrow layouts. Fixture now checks account-scoped name storage.
- `node scripts/title-leaderboard-test.mjs`: public and nearby rankings, player highlight, retry, keyboard entry/exit and narrow layouts. Fixture now seeds the name under its account scope.
- `node scripts/accounts-browser-test.mjs`: desktop/mobile guest account controls.
- `node scripts/accounts-oauth-browser-test.mjs`: all seven mocked OAuth scenarios pass: keep cloud, keep guest, merge, link, Google display name, defer and cancelled sign-in, across desktop/mobile widths.
- `DELETE_TEST_ORIGIN=http://127.0.0.1:5173 node scripts/cloud-save-delete-browser-test.mjs`: deletion/cancellation, recovery after reload, second-context reconnect and Start Fresh.
- `node scripts/shop-preview-browser-test.mjs`: all six 3D palettes, shared asset loading, purchase/equip/persistence, default restoration, mobile preview and asset failure fallback.
- `git diff --check` passes.

Screenshots are in ignored `test-results/casino-entry.png`, `casino-menu-390.png`, `casino-menu-844.png`, `casino-menu-1280.png`, `casino-shop-390.png` and `casino-results.png`.

## Limits and other attempts

Browser checks use Chromium emulation, not a physical iPhone or Android device. This environment uses SwiftShader software graphics. The broader legacy `workshop-browser-test.mjs` run timed out waiting for mouse gameplay; a reduced-resolution touch run was terminated before completion. `achievements-browser-test.mjs` exceeded its 7-second FIFO timing bound. The focused responsive suite covers the changed menu, notice, purchase and restoration flows, but this is not a claim that the full gameplay browser suite passed.

OAuth fixtures were updated to handle the new entry screen after both successful and cancelled redirects, and to return a missing-save response for an absent reset marker rather than treating it as a workshop save.

## Landscape and start corrections

Removed the decorative menu slogans and entry captions. Sound now occupies a normal menu action slot. Compact landscape layouts show the lobby, rankings, achievements, shop, results, name editor and account confirmations without scrolling, with at least 48px button targets. Coin rain uses the original coin geometry, a cached rotation atlas, and a static reduced-motion rendering.

`node scripts/landscape-ui-browser-test.mjs` passes at the installed Playwright Pixel 9 landscape browser viewport (756×308), fullscreen size (808×360), and 844×390 / 924×412. It checks content overflow, visible controls, touch target size, overlapping controls, all ten leaderboard entries, results and animated/static coin rain.

`node scripts/start-countdown-browser-test.mjs` passes: a fullscreen transition that blurs the window no longer leaves a fresh round paused. Controls activate after the transition; 3/2/1 holds movement, aim, suction and scoring while preserving the full 60-second timer. Later blur/Escape still pauses and Resume continues the same round. This timing regression uses a controlled browser clock and reduced render resolution because the test environment uses software WebGL.

Current unit suite: 170 tests in 29 files pass; production build passes. Name editing, public/nearby leaderboard, account controls and the complete responsive browser regression also pass after these corrections.

## Transparent casino background and natural coin motion

Menus now use translucent surfaces over a floating casino view. The camera follows a continuous 120-second loop through the open ground-floor corridors; unit checks sample the entire route for wall/column clearance. Menu rendering is capped at 960×540, DPR 1 and 24 frames per second, with full gameplay resolution restored on entry. Reduced motion freezes the view; a resize also refreshes the frozen paused-game background.

Coin rain now rotates through face, edge and back views, with independent tumble direction/speed, in-plane roll, accelerated falls into terminal velocity, lateral drift and staggered respawns above the viewport. It retains the small cached atlas and static reduced-motion rendering.

Passing checks: `node scripts/menu-background-browser-test.mjs`, `node scripts/landscape-ui-browser-test.mjs`, `node scripts/start-countdown-browser-test.mjs`; 177 unit tests in 31 files; production build. Controlled browser clocks prevent software WebGL from distorting timing assertions. Rendered previews are saved to `test-results/floating-casino-menu.png` and `test-results/floating-casino-shop.png`.
