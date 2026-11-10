# Vaccoin Supagame integration

`src/game-services.ts` initializes the installed Supabase client from `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, then calls `createGameServices({ supabase })`. Supabase owns browser session storage and token refresh. No credentials are committed.

The existing name screen starts `Leaderboard.connect(name)` in the background when confirmed. Returning names reconnect at boot. The SDK's `ensureAnonymousSession()` restores the current identity and refuses to replace an identity after authentication errors. `getMe()` checks the remote name before `updateMe()`; a failed update can be retried. The app never signs players out.

The existing round-expiry transition captures `round.score` once. The controller validates whole coin counts and the completed duration, freezes the run, creates one submission UUID, and calls `submit("vaccoin", score, uuid)`. Repeated completion notifications are coalesced. Deliberate retries preserve the score, UUID and original player; a timeout keeps the outstanding write in flight. The SDK may retry a lost HTTP response with the same UUID; server idempotency prevents duplicate attempts. Accepted scores are retained even when subsequent ranking requests fail. Ranking reads have bounded waits and can be retried independently.

The Canvas results screen displays final coins, server personal best and rank, and `getTop("vaccoin", { limit: 10 })` entries. `getMine("vaccoin")` supplies current personal best and rank. Local best is labelled separately when server data is unavailable. Loading, offline and retry states never block the Play Again button. Pending attempts are retained in memory during the page session; local best and anonymous credentials use browser persistence. Reloading does not automatically replay offline rounds.

## Verification

- `npm test`: focused session, name, immutable-score, deduplication, timeout, retry, rank, offline and Canvas rendering checks, alongside existing gameplay tests.
- `npx tsc --noEmit` and `npm run build`.
- `node scripts/leaderboard-test.mjs`: real SDK and browser flow against intercepted HTTP, including collected score, one submission, personal best, rank, top 10, restart and restored identity after reload.
- Existing browser scripts share `scripts/mock-backend.mjs` so no automated test can send fabricated scores to hosted Supagame. All external HTTP is intercepted before navigation.

No migrations, Edge Functions, hosting deployments or sibling-repository modifications are part of this change.

## Files included in the integration commit

- Client and game flow: `src/game-services.ts`, `src/supagame.ts`, `src/main.ts`, `src/ui.ts`, `src/style.css`.
- Existing name-screen and SDK prerequisites, preserved and included: `src/display-name.ts`, `index.html`, `package.json`, `package-lock.json`, `tests/display-name.test.ts`.
- Unit verification: `tests/anonymous-session.test.ts`, `tests/supagame-integration.test.ts`, `tests/results-ui.test.ts`, `tests/leaderboard.test.ts`.
- Browser verification and HTTP isolation: `scripts/mock-backend.mjs`, `scripts/leaderboard-test.mjs`, `scripts/browser-test.mjs`, `scripts/compatibility-test.mjs`, `scripts/explosions-test.mjs`, `scripts/full-round-test.mjs`, `scripts/production-test.mjs`, `scripts/springboards-test.mjs`.
- Documentation: `docs/supagame-integration.md`, `docs/superpowers/plans/2026-11-10-vaccoin-leaderboards.md`.

The pre-existing `supabase/` directory and `supagame.config.json` remain untouched and uncommitted. Assets are unchanged. No new dependencies were installed for this integration.

Final results: 57/57 unit tests pass; TypeScript passes; production build passes; all seven browser scripts pass (browser flow, leaderboard integration, production, full round, compatibility, explosions and springboards). The real full round collected and displayed 4,165 coins with no browser errors. Online and offline result screenshots were visually inspected. Vite reports a non-blocking warning for the 889.60 kB minified application bundle.
