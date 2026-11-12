const rewards: Readonly<Record<string, number>> = {
  chair: 4,
  "lounge-chair": 4,
  sofa: 6,
  coffee: 4,
  cocktail: 4,
  poker: 8,
  roulette: 8,
  blackjack: 8,
  "cash-table": 8,
  palm: 3,
  lamp: 2,
  trash: 2,
};

/** Furniture releases a small handful of ordinary, one-point coins. */
export function furnitureCoinReward(key: string): number {
  return Object.hasOwn(rewards, key) ? rewards[key] : 2;
}
