# Title Screen Implementation Plan

> Execute inline using superpowers:executing-plans.

**Goal:** Implement the approved animated title screen.
**Architecture:** A dedicated canvas title renderer shares responsive geometry with the name input. Existing UI controls and live rankings remain authoritative.
**Tech Stack:** TypeScript, Canvas, Vite, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-11-10-title-redesign.md

- [x] Add responsive geometry and title renderer: falling coins, pixel logo, left menu, pinned champion and continuously rolling ranks 2–10.
- [x] Integrate UI and name input, preserving leaderboard browser and play actions.
- [x] Verify empty/reconnecting rankings, long names, reduced motion, desktop/narrow layout and keyboard controls with existing tests, build and browser checks.

Ruling: Work in the current workspace to preserve the user's untracked backend setup; no commits or branch changes requested. This is a reversible visual change, so reuse and adapt existing meaningful regression checks rather than add implementation-mirroring tests.

Validation: 93 unit tests pass; TypeScript and production build pass; mocked browser test passes desktop/narrow layout, keyboard navigation, top ten, nearby standings, retry and back. Screenshots saved to test-results/title-redesign-desktop.png and title-redesign-narrow.png. Pixel-font player marker now uses supported [YOU] brackets. Existing Vite bundle-size warning remains.
