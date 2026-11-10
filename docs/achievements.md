# Vaccoin achievements

Six permanent single-run achievements use the existing `vaccoin` descending
coin-score leaderboard: 500, 1,000, 5,000, 10,000, 15,000 and 20,000 coins.
A 12,000-coin accepted run awards the first four. Lifetime totals are never used.

Definitions live in `src/achievement-definitions.json` for offline display and in
`supagame.config.json` for provisioning. The generated migrations were produced
by `supagame achievement create`, not handwritten SQL. `run-coins-*` IDs are
stable. Icons use Vaccoin's pixel coin rendering.

The title screen's ACHIEVEMENTS button opens all six entries. The Supagame
headless notification queue holds awards during play and displays four-second
Canvas cards during results or on the title screen. Multiple awards appear in
threshold order. Escape/BACK returns to the title. Backend failures leave a
clear unavailable status and never claim local scores earned an achievement.

Historical accepted personal bests are backfilled during definition migration.
Those unlocks remain in the list but do not generate pop-ups. New awards come
only from accepted server-side score records. Lost anonymous identities retain
the same recovery limits as existing leaderboard identities.

## Local package and deployment workflow

This checkout uses inspected local 0.1.1 tarballs from `../supagame/artifacts`.
No npm publication is needed. The module, upgrade and six definition migrations
are already staged. Use Node 24 (the CLI's supported engine):

```sh
npm install
npx supagame doctor
npx supagame deploy --dry-run --project-ref ttwppnsnxcighfcesxhf
npx supagame deploy --project-ref ttwppnsnxcighfcesxhf
npx supagame doctor --remote --project-ref ttwppnsnxcighfcesxhf
```

Review the dry-run, then explicitly confirm the real deployment. Local tests do
not verify hosted delivery. Publish the updated game build through the existing
game hosting workflow only after backend verification; no hosting or Supabase
changes are performed by this implementation.

Browser checks intercept all backend requests, including Realtime. Run Vite on
127.0.0.1:5173, then `node scripts/achievements-browser-test.mjs` to verify desktop
and narrow-screen menus, four unlocks and FIFO notifications.
