# Live title leaderboard

The title screen cycles through the top ten rows every three seconds, displaying
rank, name and score. The current player is gold. Rank movement and top-ten
entry/exit appear as short pixel-font notices. The SDK owns Realtime and HTTP
refreshes; Vaccoin only supplies callbacks. Session/profile/scoring rules and
assets are unchanged. The subscription is disposed when the document becomes
hidden or leaves the page, and refreshed when visible again.

Loading, empty, disconnected, reconnecting and request failures remain visible
in the title panel. On reconnect the SDK establishes a new rank baseline; it does
not announce movements missed while disconnected. Existing rows may remain
visible with an error/disconnected label. Broadcast is best-effort, not polling.

Local packages are installed from `../supagame/artifacts/*.tgz`. Rebuild/package
Supagame first, then reinstall the tarballs after changes. No npm publication is
needed. The CLI tarball now uses this durable sibling path instead of `/tmp`.

## Existing hosted project deployment (not performed)

Use Node 24 and Supabase CLI 3.0.0. In `~/Projects/vaccoin`:

```sh
npm install --save-dev --save-exact supabase@3.0.0 ../supagame/artifacts/supagame-cli-0.1.0.tgz
npx --no-install supagame init --project-ref ttwppnsnxcighfcesxhf --origin http://localhost:5173 --origin http://10.0.0.15:5173
npx --no-install supagame add live-leaderboards --dry-run
npx --no-install supagame add live-leaderboards
npx --no-install supagame doctor
npx --no-install supagame deploy --project-ref ttwppnsnxcighfcesxhf --dry-run
```

Review and commit the staged migration and module manifest together with the
existing Supabase installation files. Those files were already untracked before
this feature pass and were not adopted into its Git commit.

The updated CLI previews and manages anonymous Auth and browser origins, checks
Realtime database prerequisites, and stages the module's triggers/private-channel
policies. It preserves global Realtime settings and unrelated project configuration.
No hosted setting has been changed by this implementation.

Read-only validation on 10 November 2026 found Core and Leaderboards deployed,
with Live Leaderboards still pending. In disposable staging, the two origins above
matched the hosted origin digest and exactly one module migration was pending.
Doctor correctly reports missing live objects until deployment, and distinguishes
unverified hosted service/WebSocket health from database prerequisites. A function
redeploy is proposed when the previous receipt cannot prove the current code matches.

After reviewing **all** pending migrations and the exact project reference, run:

```sh
npx --no-install supagame deploy --project-ref ttwppnsnxcighfcesxhf
npx --no-install supagame doctor --remote --project-ref ttwppnsnxcighfcesxhf
```

The deploy command requires interactive confirmation. Do not use `--allow-remote`
unless you deliberately authorize unattended hosted changes. Test with real
gameplay in two browser sessions, observing the title leaderboard update when a
personal best improves; never manufacture hosted scores for automated tests.

## Checks

`npm test`, `npm run build`, `npm run test:browser` cover the game regression suite.
With Vite running, `node scripts/live-browser-test.mjs` mocks all backend HTTP and
Realtime sockets and saves desktop/mobile screenshots in `test-results/`.
Set `VACCOIN_TEST_URL` to use a port other than 5173. Unit tests cover live
snapshots, status/error handling, disposal, rolling rows and rank notices.
