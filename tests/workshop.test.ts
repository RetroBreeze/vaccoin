import { describe, it, expect } from "vitest";
import {
  emptyProgress,
  applyOperation,
  validateProgress,
  COSMETICS,
} from "../src/workshop-state";
describe("cosmetic progression", () => {
  it("starts clean, without deriving earnings from leaderboard scores", () => {
    expect(emptyProgress()).toMatchObject({
      wallet: 0,
      totalCoinsEarned: 0,
      completedRuns: 0,
      owned: ["default"],
      equipped: "default",
      schemaVersion: 1,
    });
  });
  it("credits each completed run exactly once, including after serialization", () => {
    const op = { id: "run-one", type: "run" as const, coins: 12000 };
    const first = applyOperation(emptyProgress(), op);
    expect(first).toMatchObject({
      wallet: 12000,
      totalCoinsEarned: 12000,
      completedRuns: 1,
    });
    expect(
      applyOperation(validateProgress(JSON.parse(JSON.stringify(first))), op),
    ).toEqual(first);
  });
  it("purchases affordably, equips owned cosmetics and never charges twice", () => {
    let s = applyOperation(emptyProgress(), {
      id: "run",
      type: "run",
      coins: 12000,
    });
    s = applyOperation(s, { id: "buy", type: "purchase", cosmetic: "chrome" });
    expect(s).toMatchObject({ wallet: 6000, equipped: "chrome" });
    expect(s.owned).toContain("chrome");
    expect(
      applyOperation(s, { id: "retry", type: "purchase", cosmetic: "chrome" })
        .wallet,
    ).toBe(6000);
    expect(() =>
      applyOperation(s, { id: "bad", type: "purchase", cosmetic: "gold" }),
    ).toThrow("NOT ENOUGH COINS");
    expect(() =>
      applyOperation(s, { id: "bad", type: "equip", cosmetic: "gold" }),
    ).toThrow("NOT OWNED");
    expect(
      applyOperation(s, { id: "equip", type: "equip", cosmetic: "default" })
        .equipped,
    ).toBe("default");
  });
  it("replays run and purchase operations against newer cloud progress without duplicating or losing purchases", () => {
    const reward = { id: "run", type: "run" as const, coins: 12000 };
    const buy = { id: "buy", type: "purchase" as const, cosmetic: "chrome" };
    let cloud = applyOperation(emptyProgress(), reward);
    cloud = applyOperation(cloud, {
      id: "red",
      type: "purchase",
      cosmetic: "brick-red",
    });
    cloud = applyOperation(cloud, reward);
    cloud = applyOperation(cloud, buy);
    expect(cloud.wallet).toBe(3500);
    expect(cloud.owned).toEqual(["default", "brick-red", "chrome"]);
    expect(cloud.completedRuns).toBe(1);
  });
  it("validates schema and unsafe numbers and keeps all designs cosmetic", () => {
    expect(() =>
      validateProgress({ ...emptyProgress(), schemaVersion: 2 }),
    ).toThrow();
    expect(() =>
      applyOperation(emptyProgress(), { id: "bad", type: "run", coins: NaN }),
    ).toThrow();
    expect(() =>
      validateProgress({ ...emptyProgress(), equipped: "gold" }),
    ).toThrow();
    expect(COSMETICS).toHaveLength(6);
    expect(COSMETICS.map((c) => c.cost)).toEqual([
      0, 2500, 6000, 12000, 20000, 35000,
    ]);
    for (const item of COSMETICS)
      expect(Object.keys(item).sort()).toEqual([
        "accent",
        "body",
        "cost",
        "coupler",
        "dark",
        "id",
        "name",
        "trim",
      ]);
  });
});
