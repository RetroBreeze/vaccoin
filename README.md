# VACCOIN

**One vacuum. One minute. All the gold.**

A complete first-person browser arcade game built with TypeScript, Three.js, Vite and a separate Canvas2D pixel interface. Race through the mint, sky galleries and undervault, vacuum real coins, and smash containers to beat your personal best.

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

## Controls

| Action              | Keyboard / mouse     | Mobile touch                                   | Standard gamepad                                 |
| ------------------- | -------------------- | ---------------------------------------------- | ------------------------------------------------ |
| Move / strafe       | WASD                 | Left thumbstick                                | Left stick                                       |
| Look                | Mouse                | Drag on right side                             | Right stick                                      |
| Vacuum              | Hold left mouse      | Hold VAC                                       | Hold right trigger                               |
| Jump                | Space                | Tap JUMP                                       | A / Cross                                        |
| Play / resume       | Click button / Enter | Tap button                                     | Start (A / Cross also starts from title/results) |
| Stop controls       | Escape               | II button                                      | Start                                            |
| Restart immediately | R                    | Play Again after results                       | A / Cross after results                          |
| Fullscreen          | F / top-right button | Automatic request on Play, or top-right button | Use fullscreen button before playing             |
| Toggle sound        | M / sound button     | Sound button on menus                          | Sound button on menus                            |

Fullscreen is optional. Supported mobile browsers lock to landscape after entering fullscreen; other browsers show a rotate prompt in portrait. Input is suspended on rotation, controller disconnect, loss of focus or hidden tabs. Resume explicitly to continue. Mouse and touch can take over after disconnecting a controller. Gamepad sticks have a dead zone, and jump/menu actions require a fresh button press. Touch controls support simultaneous movement, looking and suction. Drag while holding VAC or JUMP to aim, including outside the button bounds; VAC stays active until release, and dragging does not repeat jumps. Pointer cancellation clears held inputs.

The **60-second clock keeps running** when you stop controls, release the mouse, rotate to portrait, disconnect a controller, switch tabs, or lose focus. Movement and suction stop until you resume. A restart abandons the previous run; only completed rounds update your best. There is no pause exploit.

Start by sweeping the gold directly ahead. Vacuum green crates until they burst. Run into big wooden crates at speed. Teal ramps climb to the galleries; violet ramps lead down to the vault. Four springboards launch automatically: two reach the galleries and two return from the vault. The central floor continues over the vault, with access down the side ramps. Dropping from the upper floor is a shortcut. Every coin is exactly one point.

## Implementation

- Three hand-designed elevations, broad ramps, a bridge, drops, colour-coded routes and landmarks.
- Accelerated FPS movement, air control, jumping, floor support, wall and underside collision at a fixed 120 Hz.
- **12,000 loose coins + 7,200 inside 20 crates = 19,200 actual collectibles.** A deterministic layout gives repeatable routes.
- One instanced collectible mesh, typed-array state, 3D spatial hash, maximum 1,800 active coins, rate-limited acquisition, curved suction and ballistic showers. Eight-sided bevelled coins use 48 triangles and the supplied KayKit gold palette. Collected instances are hidden, cannot score twice, and reset immediately.
- Original KayKit glTF crates, vault, gold stacks, money, modular scenery and a detailed coin emblem. Shared geometry/materials; static architecture batched by material.
- Approximately 480×270 internal rendering at 16:9, adjusted horizontally for aspect ratio, with nearest-neighbour scaling. Canvas2D HUD and menus use a locally drawn bitmap font. No external font, sound or asset requests.
- Visible nozzle/fan, pooled airflow and debris, score pulse, procedural motor, coin arpeggios, impacts, countdown and results cue.
- Resilient local personal best, optional audio, pointer-lock retry, elapsed-time expiry and complete reset.

## Supagame leaderboards

The installed Supagame SDK uses the configured Supabase project and the `vaccoin` leaderboard. Existing anonymous identities and display names are reused; completed rounds submit their actual final coin total with a stable submission UUID. Results show server personal best, rank and top 10. Offline play and local best remain available. See [integration details](docs/supagame-integration.md) for configuration, failure handling and tests.

Client-side scores are **not inherently cheat-proof**. Server validation and idempotency do not prove that a client honestly played a round. No anti-cheat claim is made here.

## Verification

```sh
npx playwright install chromium
npm run dev -- --port 5173
# In a second terminal:
npm run test:browser
node scripts/full-round-test.mjs
node scripts/compatibility-test.mjs
node scripts/controls-test.mjs
```

Browser tests require the dev server at port 5173. All backend HTTP is mocked. The controls check exercises mobile emulation with real multi-touch pointer events and a simulated standard gamepad, including fullscreen, portrait fallback, controller-to-mouse switching and restarting. Other checks use real WebGL and Pointer Lock, test suction, ramps in both directions, both crate interactions, mute, released-mouse expiry, score accounting, results, reset and viewport scaling. The full-round test uses keyboard movement and runs a genuine 60-second round. Screenshots and JSON reports are written to ignored `test-results/`.

Development-only QA helpers are enabled with `?qa`; they are removed from production builds. A software-only graphics environment is not representative of normal desktop performance. See `docs/verification.md` for measured results and remaining manual playtesting.

## Project map

`main.ts` composes the game. `rendering.ts`, `assets.ts` and `arena.ts` build the world; `terrain.ts`, `player.ts` and `springboards.ts` handle movement; `coins.ts`, `spatial.ts`, `vacuum.ts` and `destructibles.ts` handle collectibles; `effects.ts` and `audio.ts` provide feedback; `ui.ts` and `pixel-font.ts` draw the interface; `round.ts` owns round state; `supagame.ts` owns the integration boundary.

## Assets

KayKit Bits Bundle 2 by **Kay Lousberg** (CC0). Selected glTF files, original buffers and palette textures are copied into `public/assets/`; the full supplied source bundle remains untouched and is excluded from Git/build output. License: `public/assets/KayKit-LICENSE.txt`.

Live Leaderboards now appears on the title screen through the Supagame SDK.
See [setup, lifecycle, tests and hosted deployment](docs/live-leaderboards.md).
