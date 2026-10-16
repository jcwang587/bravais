import { describe, expect, it } from "vitest";

import { typesetSymbol } from "../src/index.js";

describe("typeset Hermann-Mauguin symbols", () => {
  it("prints moyo's symbols the textbook way", () => {
    expect(typesetSymbol("F m -3 m")).toBe("Fm3\u0305m");
    expect(typesetSymbol("P 2_1/c")).toBe("P2\u2081/c");
    expect(typesetSymbol("P 4_2/m n m")).toBe("P4\u2082/mnm");
    expect(typesetSymbol("P -1")).toBe("P1\u0305");
    expect(typesetSymbol("R -3 m")).toBe("R3\u0305m");
    expect(typesetSymbol("P n m a")).toBe("Pnma");
    expect(typesetSymbol("P 2_1/n 2_1/m 2_1/a")).toBe(
      "P2\u2081/n2\u2081/m2\u2081/a",
    );
  });

  it("reads the run-together digits of CIF symbols and keeps settings", () => {
    expect(typesetSymbol("P 1 21/c 1")).toBe("P12\u2081/c1");
    expect(typesetSymbol("I 41/a m d :1")).toBe("I4\u2081/amd :1");
    expect(typesetSymbol("R -3 c :H")).toBe("R3\u0305c :H");
    expect(typesetSymbol("P 63/m m c")).toBe("P6\u2083/mmc");
    expect(typesetSymbol("F 4 3 2")).toBe("F432");
  });

  it("does not guess screw axes in symbols written without spaces", () => {
    expect(typesetSymbol("F432")).toBe("F432");
    expect(typesetSymbol("Fm-3m")).toBe("Fm3\u0305m");
    expect(typesetSymbol("P2_1/c")).toBe("P2\u2081/c");
  });
});
