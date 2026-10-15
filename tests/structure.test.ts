import { describe, expect, it } from "vitest";

import {
  CifStructureError,
  buildScene,
  expandStructure,
  operationsForSpaceGroup,
  readCif,
} from "../src/index";
import { applyOperation } from "../src/cif/symmetry-operators";
import { periodicAtoms } from "../src/structure/images";
import { latticeFromParameters } from "../src/structure/lattice";
import type { Site } from "../src/structure/types";
import { fixture, withoutOperatorLoop } from "./helpers";

function composition(sites: Site[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const site of sites) {
    for (const species of site.species) {
      counts[species.element] =
        (counts[species.element] ?? 0) + species.occupancy;
    }
  }
  return counts;
}

describe("moyo", () => {
  it("returns row-major rotations (P4 has x,y,z -> -y,x,z)", async () => {
    const operations = await operationsForSpaceGroup({
      number: 75,
      symbol: null,
      hallSymbol: null,
    });
    expect(operations).toHaveLength(4);
    const images = operations.map((operation) =>
      applyOperation(operation, [0.1, 0.2, 0.3]).map((value) =>
        Number(value.toFixed(6)),
      ),
    );
    expect(images).toContainEqual([-0.2, 0.1, 0.3]);
  });

  it("resolves Hermann-Mauguin symbols in non-standard settings", async () => {
    expect(
      await operationsForSpaceGroup({
        number: null,
        symbol: "Icmm",
        hallSymbol: null,
      }),
    ).toHaveLength(16);
    expect(
      await operationsForSpaceGroup({
        number: null,
        symbol: "P 1 21/c 1",
        hallSymbol: null,
      }),
    ).toHaveLength(4);
    expect(
      await operationsForSpaceGroup({
        number: null,
        symbol: "Fm-3m",
        hallSymbol: null,
      }),
    ).toHaveLength(192);
    expect(
      await operationsForSpaceGroup({
        number: 166,
        symbol: "R -3 m :H",
        hallSymbol: null,
      }),
    ).toHaveLength(36);
    expect(
      await operationsForSpaceGroup({
        number: 166,
        symbol: "R -3 m :R",
        hallSymbol: null,
      }),
    ).toHaveLength(12);
    expect(
      await operationsForSpaceGroup({
        number: null,
        symbol: "R -3 m",
        hallSymbol: null,
      }),
    ).toHaveLength(36);
    expect(
      await operationsForSpaceGroup({
        number: null,
        symbol: null,
        hallSymbol: "-P 2yn",
      }),
    ).toHaveLength(4);
  });

  it("rejects unknown symbols", async () => {
    await expect(
      operationsForSpaceGroup({
        number: null,
        symbol: "Q 1 2 3",
        hallSymbol: null,
      }),
    ).rejects.toThrow(/not in the symmetry table/);
  });
});

describe("expansion", () => {
  it("expands rock-salt CoO to 8 atoms", async () => {
    const structure = await readCif(fixture("CoO-9008618.cif"));
    const expanded = expandStructure(structure);
    expect(expanded.sites).toHaveLength(8);
    expect(composition(expanded.sites)).toEqual({ Co: 4, O: 4 });
  });

  it("carries the shared occupancies of the layered oxide through the expansion", async () => {
    const structure = await readCif(fixture("LiNiMnCoO2-4002443.cif"));
    const counts = composition(expandStructure(structure).sites);
    expect(counts.O).toBe(6);
    // The metal site's refined occupancies add up to 1.0007 and are scaled to 1.
    expect(counts.Li).toBeCloseTo(3, 3);
    expect(counts.Co).toBeCloseTo(1, 2);
    expect(counts.Mn).toBeCloseTo(1, 2);
    expect(counts.Ni).toBeCloseTo(1, 2);
  });

  it("expands the zeolite's partly occupied sites to their full multiplicities", async () => {
    const structure = await readCif(fixture("faujasite-1507214.cif"));
    const expanded = expandStructure(structure);
    expect(expanded.sites).toHaveLength(1008);
    const counts = composition(expanded.sites);
    expect(counts.Si! + counts.Al!).toBeCloseTo(192, 6);
    expect(counts.O).toBe(384);
    // 71 sodium per cell in the formula; the refined occupancies sum a little short.
    expect(counts.Na).toBeGreaterThan(70);
    expect(counts.Na).toBeLessThan(71);
  });
});

