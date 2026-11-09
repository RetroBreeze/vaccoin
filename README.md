# VACCOIN

**One vacuum. One minute. All the gold.**

A complete first-person browser arcade game built with TypeScript, Three.js, Vite and a separate Canvas2D pixel interface. Race through the mint, sky galleries and undervault, vacuum real coins, and smash containers to beat your personal best.

## Run locally

Requires Node.js 22.12+ (tested with Node 26) and a desktop browser with WebGL2, keyboard, mouse and Pointer Lock.

```sh
npm install
npm run dev
```

Open the URL printed by Vite (normally **http://localhost:5173**). Click **PLAY** to capture the mouse and enable audio.

```sh
npm run build       # strict TypeScript check and production bundle
npm run preview     # serve the production build locally
npm test            # deterministic simulation and integration-boundary tests
```

For a clean checkout with the committed lockfile, `npm ci` can replace `npm install`.

## Controls

| Input | Action |
|---|---|
| WASD | Move / strafe |
| Mouse | Look |
| Hold left mouse | Vacuum |
| Space | Jump |
| R | Restart immediately |
| Escape | Release mouse |
| M | Toggle sound |

The **60-second clock keeps running** when you release the mouse, switch tabs, or lose focus. Movement and suction stop until you resume. A restart abandons the previous run; only completed rounds update your best. There is no pause exploit.

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

## Supagame status

The adjacent `../supagame` repository was inspected. Its `packages/sdk-ts/package.json` explicitly reserves the TypeScript SDK for Task 10, and `src` contains only `.gitkeep`. There is no SDK implementation to call yet. Nothing in that repository was changed.

**This build is offline.** It does not authenticate with Supabase, submit online scores, or display fabricated standings. Personal bests are stored in `localStorage`; if storage is unavailable, the results screen explicitly says the best lasts only for this session.

`src/supagame.ts` contains a small **game-owned integration boundary**, not an invented Supagame API. Once the real SDK is available, implement `SupagameBridge` using its documented calls, then pass it to `Leaderboard`. The bridge must use the SDK's authentication/session reuse, profile names, score validation, idempotency and leaderboard reads. A completed round carries a unique `id`, its exact integer score, and a 60,000 ms duration. The adapter applies a timeout and reports failures honestly. Do not put service-role credentials in this game.

Provision the board through the real Supagame tooling when available:

- Title: **Vaccoin — Most Coins Collected**
- Ranking: **DESC**
- One best per player, anonymous Supabase authentication supported by the SDK, global standings and display names.
- Score bounds: 0–19,200; integer coin counts.

Client-side scores are **not inherently cheat-proof**. Server validation and idempotency do not prove that a client honestly played a round. No anti-cheat claim is made here.

## Verification

```sh
npx playwright install chromium
npm run dev -- --port 5173
# In a second terminal:
npm run test:browser
node scripts/full-round-test.mjs
node scripts/compatibility-test.mjs
```

Browser tests require the dev server at port 5173. They use real WebGL and Pointer Lock, test suction, ramps in both directions, both crate interactions, mute, released-mouse expiry, score accounting, results, reset and viewport scaling. The full-round test uses keyboard movement and runs a genuine 60-second round. Screenshots and JSON reports are written to ignored `test-results/`.

Development-only QA helpers are enabled with `?qa`; they are removed from production builds. A software-only graphics environment is not representative of normal desktop performance. See `docs/verification.md` for measured results and remaining manual playtesting.

## Project map

`main.ts` composes the game. `rendering.ts`, `assets.ts` and `arena.ts` build the world; `terrain.ts`, `player.ts` and `springboards.ts` handle movement; `coins.ts`, `spatial.ts`, `vacuum.ts` and `destructibles.ts` handle collectibles; `effects.ts` and `audio.ts` provide feedback; `ui.ts` and `pixel-font.ts` draw the interface; `round.ts` owns round state; `supagame.ts` owns the integration boundary.

## Assets

KayKit Bits Bundle 2 by **Kay Lousberg** (CC0). Selected glTF files, original buffers and palette textures are copied into `public/assets/`; the full supplied source bundle remains untouched and is excluded from Git/build output. License: `public/assets/KayKit-LICENSE.txt`.
