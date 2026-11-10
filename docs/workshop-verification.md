# Vacuum Workshop verification — 10 November 2026

Verification used **Node v24.22.2** and the freshly installed Supagame 0.1.2 tarballs. Existing dependencies were not upgraded.

| Command | Result |
| --- | --- |
| `npm test` | 118 tests / 17 files passed in the working tree |
| `npm run build` | TypeScript and production Vite build passed; existing large-bundle warning remains |
| `node scripts/verify-supagame-packages.mjs` | All installed/build/archive files matched |
| `node scripts/workshop-browser-test.mjs` | Desktop, narrow layout and actual touch landscape; run credit, buy/equip, cloud restore, offline IndexedDB reload, reconnect and HTTP UUID fallback passed |
| `npm run test:browser` / `node scripts/browser-test.mjs` | Existing gameplay, controls, results and offline leaderboard checks passed |
| `npm run test:browser:live` / `node scripts/live-browser-test.mjs` | Desktop/mobile live snapshots and reconnect passed |
| `node scripts/achievements-browser-test.mjs` | Desktop/mobile achievement compatibility passed |
| `npx supagame upgrade --dry-run`, `npx supagame upgrade`, `npx supagame add cloud-saves`, `npx supagame doctor` | Local migration/runtime staging and file diagnostics passed |

Browser tests intercepted backend HTTP and Realtime traffic; they did not write to the hosted project. Real Auth/PostgreSQL/Storage integration was covered separately by Supagame's local integration and fresh-install E2E suites. Screenshots were inspected for the pixel UI and equipped viewmodel; they are generated under ignored `test-results/`.

The commit candidate was also exported into an isolated temporary directory without the pre-existing user edits. Its production build passed, and its 108 unit tests / 17 files passed. This establishes that the feature commit does not depend on those edits; the working tree retains them. Pre-existing untracked Supabase files remain untracked, including shared runtime files updated by the local CLI. They are reproducible with the installed CLI's `upgrade` command and were not swept into this commit.

## Archive SHA-256

```text
PASS contracts: 6 built files match archive and installed dependency; SHA-256 d42e4edc71ee062ec5631c71bfd9a14ea31369fc04b053eab96785ce74191ede
PASS sdk-ts: 60 built files match archive and installed dependency; SHA-256 500a86b1502bb8f80acd7add49f9c36c09b63ef39f5ff3ea70b8a8bd181097fe
PASS cli: 90 built files match archive and installed dependency; SHA-256 fa60f62cafa31a4f78adfc8810597de66e86b0bfc67dde33db3e392dcccb9f1b
```

## Limits and deployment

The wallet is client-controlled cosmetic state. No suction, radius, movement, score or physics changes were made. Run/purchase journals make retries idempotent; conflicting unaffordable purchases retain both copies for explicit resolution. Receipts grow with runs, anonymous-session loss limits recovery, and first-ever offline guest progress is not silently transferred into an account. See [Workshop documentation](workshop.md).

No hosted deployment, package publishing or push was performed. Hosted state is unverified. The local diagnostic reports existing `.env.local` precedence and unmanaged origin configuration as warnings without exposing their contents. Deploy commands and the exact project reference are documented in `workshop.md`.
