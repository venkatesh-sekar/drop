import { defineConfig } from "tsup";

export default defineConfig({
  entry: { "drop-mcp": "src/index.ts" },
  format: ["esm"],
  target: "node20",
  platform: "node",
  clean: true,
  sourcemap: false,
  splitting: false,
  banner: { js: "#!/usr/bin/env node" },
  onSuccess: "chmod +x dist/drop-mcp.js",
});
