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

## LAN results investigation (2026-11-10)

The original results screen inferred `LEADERBOARD OFFLINE` from any status
containing `UNAVAILABLE` when entries were empty. Any `canRetry && !loading`
state displayed `RETRY ONLINE`, including successful top-ten reads followed by
failed personal-best reads or submissions. The source transitions were:

- `connect`: missing configuration left the default unavailable status; session,
  profile, or deadline errors set `ONLINE UNAVAILABLE / PLAY IS READY`; either
  ranking read failing set `RANKINGS UNAVAILABLE`.
- `complete`/`send`: missing configuration saved locally with an unavailable
  status. Session/profile, identity, UUID, submission, or deadline failures before
  acceptance all became `ONLINE UNAVAILABLE / RETRY SCORE`. Read failures after
  acceptance became `SCORE SUBMITTED / RANKINGS UNAVAILABLE`.
- `refresh`: `Promise.allSettled` retained successful entries but returned one
  boolean combining top-ten and personal-best success, losing the failed
  operation and SDK error kind.
- `retry`: resent the current attempt or called `connect` before any completed
  attempt. Accepted attempts retried reads only; pending writes stayed coalesced.

Chromium reproduced a specific LAN-only failure before any score HTTP request:
`complete` created an empty key because HTTP LAN lacked `crypto.randomUUID`;
`send` then threw `Secure UUID unavailable`, caught and mislabeled as online
unavailability. On localhost, `isSecureContext` was true and `randomUUID` existed;
on `http://10.0.0.15:5173`, it was false and `randomUUID` was undefined while
`getRandomValues` remained available. Both origins successfully performed hosted
anonymous-session initialization, profile retrieval, top-ten retrieval, and a
null personal-best retrieval. No hosted score submissions were made. The reported
availability of `randomUUID` was not reproduced in the LAN page; if it exists in
another browser/context, that context's original failure cannot be attributed to
this missing-method path without its error. HTTP 200 alone does not establish
SDK success: response-contract validation can still fail.

Vaccoin now creates a secure RFC 4122 version 4 submission UUID with
`getRandomValues` when `randomUUID` is absent. The key is still generated once per
attempt and reused on deliberate retries. No IP checks or SDK changes are used.
Session, submission, and ranking stages report their own failures. SDK auth,
API/code, invalid request, invalid response, and network errors are distinguished;
only a transport failure with `navigator.onLine === false` is labeled offline.
Timeouts, missing configuration, and missing secure randomness have separate
messages. Public-read state supplies the empty-list text independently of other
operations. Retry labels identify session, score, or ranking work. Gameplay and
Canvas positions, colors, and button dimensions are preserved.

Verification for this fix:

- `npm test`: 83 tests passed, including secure UUID fallback/reuse, auth, API,
  malformed response, transport/offline, missing randomness, partial reads,
  retries, narrow simultaneous failures, and Canvas rendering regressions.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed; existing Vite bundle-size warning remains.
- `node scripts/leaderboard-test.mjs http://localhost:5173 http://10.0.0.15:5173`:
  both origins passed against intercepted backend HTTP using the installed SDK,
  including submission, restored identity, personal best, top ten, restart,
  reload, and an HTTP-200 malformed personal-best response that preserves the
  successful public leaderboard without an offline label.
