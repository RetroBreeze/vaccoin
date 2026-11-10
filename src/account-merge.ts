import { COSMETICS, validateProgress, type Progress } from "./workshop-state";
/** Economy is selected as one internally consistent unit. No reward operations are replayed. */
export function mergeWorkshop(
  guest: unknown,
  cloud: unknown,
  economy: "guest" | "cloud",
): Progress {
  const g = validateProgress(guest),
    c = validateProgress(cloud);
  if (economy !== "guest" && economy !== "cloud")
    throw Error("CHOOSE WALLET SOURCE");
  const selected = economy === "guest" ? g : c;
  const applied = { ...c.applied };
  for (const [id, signature] of Object.entries(g.applied)) {
    if (Object.hasOwn(applied, id) && applied[id] !== signature)
      throw Error("OPERATION CONFLICT / KEEP ONE SAVE");
    Object.defineProperty(applied, id, {
      value: signature,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return validateProgress({
    ...selected,
    owned: COSMETICS.filter(
      (v) => g.owned.includes(v.id) || c.owned.includes(v.id),
    ).map((v) => v.id),
    applied,
  });
}
