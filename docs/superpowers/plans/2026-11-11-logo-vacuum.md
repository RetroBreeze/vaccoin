# Logo vacuum implementation plan

Goal: reproduce public/assets/logo.png's purple flared head, gold mouth stripe, cyan coupling and lavender ribbed hose in reusable low-poly GLB geometry.

Architecture: Blender script produces material-batched geometry and a named muzzle socket. Three.js loads once, uses existing layer 1 rendering and workshop material colours. A separate visual pivot animates independently of the existing gameplay target.

Constraints: no gameplay, input, backend or dependency changes. Hidden surfaces complete the visible head/hose; no invented canister. Preserve default logo colours when switching back from cosmetics.

- [x] Generate GLB and reproducible Blender source script; inspect multiple angles.
- [x] Integrate cached loading, deterministic fallback, cosmetic materials and procedural sway/bob/recoil/landing motion.
- [x] Verify GLB structure, animation settling, target invariance, loading failure, aspect/FOV framing, browser gameplay and build.

Review focus: pre-load equip, failed asset request, portrait viewport, extreme FOV, airborne-to-ground transition. Existing user changes in Supagame files must remain untouched.

Verification: production build and 168 unit tests passed. GLB is byte-identical in dist. Browser asset checks passed for load reuse, failure fallback, FOV variants and three inspection angles; gameplay captures verified collection and exercised walk/jump/suction. The original full browser suite was interrupted after headless rendering timeouts.
The final combined screenshot rerun lost its browser during the portrait capture; focused asset-only checks passed independently.
