# Golden casino atmosphere

The user wants the compact red casino to feel lively and golden, with depth instead of uniformly flat illumination. Preserve layout, deterministic loot, native resolution and readable routes.

Use warm ceiling fixtures, softly glowing halos, restrained animated marquee lights and drifting gold motes. Lower the uniform fill; bake localized warm pools into a small three-storey light atlas sampled by world materials, including instanced coins/machines. Keep fixtures and light pools aligned. Warm distance haze adds depth. These are implementation choices within the requested visual pass.

Approaches: many shadowed dynamic lights would be costly in this dense scene; a full-screen bloom stack adds render passes and can obscure coins. Use a baked light atlas and depth-tested additive halos instead. No extra shadow maps or full-scene bloom. Validate shader compilation and appearance at entrance, slot rows and balcony; check score/reset unchanged and native resolution preserved.

## Casino paradise polish

User requests an intentionally over-the-top final pass: sparkle, shine and neon. Add pink/cyan/champagne architectural neon, jackpot signs, tiered chandelier crystals and staggered star glints. Add view-dependent highlights selectively to gold-colored world surfaces and coins. Preserve the warm base palette, depth-tested occlusion, collection/reset and native rendering. Use instanced trim and point effects, with no new full-scene postprocessing or shadow passes. Keep decorative sparkle on architecture rather than leaving fake loot behind after pickup.
