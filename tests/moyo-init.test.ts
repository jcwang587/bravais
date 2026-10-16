import { afterEach, expect, it, vi } from "vitest";

import { ensureMoyo, operationsForSpaceGroup } from "../src/index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

it("does not keep a failed instantiation", async () => {
  const instantiate = vi
    .spyOn(WebAssembly, "instantiate")
    .mockRejectedValueOnce(new Error("simulated wasm failure"));
  await expect(ensureMoyo()).rejects.toThrow("simulated wasm failure");
  expect(instantiate).toHaveBeenCalledTimes(1);
  instantiate.mockRestore();
  await expect(ensureMoyo()).resolves.toBeUndefined();
  const operations = await operationsForSpaceGroup({
    number: 225,
    symbol: null,
    hallSymbol: null,
  });
  expect(operations).toHaveLength(192);
});
