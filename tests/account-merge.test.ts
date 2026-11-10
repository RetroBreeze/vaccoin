import { it, expect } from "vitest";
import { mergeWorkshop } from "../src/account-merge";
import { emptyProgress, applyOperation } from "../src/workshop-state";
const run = (id: string, coins: number) =>
  applyOperation(emptyProgress(), { id, type: "run", coins });
it("unions cosmetics and selects one whole economy without adding rewards", () => {
  const guest = applyOperation(run("guest", 10000), {
    id: "buy-guest",
    type: "purchase",
    cosmetic: "chrome",
  });
  const cloud = applyOperation(run("cloud", 5000), {
    id: "buy-cloud",
    type: "purchase",
    cosmetic: "brick-red",
  });
  const merged = mergeWorkshop(guest, cloud, "cloud");
  expect(merged.wallet).toBe(cloud.wallet);
  expect(merged.totalCoinsEarned).toBe(cloud.totalCoinsEarned);
  expect(merged.completedRuns).toBe(cloud.completedRuns);
  expect(merged.owned).toEqual(["default", "brick-red", "chrome"]);
  expect(merged.equipped).toBe("brick-red");
  expect(
    applyOperation(merged, { id: "guest", type: "run", coins: 10000 }),
  ).toEqual(merged);
  expect(
    applyOperation(merged, {
      id: "buy-guest",
      type: "purchase",
      cosmetic: "chrome",
    }),
  ).toEqual(merged);
});
it("supports explicit guest economy and refuses ambiguous operation ids", () => {
  expect(mergeWorkshop(run("a", 10), run("b", 20), "guest").wallet).toBe(10);
  expect(() =>
    mergeWorkshop(run("same", 10), run("same", 20), "cloud"),
  ).toThrow("OPERATION CONFLICT");
});
