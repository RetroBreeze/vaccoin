interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
const KEY = "vaccoin.display-name.v1";
function browserStorage(): StorageLike | undefined {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}
function normalize(value: string): string | undefined {
  const name = value.trim();
  const length = Array.from(name).length;
  return length >= 3 &&
    length <= 24 &&
    !/[\u0000-\u001f\u007f-\u009f]/.test(name)
    ? name
    : undefined;
}
export class DisplayName {
  name = "";
  private key = KEY;
  bind(scope: string, adoptLegacy = false) {
    this.key = `${KEY}:${scope}`;
    try { this.name = normalize(this.storage?.getItem(this.key) ?? "") ?? (adoptLegacy ? this.name : ""); }
    catch { if (!adoptLegacy) this.name = ""; }
  }
  constructor(private storage: StorageLike | undefined = browserStorage()) {
    try {
      this.name = normalize(storage?.getItem(KEY) ?? "") ?? "";
    } catch {
      // A name can still be chosen for this session.
    }
  }
  save(value: string): boolean {
    const name = normalize(value);
    if (!name) return false;
    this.name = name;
    try {
      this.storage?.setItem(this.key, name);
    } catch {
      // Storage is optional.
    }
    return true;
  }
}
