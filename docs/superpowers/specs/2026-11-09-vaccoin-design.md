# Vaccoin first implementation
The user's complete brief is the authority. Work autonomously in the supplied local checkout; no hosting or SDK repository mutations.

One 60-second FPS arcade round, WASD/mouse/space/LMB/R. Three connected elevations: warm central mint (0m), teal galleries (+6m), violet vault (-6m). Wide symmetric ramps and drops make a readable loop. Spawn faces dense gold. 12,000 loose coins plus 3,600 in destructibles; every physical coin gives exactly one point. Instanced KayKit gold geometry and original texture; custom slabs/ramps plus KayKit modular blocks, crates, gold and vault props. Greedy clustered placement is seeded and repeatable, not procedural room layout.

Custom swept support-floor collision, capped fixed physics steps, hash-grid queries for static coins, bounded active suction/ballistic coin pool. Generous forward field, increasingly fast attraction, curved approach into visible nozzle. Pooled particles, procedural motor and arpeggiated coin sound. Canvas2D bitmap font UI over a roughly 480x270 nearest-scaled scene. Wall-clock round expiry continues while unfocused or unlocked; input stops. Fast deterministic reset.

Supagame sibling inspected: packages/sdk-ts is an empty reserved package. Provide an explicitly offline adapter, local PB with safe storage failure, typed application boundary for a future real SDK bridge. No fake scores, HTTP reimplementation or browser secrets.

Alternatives considered: physics engine would add overhead for largely static terrain; independent Mesh coins would scale poorly. Use custom collision and instancing as required by the brief. User delegated design decisions and explicitly requested no approval stops.
