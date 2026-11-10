# Vacuum Workshop

The title screen and run results open the Canvas2D **Vacuum Workshop**. Earn cosmetic coins by completing a 60-second run, preview a design, buy it when affordable, and equip any owned design. Default is free; Brick Red costs 2,500, Chrome 6,000, Hazard 12,000, Neon 20,000 and Gold 35,000. The preview and first-person vacuum share their palette. Only materials change: geometry, suction, reach, speed, physics, score and achievement rules remain unchanged.

## Saved progression

The Supagame slot `vacuum-workshop`, schema version 1, stores total coins earned, current wallet, completed runs, owned/equipped cosmetics, mute preference and operation receipts. Existing players start at zero Workshop currency. Leaderboard scores and achievement records remain in their existing services, and old personal bests are never converted into lifetime earnings.

The existing Supabase client owns authentication and is shared with Cloud Saves. Supagame reuses an existing anonymous or permanent session; no login screen is introduced. IndexedDB records are keyed by project URL, authenticated player ID and slot. Auth changes stop synchronization of the old player's journal. The last known public player ID is cached only to locate that player's local progress while Auth is unreachable; it never authorizes a cloud request. Signing out clears the identity hint.

Local hydration happens before cloud synchronization and does not block gameplay with a loading screen. New runs can be journaled before remote hydration finishes. An initial cloud read must succeed or report a genuinely missing save before a first cloud write is prepared. A missing route, expired session, server outage or network error cannot cause an empty profile to replace valid remote progress.

## Exactly-once run rewards and purchases

Every run receives a secure UUID. HTTP LAN browsers use `crypto.getRandomValues` when `randomUUID` is unavailable. Results credit that run independently from leaderboard submission, so score retry/repeated results processing cannot add coins again.

Completed runs first enter a synchronous local recovery record, then an atomic IndexedDB journal, before network requests. A reload replays unfinished recovery entries. A prepared cloud write keeps its operation ID, expected revision and exact payload until acknowledged. A lost response can be retried without duplicating rewards or purchases. Operations arriving during an upload remain pending and are committed afterward.

Cloud conflicts trigger domain-specific replay: run IDs already credited remain credited once; buying an already owned cosmetic never spends twice; distinct affordable purchases are retained. No generic JSON merge is performed. If a conflicting wallet cannot fund a local purchase, the local owned design and pending journal remain intact, and the latest cloud copy is retained separately. **Export local copy** downloads recovery JSON. **Use cloud / archive local** explicitly selects cloud progress while retaining the local journal in an IndexedDB archive. Closing the game never silently chooses either copy.

Save status appears in the Workshop and on results. `OFFLINE / SAVED ON DEVICE` means a transport failure. Auth, validation, quotas and API outages are shown separately. Sync runs after an operation, on reconnect/focus, periodically while visible, or through **Sync now**. Purchases are durable before the UI reports success.

## Limitations

- This is cosmetic, client-controlled progression, not a cheat-resistant virtual economy. It cannot modify leaderboard standings or achievement unlocks.
- An unlinked anonymous identity is recoverable only while its Auth session survives. Linking an identity later can provide cross-device recovery, but no permanent-account UI is included here.
- First-ever offline play without any restored Auth identity uses a separate local guest Workshop. It is not silently transferred into another account. Reload after establishing the intended anonymous session to use cloud progress.
- Clearing browser storage removes the local queue and anonymous session. Browser storage/quota failures are surfaced rather than hidden.
- Retained operation receipts grow with lifetime runs; the current profile must fit the installed 1 MiB JSON limit. A future schema migration can compact receipts with an explicitly designed deduplication policy. Quota errors retain pending local state.
- Unsupported save schema versions stop sync and preserve the local copy. Deleting a cloud profile externally can require explicit recovery; stale local data is never automatically resurrected over its tombstone.
- The game retains its existing landscape gameplay guidance on touch devices.

## Local package integration

Dependencies are installed from `../supagame/artifacts/supagame-{contracts,sdk-ts,cli}-0.1.2.tgz`. `node scripts/verify-supagame-packages.mjs` compares installed code against both the archive bytes and the current Supagame build. Archive SHA-256 hashes are recorded in `docs/workshop-verification.md`; version numbers alone are not evidence of freshness.

## Deploying to the existing project

No hosted changes have been made by this implementation. From the Vaccoin repository with Node 24 and the locally installed CLIs on PATH:

```sh
npx supagame doctor
npx supagame deploy --project-ref ttwppnsnxcighfcesxhf --dry-run
npx supagame deploy --project-ref ttwppnsnxcighfcesxhf
npx supagame doctor --remote --project-ref ttwppnsnxcighfcesxhf
```

The migrations and runtime upgrade are staged locally. Review the full preview, including any unrelated previously pending migrations. The deploy command asks for explicit confirmation and preserves unrelated project configuration. Do not add `--allow-remote` unless intentionally authorizing unattended hosted changes. No manual bucket creation, PostgreSQL queries or Storage-policy setup are required.

For a different checkout where Cloud Saves is not yet staged, first run `npx supagame upgrade --dry-run`, `npx supagame upgrade`, then `npx supagame add cloud-saves`.
