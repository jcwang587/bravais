import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);
const MOYO_WASM_PATH = require.resolve("@spglib/moyo-wasm/moyo_wasm_bg.wasm");
const MOYO_WASM_MODULE_ID = "virtual:moyo-wasm";
/** How the wasm-bindgen glue looks for the binary when it is given none. */
const MOYO_GLUE_FALLBACK = "new URL('moyo_wasm_bg.wasm', import.meta.url)";

/**
 * Serve the moyo WebAssembly binary as a base64 string module. A page
 * loaded from file:// cannot fetch a sibling .wasm file, so the bundle
 * carries the binary and instantiates it from memory.
 *
 * The glue's own lookup of the binary is unreachable, since `ensureMoyo`
 * always hands it the bytes, but Vite would still inline a second copy of
 * the binary into it as a data: URL and double the bundle. The lookup is
 * cut out before Vite's asset handling sees it.
 */
export function inlineMoyoWasm(): Plugin {
  const resolvedId = `\0${MOYO_WASM_MODULE_ID}`;
  return {
    name: "bravais-inline-moyo-wasm",
    enforce: "pre",
    resolveId(source) {
      return source === MOYO_WASM_MODULE_ID ? resolvedId : null;
    },
    load(id) {
      if (id !== resolvedId) {
        return null;
      }
      const base64 = readFileSync(MOYO_WASM_PATH).toString("base64");
      return `export default ${JSON.stringify(base64)};`;
    },
    transform(code, id) {
      if (!id.includes("@spglib/moyo-wasm/moyo_wasm.js")) {
        return null;
      }
      if (!code.includes(MOYO_GLUE_FALLBACK)) {
        this.error(
          "The moyo glue no longer locates its binary as expected; update MOYO_GLUE_FALLBACK.",
        );
      }
      return { code: code.replace(MOYO_GLUE_FALLBACK, "undefined"), map: null };
    },
  };
}

export default defineConfig({
  plugins: [inlineMoyoWasm()],
  build: {
    target: "es2022",
    sourcemap: true,
    // three.js is a peer dependency, not part of the bundle. The one addon
    // used, TrackballControls, is bundled, so `three` is the only bare import.
    rollupOptions: { external: ["three"] },
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => "bravais.js",
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
