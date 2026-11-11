import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const lockfile = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));

test("Supagame packages are vendored with verified lockfile integrity", () => {
  const files = {
    "@supagame/contracts": "supagame-contracts-0.1.4.tgz",
    "@supagame/sdk-ts": "supagame-sdk-ts-0.1.4.tgz",
    "@supagame/cli": "supagame-cli-0.1.6.tgz",
  };
  for (const [name, filename] of Object.entries(files)) {
    const spec = manifest.dependencies?.[name] ?? manifest.devDependencies?.[name];
    expect(spec).toBe(`file:vendor/${filename}`);
    const archive = fileURLToPath(new URL(`../vendor/${filename}`, import.meta.url));
    expect(existsSync(archive)).toBe(true);
    const actual = createHash("sha512").update(readFileSync(archive)).digest("base64");
    expect(lockfile.packages[`node_modules/${name}`].integrity).toBe(`sha512-${actual}`);
  }
});
