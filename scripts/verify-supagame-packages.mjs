import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
for (const name of ["contracts", "sdk-ts", "cli"]) {
  const archive = `../supagame/artifacts/supagame-${name}-0.1.2.tgz`;
  const entries = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter((p) => p.startsWith("package/dist/") && !p.endsWith("/"));
  for (const path of entries) {
    const bytes = execFileSync("tar", ["-xOf", archive, path], {
      maxBuffer: 16 * 1024 * 1024,
    });
    const relative = path.slice("package/".length);
    assert.deepEqual(
      readFileSync(`node_modules/@supagame/${name}/${relative}`),
      bytes,
      `${name}/${relative}: installed package is stale`,
    );
    assert.deepEqual(
      readFileSync(`../supagame/packages/${name}/${relative}`),
      bytes,
      `${name}/${relative}: tarball is stale`,
    );
  }
  console.log(
    `PASS ${name}: ${entries.length} built files match archive and installed dependency; SHA-256 ${createHash("sha256").update(readFileSync(archive)).digest("hex")}`,
  );
}
