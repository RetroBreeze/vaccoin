# Vaccoin casino rebuild

The user approved the three-storey atrium-and-wings mockup and explicitly requested implementation. Preserve first-person movement, vacuum collection and the real-time 60-second round. Rebuild the playable environment using the three supplied PSX casino packs.

## Layout

Three substantial storeys: public casino at ground level; private salons above; counting, storage and bullion rooms below. Twelve main rooms surround a recognisable central atrium/hub. Separate walls, corridors, rear cross-passages and two stair cores connect wings. Upper balconies overlook the atrium and allow a drop shortcut. Each main room has multiple connections. Enclosed rooms and ornamented ceilings replace the open mint.

The selected approach is a grand atrium with branching, cross-connected wings. A pure labyrinth offered discovery but poor orientation; open terraces offered speed but insufficient separation. The approved hybrid supports route mastery and visual orientation.

Implementation dimensions are a builder decision: start with a 144 × 128 footprint and elevations -8, 0, 8. Measure traversability using the real player controller; normal collection should leave substantial areas unexplored after one minute. Visiting all rooms at maximum speed is a stretch goal, not a requirement that all treasure be collectible in one run.

## Collection and fairness

All valuables use the existing suction interaction. Coins, large coins, bills, bars, pearls and diamonds start at 1, 10, 25, 100, 250, 500 points. Values may be balanced by the implementer. Keep physical item counts separate from points. Fixed placements and fixed machine rewards; no reward randomness between runs. Slot machines burst under focused suction. Coins remain the dominant visible collectible.

Use distinct silhouettes, colours and rare-item feedback. Keep dense coin routes competitive with treasure detours. Preserve account/workshop data and leaderboard APIs; score validation must use total possible points rather than item count. Do not deploy remote configuration or reset historical scores as part of local implementation. Document the need for a separate casino leaderboard season before public release.

## Assets and architecture

Extract a curated Original PSX GLB subset from all three packs into public/assets/casino. Preserve source packs. Share static geometry/materials and batch by material and room where practical. Existing Three.js/TypeScript/Vite stack stays. Use native geometry for collectible silhouettes absent from the casino packs. No gambling mini-games, enemies, timers on doors, or waiting for lifts.

## Verification

Test floor transitions in both directions, wall/deck suction occlusion, deterministic resets and rewards, weighted scoring exactly once, burst/reset capacity and integration regressions. Build and run browser smoke checks with real WebGL, inspect screenshots of all floors, and document performance and remaining human playtest limits. Existing uncommitted account edits must remain intact.

## Approved follow-up

The user requested disabling low-resolution world rendering and restoring the original game's abundance of coins. Render at native viewport/device resolution. Increase loot density substantially with continuous coverage of rooms, corridors, walkways and stairs, preserving deterministic placements and scoring. Verify that moving players can continuously collect along connecting routes.

## Compact furnished rebuild (supersedes initial dimensions)

The user rejected the oversized, sparsely furnished layout. Rebuild to an 84 × 76 footprint (about one third the area), storeys -5, 0, 5 with 4.4m clear ceilings, twelve 24 × 22m rooms and a smaller atrium. Use closely spaced banks of machines, chairs, tables, lounge seating, palms, lamps and framed room entrances. Preserve clear aisles and connected routes, dense loot, Quarkery and native rendering. Remove camera-height architecture culling: no disappearing floors at balcony/stair transitions. Instance repeated slot machines and batch static furnishings; verify real navigation around furnishing and views across storeys.
