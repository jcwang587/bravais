import type * as MoyoBindings from "./moyo-wasm.js";

// Kept apart from moyo.ts so the published declarations never refer to the
// bindings, whose types come from a package consumers do not install.

let bindings: typeof MoyoBindings | null = null;
let loading: Promise<void> | null = null;

/**
 * Import the moyo chunk and instantiate its module, once. A failed attempt
 * is not kept: the next call tries again.
 */
export function loadMoyo(): Promise<void> {
  if (!loading) {
    loading = import("./moyo-wasm.js")
      .then(async (module) => {
        await module.instantiate();
        bindings = module;
      })
      .catch((error: unknown) => {
        loading = null;
        throw error;
      });
  }
  return loading;
}

/** The moyo bindings, once `loadMoyo` has resolved. */
export function moyo(): typeof MoyoBindings {
  if (!bindings) {
    throw new Error("moyo is not loaded yet; await ensureMoyo() first.");
  }
  return bindings;
}
