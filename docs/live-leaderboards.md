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
npx --no-install supagame add live-leaderboards --dry-run
npx --no-install supagame add live-leaderboards
npx --no-install supagame doctor
npx --no-install supagame deploy --project-ref ttwppnsnxcighfcesxhf --dry-run
```

Review and commit the staged migration and module manifest together with the
existing Supabase installation files. Those files were already untracked before
this feature pass and were not adopted into its Git commit.

In that project's dashboard verify Realtime is enabled and private database
Broadcast is available. Review existing Realtime policies; broad permissive
receive policies combine with OR. Supabase recommends disabling public channel
access, but first check whether other project features need it. No hosted setting
has been changed by this implementation.

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
