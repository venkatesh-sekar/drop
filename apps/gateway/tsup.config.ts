import { defineConfig } from "tsup";

// @drop/core is published as TypeScript source, so it has to be bundled in.
// postgres and @aws-sdk/* stay external (passed on the CLI) and come from node_modules.
export default defineConfig({ noExternal: ["@drop/core"] });
