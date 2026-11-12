# Furniture tumbling implementation plan

**Goal:** Let players run through furniture, tossing it aside for arcade fun; only vacuuming destroys props and pays coins.

**Architecture:** Preserve instancing and fixed-step simulation. Player contact keeps movement speed and launches lightweight per-prop motion. Original furniture collision is disabled after launch; tossed props bounce against architecture and floors, then sleep. No rigid-body dependency or prop-to-prop solver. Suction and rewards use current positions. Decorations detach when their supporting table is shoved. A new round restores every original transform and collider.

**Tech stack:** Existing TypeScript, Three.js, Vitest and Playwright.

- [x] Update contact/destruction tests for immediate shoves, no push rewards, settled vacuum targeting, detached decorations and reset.
- [x] Separate structural collision from furniture contact in terrain/player; add lightweight tumble state and simulation.
- [x] Render moving props about their center, preserving batched geometry and idle update skipping.
- [x] Update browser regression and README; verify focused tests, full suite, production build and browser behavior; request review.

Verified: 241 tests in the full suite plus the added renderer pivot/reset test; production build; browser checks for running speed, tumbling, no push rewards, moved-position vacuum destruction and restart. Review found no blocking issues. Horizontal collision uses a small proxy rather than full rigid-body geometry; wide tumbling props can slightly overlap walls, an accepted arcade approximation.
