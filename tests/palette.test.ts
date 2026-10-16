import { beforeEach, describe, expect, it } from "vitest";

import { hexToOklab } from "../src/render/oklab.js";
import { ELEMENT_SYMBOLS } from "../src/structure/elements.js";
import {
  elementColor,
  elementColorAssignments,
  ensureElementColors,
  resetElementColors,
} from "../src/render/palette.js";

const BASE_COLORS: Record<string, string> = {
  O: "#e15949",
  Co: "#254fb4",
  Li: "#8cd37e",
  Ni: "#b2b6b8",
  Si: "#3a61cf",
  Cu: "#3b5fc6",
};

function separation(hexA: string, hexB: string): number {
  const a = hexToOklab(hexA);
  const b = hexToOklab(hexB);
  return Math.hypot((a.L - b.L) * 0.7, a.a - b.a, a.b - b.b);
}

function minSeparation(elements: string[]): number {
  let minimum = Infinity;
  for (let i = 0; i < elements.length; i += 1) {
    for (let j = i + 1; j < elements.length; j += 1) {
      minimum = Math.min(
        minimum,
        separation(elementColor(elements[i]!), elementColor(elements[j]!)),
      );
    }
  }
  return minimum;
}

describe("element palette", () => {
  beforeEach(() => resetElementColors());

  it("keeps the anchors when nothing collides", () => {
    ensureElementColors(["Li", "Fe", "P", "O"]);
    expect(elementColor("Li")).toBe(BASE_COLORS.Li);
    expect(elementColor("O")).toBe(BASE_COLORS.O);
  });

  it("separates every pair in structures with colliding anchors", () => {
    for (const elements of [
      ["Ru", "Cr", "Ni", "Mn", "Co", "O"],
      ["Sr", "Co", "Ga", "O"],
      ["Li", "Ni", "Mn", "Co", "O"],
      ["Si", "Cu", "O"],
      ["Li", "La", "Zr", "O"],
      ["Ni", "Ag", "Pd", "Pt"],
      ["N", "F", "Cl", "Sr", "Ba", "Zr"],
      [
        "Li",
        "Co",
        "Ni",
        "Mn",
        "Fe",
        "Cr",
        "V",
        "Ti",
        "Cu",
        "Zn",
        "Al",
        "Mg",
        "O",
      ],
    ]) {
      resetElementColors();
      ensureElementColors(elements);
      // Thirteen elements cannot all keep a full 0.1 inside the pastel band.
      const required = elements.length > 10 ? 0.085 : 0.1;
      expect(
        minSeparation(elements),
        elements.join(" "),
      ).toBeGreaterThanOrEqual(required);
    }
  });

  it("moves the less common element and keeps the more common one", () => {
    ensureElementColors(["Co", "Cr", "O"]);
    expect(elementColor("Co")).toBe(BASE_COLORS.Co);
    expect(elementColor("O")).toBe(BASE_COLORS.O);
    resetElementColors();
    ensureElementColors(["Cu", "Si"]);
    expect(elementColor("Si")).toBe(BASE_COLORS.Si);
    expect(elementColor("Cu")).not.toBe(BASE_COLORS.Cu);
  });

  it("is deterministic for the same set", () => {
    ensureElementColors(["Ru", "Cr", "Ni", "Mn", "Co", "O"]);
    const first = elementColorAssignments();
    resetElementColors();
    ensureElementColors(["O", "Co", "Mn", "Ni", "Cr", "Ru"]);
    expect(elementColorAssignments().sort()).toEqual(first.sort());
  });

  it("never recolours an element shown earlier in the session", () => {
    ensureElementColors(["Cu", "O"]);
    const copper = elementColor("Cu");
    expect(copper).toBe(BASE_COLORS.Cu);
    ensureElementColors(["Si", "O"]);
    expect(elementColor("Cu")).toBe(copper);
    expect(elementColor("Si")).not.toBe(BASE_COLORS.Si);
    expect(separation(elementColor("Si"), copper)).toBeGreaterThanOrEqual(0.1);
  });

  it("tints a grey that collides with another grey", () => {
    ensureElementColors(["Ni", "Ag"]);
    expect(elementColor("Ni")).toBe(BASE_COLORS.Ni);
    expect(
      separation(elementColor("Ag"), elementColor("Ni")),
    ).toBeGreaterThanOrEqual(0.1);
  });

  it("never repeats a colour, even with every element on screen", () => {
    ensureElementColors(ELEMENT_SYMBOLS);
    expect(minSeparation(ELEMENT_SYMBOLS)).toBeGreaterThan(0.04);
  });

  it("gives an element outside the base style a colour of its own", () => {
    ensureElementColors(["Og", "Lv", "O"]);
    expect(elementColor("Og")).toMatch(/^#[0-9a-f]{6}$/);
    expect(minSeparation(["Og", "Lv", "O"])).toBeGreaterThanOrEqual(0.1);
  });
});
