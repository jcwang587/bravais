import { describe, expect, it } from "vitest";

import {
  SpaceGroupLookupError,
  buildScene,
  expandStructure,
  parseCif,
  parseCifStructure,
  readCif,
} from "../src/index";
import { fixture } from "./helpers";

/**
 * The ten Crystallography Open Database entries under tests/fixtures, from
 * the simplest to the hardest: cubic rocksalt, tetragonal rutile, the spinel
 * in origin choice 2, the tilted perovskite in the Pbnm setting, calcite on
 * hexagonal axes, gypsum with its water hydrogens in the I2/c setting, a
 * centred triclinic feldspar, a layered oxide with three cations sharing a
 * site, an organic molecular crystal, and a dehydrated zeolite with Si/Al
 * disorder and partly occupied sodium sites. `atoms` counts the sites of
 * the whole cell before boundary images.
 */
const FIXTURES = [
  {
    file: "CoO-9008618.cif",
    symbol: "F m -3 m",
    number: 225,
    operations: 192,
    sites: 2,
    atoms: 8,
    elements: ["Co", "O"],
  },
  {
    file: "TiO2-9015662.cif",
    symbol: "P 42/m n m",
    number: 136,
    operations: 16,
    sites: 2,
    atoms: 6,
    elements: ["Ti", "O"],
  },
  {
    file: "Co3O4-9005887.cif",
    symbol: "F d -3 m :2",
    number: 227,
    operations: 192,
    sites: 3,
    atoms: 56,
    elements: ["Co", "O"],
  },
  {
    file: "CaTiO3-1567488.cif",
    symbol: "P b n m",
    number: 62,
    operations: 8,
    sites: 4,
    atoms: 20,
    elements: ["Ca", "Ti", "O"],
  },
  {
    file: "CaCO3-1547350.cif",
    symbol: "R -3 c :H",
    number: 167,
    operations: 36,
    sites: 3,
    atoms: 30,
    elements: ["Ca", "C", "O"],
  },
  {
    file: "CaSO4-2H2O-2300259.cif",
    symbol: "I 1 2/c 1",
    number: 15,
    operations: 8,
    sites: 7,
    atoms: 48,
    elements: ["Ca", "S", "O", "H"],
  },
  {
    file: "NaAlSi3O8-9001630.cif",
    symbol: "C -1",
    number: 2,
    operations: 4,
    sites: 13,
    atoms: 52,
    elements: ["Al", "Si", "Na", "O"],
  },
  {
    file: "LiNiMnCoO2-4002443.cif",
    symbol: "R -3 m :H",
    number: 166,
    operations: 36,
    sites: 3,
    atoms: 12,
    elements: ["Li", "Ni", "Co", "Mn", "O"],
  },
  {
    file: "aspirin-1515581.cif",
    symbol: "P 1 21/c 1",
    number: 14,
    operations: 4,
    sites: 21,
    atoms: 84,
    elements: ["O", "H", "C"],
  },
  {
    file: "faujasite-1507214.cif",
    symbol: "F d -3 m :2",
    number: 227,
    operations: 192,
    sites: 12,
    atoms: 1008,
    elements: ["Si", "Al", "O", "Na"],
  },
];

/** The CIF text without its symmetry-operator loop. */
function withoutOperatorLoop(text: string): string {
  return text.replace(
    /loop_\s*\n((?:\s*_\S+\s*\n)+)((?:(?!\s*loop_|\s*_)[^\n]*\n)+)/g,
    (block, tags: string) =>
      /_space_group_symop_operation_xyz|_symmetry_equiv_pos_as_xyz/.test(tags)
        ? ""
        : block,
  );
}

/** A site as "elements@x,y,z" with the position folded into the cell. */
function positionKey(site: {
  species: { element: string }[];
  fractional: number[];
}): string {
  const elements = site.species.map((species) => species.element).join("/");
  const position = site.fractional
    .map((value) => (((value % 1) + 1) % 1).toFixed(3))
    .join(",");
  return `${elements}@${position}`;
}

describe("COD fixtures", () => {
  it.each(FIXTURES)(
    "$file: reads, expands and builds a scene",
    async ({ file, symbol, number, operations, sites, atoms, elements }) => {
      const text = fixture(file);
      const parsed = parseCifStructure(parseCif(text).blocks[0]!);
      expect(parsed.spaceGroup.symbol).toBe(symbol);
      expect(parsed.spaceGroup.number).toBe(number);
      expect(parsed.operations).toHaveLength(operations);
      expect(parsed.sites).toHaveLength(sites);

      const expanded = expandStructure(await readCif(text));
      expect(expanded.sites).toHaveLength(atoms);

      const scene = buildScene(expanded);
      expect(scene.elements).toEqual(elements);
      expect(scene.atoms.filter((atom) => !atom.isImage)).toHaveLength(atoms);
      expect(scene.bonds.length).toBeGreaterThan(0);
    },
  );

  it.each(FIXTURES.filter((entry) => entry.symbol !== "C -1"))(
    "$file: moyo reproduces the file's operators from its symbol",
    async ({ file }) => {
      const text = fixture(file);
      const fromFile = expandStructure(await readCif(text));
      const fromMoyo = expandStructure(
        await readCif(withoutOperatorLoop(text)),
      );
      expect(new Set(fromMoyo.sites.map(positionKey))).toEqual(
        new Set(fromFile.sites.map(positionKey)),
      );
    },
  );

  it("needs the operator loop for the centred triclinic setting C -1", async () => {
    // C -1 is not a setting in the Hall table, so without the loop the
    // feldspar cannot be expanded. The loop is what makes the fixture work.
    const text = fixture("NaAlSi3O8-9001630.cif");
    await expect(readCif(withoutOperatorLoop(text))).rejects.toThrow(
      SpaceGroupLookupError,
    );
  });
});