describe("symmetry fit", () => {
  const cell = (a: number, alpha: number) => [
    `_cell_length_a ${a}`,
    `_cell_length_b ${a}`,
    `_cell_length_c ${a}`,
    `_cell_angle_alpha ${alpha}`,
    `_cell_angle_beta ${alpha}`,
    `_cell_angle_gamma ${alpha}`,
  ];
  const sites = (...rows: string[]) => [
    "loop_",
    "_atom_site_label",
    "_atom_site_fract_x",
    "_atom_site_fract_y",
    "_atom_site_fract_z",
    ...rows,
  ];

  it("reads the rhombohedral CoTiO3 entry on the axes its atoms fit", async () => {
    const structure = await readCif(fixture("CoTiO3-5910080.cif"));
    expect(structure.spaceGroup.symbol).toBe("R -3");
    expect(structure.operations).toHaveLength(6);
    expect(expandStructure(structure).sites).toHaveLength(10);
  });

  it("chooses the axes from the cell when the file lists an asymmetric unit", async () => {
    const rhombohedral = [
      "data_r",
      ...cell(5.49, 59.42),
      "_symmetry_space_group_name_H-M 'R -3'",
      ...sites("Ti1 0.142 0.142 0.142"),
    ].join("\n");
    const onRhombohedralAxes = await readCif(rhombohedral);
    expect(onRhombohedralAxes.operations).toHaveLength(6);
    expect(expandStructure(onRhombohedralAxes).sites).toHaveLength(2);

    const text = withoutOperatorLoop(fixture("CaCO3-1547350.cif"));
    const hexagonalNoSuffix = text.replace("'R -3 c :H'", "'R -3 c'");
    expect(hexagonalNoSuffix).not.toBe(text);
    const onHexagonalAxes = await readCif(hexagonalNoSuffix);
    expect(onHexagonalAxes.operations).toHaveLength(36);
    expect(expandStructure(onHexagonalAxes).sites).toHaveLength(30);
  });

  it("accepts a listing that is already expanded and closed under its operations", async () => {
    const text = [
      "data_p",
      ...cell(4, 90),
      "loop_",
      "_symmetry_equiv_pos_as_xyz",
      "'x, y, z'",
      "'-x, -y, -z'",
      ...sites("Co1 0.1 0.2 0.3", "Co2 0.9 0.8 0.7"),
    ].join("\n");
    expect(expandStructure(await readCif(text)).sites).toHaveLength(2);
  });

  it("refuses a listing that is already expanded but not closed under its operations", async () => {
    const text = [
      "data_p",
      ...cell(4, 90),
      "loop_",
      "_symmetry_equiv_pos_as_xyz",
      "'x, y, z'",
      "'-x, -y, -z'",
      "'x+1/2, y, z'",
      ...sites("Co1 0.1 0.2 0.3", "Co2 0.9 0.8 0.7"),
    ].join("\n");
    await expect(readCif(text)).rejects.toThrow(CifStructureError);
  });
});

describe("image atoms", () => {
  it("repeats corner, edge and face sites", () => {
    const sites: Site[] = [
      {
        label: "corner",
        species: [{ element: "Li", occupancy: 1 }],
        fractional: [0, 0, 0],
      },
      {
        label: "edge",
        species: [{ element: "Li", occupancy: 1 }],
        fractional: [0, 0.5, 0],
      },
      {
        label: "face",
        species: [{ element: "Li", occupancy: 1 }],
        fractional: [0.5, 0.99999, 0.5],
      },
      {
        label: "inside",
        species: [{ element: "Li", occupancy: 1 }],
        fractional: [0.5, 0.5, 0.5],
      },
    ];
    const bySite = [0, 1, 2, 3].map(
      (index) =>
        periodicAtoms(sites, true).filter((atom) => atom.siteIndex === index)
          .length,
    );
    expect(bySite).toEqual([8, 4, 2, 1]);
    expect(periodicAtoms(sites, false)).toHaveLength(4);
  });
});

describe("scene", () => {
  function bondPairs(scene: ReturnType<typeof buildScene>): string[] {
    return [
      ...new Set(
        scene.bonds.map((bond) =>
          [scene.atoms[bond.start]!.element, scene.atoms[bond.end]!.element]
            .sort()
            .join("-"),
        ),
      ),
    ].sort();
  }

  it("bonds CoO only across VESTA's Co-O pair, including the boundary images", async () => {
    const scene = buildScene(
      expandStructure(await readCif(fixture("CoO-9008618.cif"))),
    );
    expect(scene.elements).toEqual(["Co", "O"]);
    // Rock salt: the corner site appears at all eight corners, face sites twice.
    expect(scene.atoms.filter((atom) => !atom.isImage)).toHaveLength(8);
    expect(scene.atoms).toHaveLength(27);
    expect(bondPairs(scene)).toEqual(["Co-O"]);
    expect(scene.bonds.length).toBeGreaterThan(20);
  });

  it("bonds rutile only across Ti-O", async () => {
    const scene = buildScene(
      expandStructure(await readCif(fixture("TiO2-9015662.cif"))),
    );
    expect(bondPairs(scene)).toEqual(["O-Ti"]);
  });

  it("draws no metal-metal bonds in the layered oxide", async () => {
    const scene = buildScene(
      expandStructure(await readCif(fixture("LiNiMnCoO2-4002443.cif"))),
    );
    for (const pair of bondPairs(scene)) {
      expect(pair).toContain("O");
    }
    expect([...scene.elements].sort()).toEqual(["Co", "Li", "Mn", "Ni", "O"]);
  });

  it("bonds the water hydrogens of gypsum to oxygen", async () => {
    const scene = buildScene(
      expandStructure(await readCif(fixture("CaSO4-2H2O-2300259.cif"))),
    );
    expect(bondPairs(scene)).toContain("H-O");
    expect(scene.elements).toEqual(["Ca", "S", "O", "H"]);
  });

  it("builds a cubic lattice along the pymatgen convention", () => {
    const lattice = latticeFromParameters({
      a: 2,
      b: 3,
      c: 4,
      alpha: 90,
      beta: 90,
      gamma: 90,
    });
    expect(lattice.vectors[0].map((v) => Number(v.toFixed(9)))).toEqual([
      2, 0, 0,
    ]);
    expect(lattice.vectors[1].map((v) => Number(v.toFixed(9)))).toEqual([
      0, 3, 0,
    ]);
    expect(lattice.vectors[2]).toEqual([0, 0, 4]);
  });
});
