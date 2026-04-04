import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    target: "node20",
    outDir: "dist",
    clean: true,
    sourcemap: true,
    banner: { js: "#!/usr/bin/env node" },
  },
  {
    entry: { server: "src/server.ts" },
    format: ["esm"],
    target: "node20",
    outDir: "dist",
    sourcemap: true,
    external: ["express", "ws", "@modelcontextprotocol/sdk", "zod"],
  },
]);
