import { build } from "esbuild";

await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian"],
  format: "cjs",
  target: "es2020",
  outfile: "main.js",
  banner: { js: "/* Page Typography v1.0.0 | MIT License | Source: src/main.ts */" },
  logLevel: "info",
});
