import { defineConfig } from "vite";

import { inlineMoyoWasm } from "./vite.config";

/**
 * The demo page as a site of its own: `examples/` is the root, the test
 * structures are its public files (fetched as `./<name>.cif`), and the
 * build lands in `site/`, which GitHub Pages serves at https://jcwang.dev/bravais/.
 */
export default defineConfig(({ command, isPreview }) => ({
  root: "examples",
  publicDir: "../tests/fixtures",
  base: command === "build" || isPreview ? "/bravais/" : "/",
  plugins: [inlineMoyoWasm()],
  build: {
    target: "es2022",
    outDir: "../site",
    emptyOutDir: true,
  },
}));
