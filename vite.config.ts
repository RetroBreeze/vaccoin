import { defineConfig } from "vite";
import { readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    {
      name: "exclude-source-asset-archives",
      apply: "build",
      async closeBundle() {
        // Vite copies public verbatim. Source ZIPs stay in public/assets, but do not
        // belong in the downloadable production artifact (over 650 MB).
        const assets = resolve("dist/assets");
        for (const name of await readdir(assets))
          if (name.endsWith(".zip")) await rm(resolve(assets, name));
      },
    },
  ],
});
