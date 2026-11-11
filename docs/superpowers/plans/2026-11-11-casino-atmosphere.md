# Golden Casino Atmosphere Implementation Plan

**Goal:** Give the compact casino warm light, contrast, glow and subtle life.
**Architecture:** One atmosphere module owns fixture placement, a static three-storey light atlas, material shading and lightweight animated halos/motes. Rendering sets fill/haze; main installs and updates atmosphere after world creation.
**Tech Stack:** Existing Three.js/TypeScript; no dependencies.
**Spec:** docs/superpowers/specs/2026-11-11-casino-atmosphere-design.md

- [x] Add deterministic fixture/light-field data and a focused contrast/floor-isolation regression.
- [x] Implement atlas shading for static and instanced world materials, depth-tested ceiling glows and subtle moving motes; tune ambient/fog.
- [x] Integrate after machine creation and update before render. Preserve gameplay and first-person readability.
- [x] Run full tests/build; inspect browser screenshots and WebGL errors, native size, collection/reset. Independent review, then refresh local preview. No commit/deployment.

## Paradise polish follow-up

- [x] Add `src/casino-spectacle.ts`: instanced neon outlines, chandelier tiers/crystals, staggered sparkle points and glowing text; integrate after atmosphere and update before render.
- [x] Extend existing atmosphere shader with gold-selective view highlights and gentle shimmer; preserve scene occlusion and collectible state.
- [x] Inspect final browser frames and shader errors, collection/reset/native buffer. Run full tests/build and independent review. Refresh local preview.

User signage correction also completed: shared solid panels and hangers, FrontSide text with independent back faces, outward doorway labels, eight actual stair approaches, wall advertising, column-supported main banner. Ray/UV regressions, 166 tests, build and browser views pass.
