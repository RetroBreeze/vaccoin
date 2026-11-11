# Cloud Save Deletion Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Confirmed deletion of Vaccoin gameplay saves without stale-device resurrection.

**Architecture:** Use the existing SDK for a durable, account-scoped reset marker and revision-checked deletion. Persist deletion intent before network work; block gameplay writes until the reset is complete and the player explicitly starts fresh. Every sync checks the marker before replaying operations.

**Tech Stack:** TypeScript, Supagame SDK, Vitest, Canvas/native-button account UI.

**Spec:** User-approved design in this conversation, recorded below.

## Approved design and constraints
Delete cosmetics, wallet, statistics, preferences and operation records from the workshop slot; clear this device's pending writes and run recovery. Leave scores, achievements and authentication alone. Disclose recoverable history; never promise erasure. Use explicit confirmation, durable retry on uncertain outcomes, and explicit start fresh. Preserve all pre-existing work, commit only this task, and do not deploy.

## Review Focus
- Lost mutation responses must reuse operation IDs.
- Reload while deletion is pending must block uploads.
- A second authenticated device must discard its old queue on reconnect.
- A fresh cloud save must not accept stale offline operations.
- Retained backups and binary cleanup must be described accurately.

## Tasks
- [x] Add behavioral tests covering deletion, retries, reload, two-device reconnect and fresh play.
- [x] Implement reset coordination in src/workshop.ts using a dedicated non-progress marker slot and durable local state.
- [x] Add account actions and explicit confirmation/disclosure in src/accounts.ts and src/account-ui.ts.
- [x] Run tests and build; review task-only diff and commit requested changes.

## Execution notes
Implement inline in the existing working tree because the feature integrates with the user's uncommitted account UI. Snapshot touched dirty files and stage only the delta from those snapshots.
