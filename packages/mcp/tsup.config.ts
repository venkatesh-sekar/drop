import { defineConfig } from "tsup";

export default defineConfig({
  entry: { "drop-mcp": "src/index.ts" },
  format: ["esm"],
  target: "node20",
  platform: "node",
  clean: true,
  sourcemap: false,
  splitting: false,
  // One self-contained file, so the control app can serve it and `curl | sh` can install it.
  noExternal: [/.*/],
  banner: { js: "#!/usr/bin/env node" },
  onSuccess: "chmod +x dist/drop-mcp.js",
});
