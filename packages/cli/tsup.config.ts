import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string;
};

export default defineConfig({
  entry: { drop: "src/index.ts" },
  format: ["esm"],
  target: "node20",
  platform: "node",
  clean: true,
  minify: false,
  sourcemap: false,
  splitting: false,
  noExternal: ["fflate"],
  banner: { js: "#!/usr/bin/env node" },
  define: { __DROP_VERSION__: JSON.stringify(pkg.version) },
  onSuccess: "chmod +x dist/drop.js",
});
