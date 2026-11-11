import { casinoLoot } from "./casino-loot";
import { VALUES, burstKind } from "./collectibles";
import { casinoMachines } from "./casino-layout";
export const LOOSE_COINS = casinoLoot.length;
export const SMALL_CRATE_COINS = 180;
export const LARGE_CRATE_COINS = 240;
export const TOTAL_COINS =
  LOOSE_COINS + casinoMachines.reduce((n, m) => n + m.coins, 0);
// Exact maximum possible score, independent of collection/burst order.
export const TOTAL_POINTS =
  casinoLoot.reduce((sum, item) => sum + VALUES[item.kind], 0) +
  casinoMachines.reduce(
    (total, m) =>
      total +
      Array.from({ length: m.coins }, (_, i) => VALUES[burstKind(i)]).reduce(
        (a, b) => a + b,
        0,
      ),
    0,
  );
