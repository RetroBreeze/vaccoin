# Cloud save deletion

Vaccoin deletes `vacuum-workshop` using `game.saves.delete`, with explicit player identity, revision and durable operation ID. This slot contains owned/equipped cosmetics, wallet, total earned coins, completed runs, mute preference and operation deduplication records. Leaderboards, achievements and authentication are separate and are not mutated.

`vacuum-workshop-reset` is a coordination record, not gameplay progress. It retains a random reset token, deleting/ready phase and tombstone revision. Every updated client checks it before uploading. Gameplay writes carry the token in metadata; this closes the race where deletion and fresh play happen between another device's marker check and gameplay load. Devices discard old local queues, snapshots and run recovery on seeing a new token. Explicit Start Fresh is required. A round begun before a reset cannot award coins afterward.

Deletion intent is persisted before waiting for any running upload. The marker first blocks other updated clients; revision-checked deletion then removes the current save (an absent slot is first given an empty revision so delayed first uploads are fenced); the marker is finally marked ready. Network errors report an unconfirmed outcome, keep uploads blocked and allow the same operation IDs to be retried. Reload retains the intent. Concurrent publication conflicts allow another confirmed attempt rather than permanently pinning an obsolete revision. Start Fresh cannot clear an already active queue.

## Retention verified in existing Supagame implementation

Inspected SDK 0.1.4 (`packages/sdk-ts/src/saves.ts`), the copied edge handler (`supabase/functions/supagame/saves.ts`) and migration `20261110000306_save_revisions.sql`.

- Delete tombstones the live slot, increments its revision, clears its current payload/object reference and records an idempotent receipt. Ordinary load/list hide tombstones. CAS conflicts expose their revision.
- `backupExisting` defaults to false. This feature explicitly sends false; it does not create another historical snapshot.
- Existing historical snapshots are not purged by deletion. Up to five per slot are retained for up to 30 days; expiry pruning runs during save operations. `loadRevision` and `restore` can recover them, including over a tombstone. Operation receipts also remain.
- Referenced binary objects remain protected by retained revisions. Unreferenced objects are marked garbage and require cleanup; deletion is not synchronous physical object erasure.
- The SDK does **not** expose permanent purge of all historical revisions and binary objects. No permanent-erasure claim is made.
- Vaccoin stores no binary gameplay objects. An externally restored pre-reset workshop payload is detected by generation mismatch and is not silently replayed; the UI reports that it must be deleted again to start fresh.

## Compatibility and verification limits

The marker protocol protects updated Vaccoin clients. Previously loaded older versions do not understand it; users are told to update/reload other devices. The existing SDK/backend alone cannot enforce this application-specific reset fence against older or custom clients. No server deployment was performed.

Tests cover local reload, blocked autosaving, offline pending queues, lost deletion responses, fresh play, stale rounds, restored payload rejection, and two authenticated devices sharing cloud state, including an interleaved reset/load race. The browser test mounts the real account UI and Workshop with the SDK in a focused harness, using isolated browser contexts and mocked authenticated backend HTTP; it does not contact a hosted account. Real local Supagame database tests verify deletion, recoverable revisions, binary retention and restoration. No hosted or physical second-device test was performed.

## Verification run (2026-11-11)

- `npm test` and `npm run build` passed in the working workspace and in a temporary checkout of only the staged changes. Build reports the existing large-chunk warning.
- `node scripts/cloud-save-delete-browser-test.mjs` passed: real account UI/Workshop/SDK, IndexedDB reload, confirmation/cancel, separate authenticated contexts, reconnect and mobile screenshot.
- Supagame SDK save/offline-save/account-save suites: 32 passing tests.
- Local Supagame cloud-save/binary/recovery SQL suites: 83 passing assertions, including restoring a binary revision over a tombstone and protecting retained binary references.
- The full-game QA-page attempt in the dirty workspace timed out during startup before workshop hydration. Browser verification therefore uses the focused harness, not a claimed full-game end-to-end pass. No hosted account or physical second device was used.
