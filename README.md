# VACCOIN

**One vacuum. One minute. All the gold.**

A complete first-person browser arcade game built with TypeScript, Three.js, Vite and a separate Canvas2D pixel interface. Race through a three-storey PSX casino, vacuum coins and valuables, and burst slot machines to beat your personal best.

## Run locally

Requires Node.js 22.12+ (tested with Node 26) and a browser with WebGL2. Play with keyboard and mouse, mobile touch controls, or a standard-mapped gamepad.

```sh
npm install
npm run dev
```

Open the URL printed by Vite (normally **http://localhost:5173**). Choose your display name and click **PLAY**. Desktop play captures the mouse; mobile play uses touch controls and requests landscape fullscreen where supported. A gamepad can start with **Start** or **A/Cross** once a name is entered.

```sh
npm run build       # strict TypeScript check and production bundle
npm run preview     # serve the production build locally
npm test            # deterministic simulation and integration-boundary tests
```

For a clean checkout with the committed lockfile, `npm ci` can replace `npm install`.

The three `@supagame/*` dependencies are unpublished packages, so this repository
includes versioned, integrity-locked tarballs in `vendor/`. A clean clone or
Cloudflare Pages build can run `npm ci` without a sibling Supagame checkout.
These snapshots were packed from [Supagame](https://github.com/RetroBreeze/supagame)
commit `ca60518` (contracts/SDK 0.1.4 and CLI 0.1.6). The Admin CLI is a local
developer tool requiring Node 24; it is not executed by the browser build.
When updating Supagame, rebuild the packages, replace the corresponding vendor
archives, regenerate `package-lock.json`, and verify `npm ci`, `npm test`, and
`npm run build` before committing.

## Controls

| Action              | Keyboard / mouse     | Mobile touch                                      | Standard gamepad                                 |
| ------------------- | -------------------- | ------------------------------------------------- | ------------------------------------------------ |
| Move / strafe       | WASD                 | Swipe and hold on left side                       | Left stick                                       |
| Look                | Mouse                | Drag on right side                                | Right stick                                      |
| Vacuum              | Hold left mouse      | Hold right side                                   | Hold right trigger                               |
| Jump                | Space                | Double tap either control area                    | A / Cross                                        |
| Play / resume       | Click button / Enter | Tap button                                        | Start (A / Cross also starts from title/results) |
| Pause               | Escape               | II button                                         | Start                                            |
| Restart immediately | R                    | Play Again after results                          | A / Cross after results                          |
| Fullscreen          | F / entry screen     | Automatic request on entry; Home Screen on iPhone | Enter before playing                             |
| Toggle sound        | M / main-menu button | Sound button on main menu                         | Sound button on main menu                        |

Fullscreen is optional. Supported mobile browsers request landscape after entering fullscreen; other browsers show a rotate prompt in portrait. On iPhone, use Safari’s Share → Add to Home Screen and launch VACCOIN from there for a standalone view without browser bars. Input is suspended on rotation, controller disconnect, loss of focus or hidden tabs. Resume explicitly to continue. Mouse and touch can take over after disconnecting a controller. Gamepad sticks have a dead zone, and jump/menu actions require a fresh button press. Touch controls support simultaneous movement, looking and suction. Drag while holding VAC or JUMP to aim, including outside the button bounds; VAC stays active until release, and dragging does not repeat jumps. Pointer cancellation clears held inputs.

The countdown and **60-second clock pause** when you stop controls, release the mouse, rotate to portrait, disconnect a controller, switch tabs, or lose focus. Return to the game and choose Resume to continue from the same remaining time. A restart abandons the previous run; only completed rounds update your best.

Start by sweeping the valuables in the entrance. Hold suction on slot machines until they burst. Explore the slot gallery, roulette hall and blackjack salon; follow signs to the two stair cores for the upper poker rooms, high-limit salon and pearl lounge, or descend to the cashier, counting rooms and bullion vault. The upper promenade overlooks the atrium, with a deliberate drop shortcut at its southern edge. No lifts or door timers interrupt a run.

Coins score **1**, large coins **10**, dollar bills **25**, gold bars **100**, pearls **250**, and diamonds **500**. Every placement and machine payout repeats exactly; route choice and movement determine the score. Workshop earnings use the run's point value, retaining existing balances and cosmetics.

## Casino implementation

- An 84 × 76 footprint with three storeys at -5, 0 and 5, twelve enclosed rooms, rear passages, twin stair cores and an open central atrium.
- Shared layout data drives visible walls, floors, furniture and collision. The existing accelerated movement, jumping and fixed 120 Hz physics remain.
- **45,997 loose valuables plus 15,760 items in 184 machines: 61,757 physical collectibles, worth 115,432 points.** Points and collected-item counts are tracked separately.
- Dense, deterministic floor coverage connects room piles through every corridor and stairway. Typed instanced meshes partitioned by kind and floor, a spatial hash and a maximum of 1,800 active items preserve curved suction and ballistic payouts. Walls, columns and decks occlude suction.
- Twenty-four selected GLBs from the supplied PSX Casino, Slot Machines and Table Games packs, with their baked red-and-gold Quarkery textures. Authored collision helper meshes are removed from rendering; static parts share geometry/materials and are batched.
- Native-resolution rendering at the viewport’s device-pixel ratio with antialiasing, textured casino architecture, room signs, room-name HUD and valuable pickup feedback.
- Accounts, workshop saves, achievements, controls and leaderboard integration retained.

Run `python scripts/extract-casino-assets.py` to reproduce the runtime assets from the archives in `public/assets`. Source provenance is recorded in `public/assets/casino/provenance.json`. Production builds exclude the large ZIP archives; source copies remain intact.

## Supagame leaderboards

The installed Supagame SDK uses the configured Supabase project and the `vaccoin` leaderboard. Existing anonymous identities and display names are reused; completed rounds submit their actual final point total with a stable submission UUID. Results show server personal best, rank and top 10. Offline play and local best remain available. See [integration details](docs/supagame-integration.md) for configuration, failure handling and tests.

Client-side scores are **not inherently cheat-proof**. Server validation and idempotency do not prove that a client honestly played a round. No anti-cheat claim is made here.

## Verification

Casino checks (all backend calls mocked):

```sh
npm test
npm run build
npm run dev -- --port 5173
CASINO_TEST_ORIGIN=http://localhost:5173 node scripts/casino-browser-test.mjs
```

This checks weighted collection, actual staircase movement, slot bursts, reset and expiry, with screenshots of each floor. Historical mint-specific browser scripts remain as references; their old teleports and crate expectations do not describe the casino. See [casino verification and release notes](docs/casino-verification.md).

Install Chromium with `npx playwright install chromium` if needed. Development-only QA helpers are enabled with `?qa` and removed from production builds. `node scripts/production-test.mjs` checks the production preview on port 4173, including asset loading, pointer lock and restart. Screenshots and JSON reports are written to ignored `test-results/`.

## Project map

`main.ts` composes the game. `rendering.ts`, `assets.ts` and `arena.ts` build the world; `casino-layout.ts`, `terrain.ts` and `player.ts` handle layout and movement; `collectibles.ts`, `coins.ts`, `spatial.ts`, `vacuum.ts` and `destructibles.ts` handle collectibles; `effects.ts` and `audio.ts` provide feedback; `ui.ts` and `pixel-font.ts` draw the interface; `round.ts` owns round state; `supagame.ts` owns the integration boundary.

## Assets

Casino architecture, furniture, slot machines and gaming tables come from the three user-supplied PSX asset packs. Their source archives are preserved in `public/assets`; `casino/provenance.json` maps every extracted model and texture to its archive. The packs do not include a standalone license file in the inspected archive paths, so no new license claim is made here. Bill, bar, pearl and diamond collectible geometry is native Three.js geometry; the existing KayKit coin remains.

KayKit Bits Bundle 2 by **Kay Lousberg** (CC0). Selected glTF files, original buffers and palette textures are copied into `public/assets/`; the full supplied source bundle remains untouched and is excluded from Git/build output. License: `public/assets/KayKit-LICENSE.txt`.

Live Leaderboards now appears on the title screen through the Supagame SDK.
See [setup, lifecycle, tests and hosted deployment](docs/live-leaderboards.md).
