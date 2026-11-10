export interface Cosmetic {
  id: string;
  name: string;
  cost: number;
  body: number;
  trim: number;
  dark: number;
  accent: number;
}
export const COSMETICS: readonly Cosmetic[] = [
  {
    id: "default",
    name: "DEFAULT",
    cost: 0,
    body: 0x5fe0bd,
    trim: 0xffe2ad,
    dark: 0x1b3544,
    accent: 0xf3a65a,
  },
  {
    id: "brick-red",
    name: "BRICK RED",
    cost: 2500,
    body: 0xb64b42,
    trim: 0xffd1a1,
    dark: 0x342c35,
    accent: 0xe9915d,
  },
  {
    id: "chrome",
    name: "CHROME",
    cost: 6000,
    body: 0xb5ccd4,
    trim: 0xf3f8eb,
    dark: 0x4a606f,
    accent: 0x6b99ae,
  },
  {
    id: "hazard",
    name: "HAZARD",
    cost: 12000,
    body: 0xe5b83b,
    trim: 0x222c33,
    dark: 0x151d24,
    accent: 0xf6e7a8,
  },
  {
    id: "neon",
    name: "NEON",
    cost: 20000,
    body: 0x8b4ebe,
    trim: 0x6cffe1,
    dark: 0x282543,
    accent: 0xf67fcb,
  },
  {
    id: "gold",
    name: "GOLD",
    cost: 35000,
    body: 0xdca838,
    trim: 0xffeb99,
    dark: 0x6a4930,
    accent: 0xf8cf56,
  },
];
export interface Progress {
  schemaVersion: 1;
  totalCoinsEarned: number;
  wallet: number;
  completedRuns: number;
  owned: string[];
  equipped: string;
  preferences: { muted: boolean };
  applied: Record<string, string>;
}
export type WorkshopOperation =
  | { id: string; type: "run"; coins: number }
  | { id: string; type: "purchase" | "equip"; cosmetic: string }
  | { id: string; type: "preference"; muted: boolean };
export function emptyProgress(): Progress {
  return {
    schemaVersion: 1,
    totalCoinsEarned: 0,
    wallet: 0,
    completedRuns: 0,
    owned: ["default"],
    equipped: "default",
    preferences: { muted: false },
    applied: {},
  };
}
export function validateProgress(data: unknown): Progress {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("INVALID WORKSHOP SAVE");
  const s = data as Progress;
  if (
    s.schemaVersion !== 1 ||
    ![s.wallet, s.totalCoinsEarned, s.completedRuns].every(
      (n) => Number.isSafeInteger(n) && n >= 0,
    ) ||
    s.wallet > s.totalCoinsEarned ||
    !Array.isArray(s.owned) ||
    !s.owned.includes("default") ||
    new Set(s.owned).size !== s.owned.length ||
    s.owned.some((id) => !COSMETICS.some((c) => c.id === id)) ||
    !s.owned.includes(s.equipped) ||
    typeof s.preferences?.muted !== "boolean" ||
    !s.applied ||
    typeof s.applied !== "object" ||
    Array.isArray(s.applied) ||
    Object.values(s.applied).some((v) => typeof v !== "string")
  )
    throw new Error("INVALID WORKSHOP SAVE");
  return structuredClone(s);
}
export function applyOperation(
  previous: Progress,
  op: WorkshopOperation,
): Progress {
  const state = validateProgress(previous),
    signature = JSON.stringify(op);
  if (!op.id || op.id.length > 100) throw new Error("INVALID OPERATION");
  if (Object.hasOwn(state.applied, op.id)) {
    if (state.applied[op.id] !== signature)
      throw new Error("OPERATION CONFLICT");
    return state;
  }
  if (op.type === "run") {
    if (!Number.isSafeInteger(op.coins) || op.coins < 0)
      throw new Error("INVALID RUN");
    state.wallet += op.coins;
    state.totalCoinsEarned += op.coins;
    state.completedRuns++;
  } else if (op.type === "preference") state.preferences.muted = op.muted;
  else {
    const cosmetic = COSMETICS.find((c) => c.id === op.cosmetic);
    if (!cosmetic) throw new Error("UNKNOWN DESIGN");
    if (op.type === "purchase" && !state.owned.includes(cosmetic.id)) {
      if (state.wallet < cosmetic.cost) throw new Error("NOT ENOUGH COINS");
      state.wallet -= cosmetic.cost;
      state.owned.push(cosmetic.id);
    }
    if (!state.owned.includes(cosmetic.id)) throw new Error("NOT OWNED");
    state.equipped = cosmetic.id;
  }
  state.applied[op.id] = signature;
  return validateProgress(state);
}
