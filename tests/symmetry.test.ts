import { describe, expect, it } from "vitest";

import { expandStructure, readCif, symmetryDataset } from "../src/index";
import { fixture } from "./helpers";

const FIXTURES = [
  "CoO-9008618.cif",
  "TiO2-9015662.cif",
  "Co3O4-9005887.cif",
  "CaTiO3-1567488.cif",
  "CaCO3-1547350.cif",
  "CoTiO3-5910080.cif",
  "CaSO4-2H2O-2300259.cif",
  "NaAlSi3O8-9001630.cif",
  "LiNiMnCoO2-4002443.cif",
  "aspirin-1515581.cif",
  "faujasite-1507214.cif",
];

describe("symmetry analysis", () => {
  it("names the standard setting whatever the file calls it", async () => {
    const perovskite = await symmetryDataset(
      await readCif(fixture("CaTiO3-1567488.cif")),
    );
    expect(perovskite.number).toBe(62);
    expect(perovskite.symbol).toBe("P n m a");
    expect(perovskite.fullSymbol).toBe("P 2_1/n 2_1/m 2_1/a");
    expect(perovskite.crystalSystem).toBe("Orthorhombic");

    const gypsum = await symmetryDataset(
      await readCif(fixture("CaSO4-2H2O-2300259.cif")),
    );
    expect(gypsum.number).toBe(15);
    expect(gypsum.symbol).toBe("C 2/c");
    expect(gypsum.setting).toBe("b1");

    const albite = await symmetryDataset(
      await readCif(fixture("NaAlSi3O8-9001630.cif")),
    );
    expect(albite.number).toBe(2);
    expect(albite.symbol).toBe("P -1");
    // The standard cell of a triclinic crystal is primitive: half the C cell.
    expect(albite.standard.sites).toHaveLength(26);
  });

  it("keeps the setting suffixes that matter", async () => {
    const spinel = await symmetryDataset(
      await readCif(fixture("Co3O4-9005887.cif")),
    );
    expect(spinel.symbol).toBe("F d -3 m");
    expect(spinel.setting).toBe("2");
    expect(spinel.hallSymbol).toBe("-F 4vw 2vw 3");

    const layered = await symmetryDataset(
      await readCif(fixture("LiNiMnCoO2-4002443.cif")),
    );
    expect(layered.symbol).toBe("R -3 m");
    expect(layered.setting).toBe("H");
  });

  it.each(FIXTURES)(
    "%s: agrees with the file's number and operation count",
    async (file) => {
      const structure = await readCif(fixture(file));
      const dataset = await symmetryDataset(structure);
      expect(dataset.number).toBe(structure.spaceGroup.number);
      expect(dataset.operations).toHaveLength(structure.operations.length);
      expect(dataset.wyckoffs).toHaveLength(dataset.structure.sites.length);
      expect(dataset.siteSymmetries).toHaveLength(
        dataset.structure.sites.length,
      );
    },
  );

  it("standardizes the cell and keeps the shared sites' species", async () => {
    const zeolite = await symmetryDataset(
      await readCif(fixture("faujasite-1507214.cif")),
    );
    expect(zeolite.standard.lattice.a).toBeCloseTo(24.946, 2);
    expect(zeolite.standard.lattice.alpha).toBeCloseTo(90, 6);
    expect(zeolite.standard.sites).toHaveLength(1008);
    const framework = zeolite.standard.sites.filter(
      (site) => site.species.length === 2,
    );
    expect(framework).toHaveLength(192);
    expect(framework[0]!.species).toEqual([
      { element: "Si", occupancy: 0.63 },
      { element: "Al", occupancy: 0.37 },
    ]);
    // The expansion lists the 192 framework positions first; they share one Wyckoff position.
    expect(new Set(zeolite.wyckoffs.slice(0, 192))).toEqual(new Set(["i"]));
    expect(expandStructure(zeolite.standard).sites).toHaveLength(1008);
  });
});
