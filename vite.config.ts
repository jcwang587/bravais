import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);
const MOYO_WASM_PATH = require.resolve("@spglib/moyo-wasm/moyo_wasm_bg.wasm");
const MOYO_WASM_MODULE_ID = "virtual:moyo-wasm";

/**
 * Serve the moyo WebAssembly binary as a base64 string module. The renderer
 * runs from file://, where fetching a sibling .wasm file is not an option, so
 * the bundle carries the binary and instantiates it from memory.
 */
function inlineMoyoWasm(): Plugin {
  const resolvedId = `\0${MOYO_WASM_MODULE_ID}`;
  return {
    name: "bravais-inline-moyo-wasm",
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
  };
}

export default defineConfig({
  plugins: [inlineMoyoWasm()],
  build: {
    target: "es2022",
    sourcemap: true,
    // three.js is the consumer's: a peer dependency, not part of the bundle.
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
