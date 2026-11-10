# Vaccoin accounts and Workshop recovery

The title screen's **ACCOUNT** control opens a Canvas pixel-art panel with accessible
native hit targets. Guests can **LINK GOOGLE** (retain player ID) or explicitly **SIGN IN
WITH GOOGLE** (recover another account). Permanent players see linked provider status
and **SIGN OUT**, with confirmation. Anonymous play remains available without registration
prompts. Sign-out is local to this browser; no account is deleted.

The game uses installed Supagame 0.1.3 tarballs, Supabase PKCE and a project-scoped durable
account store. It handles callbacks before starting Workshop synchronization. Before
leaving a guest, Workshop drains in-flight sync, retains pending operations and supplies
its latest snapshot to `game.saves.prepareAccountSwitch`. JSON snapshots survive the
OAuth redirect. Only the authenticated target's data appears in conflict comparisons.

The conflict panel shows wallet, lifetime earnings, completed runs, design count and
equipped vacuum. Choices are **KEEP GOOGLE PROGRESS**, **KEEP GUEST PROGRESS**, **MERGE
PROGRESS**, and **CANCEL**. Replacement requires a second confirmation. A revision
conflict offers **REVIEW LATEST CLOUD** and requires a fresh choice. **EXPORT RECOVERY**
downloads the guest and permitted target backup data without credentials.

Keep Google makes no cloud writes, archives the target's prior local queue and loads
its current cloud state. Keep Guest imports the guest's Workshop state into the Google
account without changing either Auth identity. The original guest remains untouched.
Cancel changes no saves and retains the snapshot; it cannot undo completed Google
sign-in. The choice panel stays open until the player chooses how to continue.

## Deterministic merge policy

The player explicitly chooses **USE GOOGLE WALLET** or **USE GUEST WALLET** before
confirming merge. That account contributes the **entire economy**: wallet balance,
total coins earned, completed-run count, equipped cosmetic and preferences. These values
are never summed or recomputed from the other account. This keeps wallet <= lifetime
earnings and does not pretend that overlapping histories can be reconstructed safely.

Owned cosmetics are unioned in catalog order. The selected equipped cosmetic remains
valid because its account's entire owned set is retained. All completed-run, purchase,
equip and preference operation identifiers/signatures are unioned **without replaying
operations**. Matching IDs/signatures deduplicate; a reused ID with different content
rejects merge and asks the player to keep one save. Rewards and purchases are not applied
a second time. Imported cosmetics are player-controlled game data, not server proof.

Leaderboards and achievements are never written from imported Workshop state. Recovery
restores the Google account's own server records. Same-ID Google linking retains all
existing records. A genuine runtime user change reloads the game, disposing old leaderboard
subscriptions/achievement queues and isolating pending runs. Local Workshop data, display
names and personal bests are namespaced by project/user.

## Configuration and testing

See [Supagame account documentation](../../supagame/docs/accounts.md) for complete SDK
examples and exact Google Cloud/Supabase setup. Create Google credentials yourself; do not
put them in `VITE_*`, source-controlled files, client bundles or test fixtures.

For this project the Google authorized callback is
`https://ttwppnsnxcighfcesxhf.supabase.co/auth/v1/callback`. Configure the game's actual
localhost/production application URLs separately using `supagame auth configure`, preview
first, and explicitly authorize hosted changes separately. Edge CORS origins remain a
separate configuration. This implementation did not modify hosted Supabase or Google Cloud.

```sh
npm test
npm run build
# Run Vite locally, then use its actual port:
ACCOUNTS_TEST_ORIGIN=http://127.0.0.1:5173 node scripts/accounts-browser-test.mjs
ACCOUNTS_TEST_ORIGIN=http://127.0.0.1:5173 node scripts/accounts-oauth-browser-test.mjs
```

Browser tests intercept every backend request and Realtime connection. They exercise
desktop/mobile controls and full mocked OAuth redirects for linking/Keep Cloud/Keep
Guest/merge. They do not authenticate with real Google. Real verification requires a
configured provider and a test Google account: record a guest's ID/progress, link it,
check ID preservation, recover it in another browser, then test conflict choices with a
second disposable guest.

Recovery backups remain on this browser in IndexedDB until explicitly discarded through
the SDK. Export before clearing browser storage. They are not hosted revision history.
The SDK supports bounded binary transfers; Vaccoin's Workshop slot is JSON. Missing
credentials, offline login, expired flow state, storage quota and conflicts surface errors
while preserving staged progress. Account recovery needs the linked provider; an unlinked
guest whose Supabase session is lost cannot be authenticated from a save export alone.
