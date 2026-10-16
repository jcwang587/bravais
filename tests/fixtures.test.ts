import { describe, expect, it } from "vitest";

import {
  SpaceGroupLookupError,
  buildScene,
  expandStructure,
  parseCif,
  parseCifStructure,
  readCif,
} from "../src/index.js";
import { fixture, withoutOperatorLoop } from "./helpers.js";

/**
 * The eleven Crystallography Open Database entries under tests/fixtures, from
 * the simplest to the hardest: cubic rocksalt, tetragonal rutile, the spinel in
 * origin choice 2, the tilted perovskite in the Pbnm setting, calcite on
 * hexagonal axes, an ilmenite-type oxide on rhombohedral axes whose symbol
 * names no setting and which lists every atom of its cell with no operator
 * loop, gypsum with its water hydrogens in the I2/c setting, a centred
 * triclinic feldspar, a layered oxide with three cations sharing a site, an
 * organic molecular crystal, and a dehydrated zeolite with Si/Al disorder and
 * partly occupied sodium sites. `atoms` counts the sites of the whole cell
 * before boundary images; `loop` is false when the file has no operator loop
 * and `operations` counts what moyo supplies.
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
    file: "CoTiO3-5910080.cif",
    symbol: "R -3",
    number: 148,
    loop: false,
    operations: 6,
    sites: 10,
    atoms: 10,
    elements: ["Co", "Ti", "O"],
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
    async ({
      file,
      symbol,
      number,
      loop = true,
      operations,
      sites,
      atoms,
      elements,
    }) => {
      const text = fixture(file);
      const parsed = parseCifStructure(parseCif(text).blocks[0]!);
      expect(parsed.spaceGroup.symbol).toBe(symbol);
      expect(parsed.spaceGroup.number).toBe(number);
      if (loop) {
        expect(parsed.operations).toHaveLength(operations);
      } else {
        expect(parsed.operations).toBeNull();
      }
      expect(parsed.sites).toHaveLength(sites);

      const structure = await readCif(text);
      expect(structure.operations).toHaveLength(operations);
      const expanded = expandStructure(structure);
      expect(expanded.sites).toHaveLength(atoms);

      const scene = buildScene(expanded);
      expect(scene.elements).toEqual(elements);
      expect(scene.atoms.filter((atom) => !atom.isImage)).toHaveLength(atoms);
      expect(scene.bonds.length).toBeGreaterThan(0);
    },
  );

  it.each(
    FIXTURES.filter((entry) => entry.loop !== false && entry.symbol !== "C -1"),
  )(
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
