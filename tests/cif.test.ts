import { describe, expect, it } from "vitest";

import {
  parseCif,
  parseCifStructure,
  parseSymmetryOperation,
} from "../src/index.js";
import { parseCifNumber } from "../src/cif/parser.js";
import { tokenizeCif } from "../src/cif/tokenizer.js";
import { fixture } from "./helpers.js";

describe("tokenizer", () => {
  it("keeps apostrophes inside quoted strings and drops comments", () => {
    const tokens = tokenizeCif("_a 'it's here' # comment\n_b \"two words\"\n");
    expect(tokens.map((token) => token.text)).toEqual([
      "_a",
      "it's here",
      "_b",
      "two words",
    ]);
  });

  it("joins text fields and accepts tags after loop_ on one line", () => {
    const text = "loop_ _x _y\n1 2\n3 4\n_note\n;\nline one\nline two\n;\n";
    const tokens = tokenizeCif(text);
    expect(tokens.map((token) => token.kind)).toEqual([
      "loop",
      "tag",
      "tag",
      "value",
      "value",
      "value",
      "value",
      "tag",
      "value",
    ]);
    expect(tokens.at(-1)?.text).toBe("\nline one\nline two");
  });
});

describe("parser", () => {
  it("reads items, loops and numbers with uncertainties", () => {
    const document = parseCif(
      "data_t\n_cell_length_a 5.6148(6)\nloop_\n_s_id\n_s_xyz\n1 'x, y, z'\n2 '-x, -y, -z'\n",
    );
    const block = document.blocks[0]!;
    expect(block.name).toBe("t");
    expect(parseCifNumber(block.get("_CELL_LENGTH_A"))).toBeCloseTo(5.6148, 6);
    expect(block.findLoop("_s_xyz")?.rows).toEqual([
      ["1", "x, y, z"],
      ["2", "-x, -y, -z"],
    ]);
    expect(parseCifNumber("?")).toBeNull();
  });

  it("parses symmetry operations with fractions and decimals", () => {
    expect(parseSymmetryOperation("-x+1/2, y, -z+1/2")).toEqual({
      rotation: [-1, 0, 0, 0, 1, 0, 0, 0, -1],
      translation: [0.5, 0, 0.5],
    });
    const hexagonal = parseSymmetryOperation("2/3+x,1/3+y,1/3+z");
    expect(hexagonal.translation[0]).toBeCloseTo(2 / 3, 9);
    expect(parseSymmetryOperation("x-y, x, z+0.5").rotation).toEqual([
      1, -1, 0, 1, 0, 0, 0, 0, 1,
    ]);
    expect(parseSymmetryOperation("x, -y+1/2t, -z").translation).toEqual([
      0, 0.5, 0,
    ]);
  });
});

describe("structure from CIF", () => {
  it("reads CoO's lattice, sites and operations", () => {
    const block = parseCif(fixture("CoO-9008618.cif")).blocks[0]!;
    const parsed = parseCifStructure(block);
    expect(parsed.lattice.a).toBeCloseTo(4.2667, 6);
    expect(parsed.sites.map((site) => site.species[0]!.element)).toEqual([
      "Co",
      "O",
    ]);
    expect(parsed.operations?.length).toBe(192);
    expect(parsed.spaceGroup.number).toBe(225);
  });

  it("merges the cations sharing a site of the layered oxide, with the charge written after the number", () => {
    const block = parseCif(fixture("LiNiMnCoO2-4002443.cif")).blocks[0]!;
    const parsed = parseCifStructure(block);
    expect(parsed.sites).toHaveLength(3);
    const lithium = parsed.sites.find((site) => site.label === "Li1")!;
    expect(lithium.species).toEqual([
      { element: "Li", occupancy: 0.975 },
      { element: "Ni", occupancy: 0.025 },
    ]);
    const metal = parsed.sites.find((site) => site.label === "Co1")!;
    expect(metal.species.map((species) => species.element)).toEqual([
      "Co",
      "Mn",
      "Ni",
      "Li",
    ]);
    const total = metal.species.reduce((sum, s) => sum + s.occupancy, 0);
    expect(total).toBeCloseTo(1, 2);
  });

  it("keeps the vacancies of the zeolite's sodium sites and the Si/Al share of its framework site", () => {
    const block = parseCif(fixture("faujasite-1507214.cif")).blocks[0]!;
    const parsed = parseCifStructure(block);
    expect(parsed.sites).toHaveLength(12);
    const framework = parsed.sites.find((site) => site.label === "Si1")!;
    expect(framework.species).toEqual([
      { element: "Si", occupancy: 0.63 },
      { element: "Al", occupancy: 0.37 },
    ]);
    const sodium = parsed.sites.find((site) => site.label === "Na1")!;
    expect(sodium.species).toEqual([{ element: "Na", occupancy: 0.31 }]);
  });

  it("scales a site whose occupancies add up to more than one atom", () => {
    const text = [
      "data_t",
      "_cell_length_a 4",
      "_cell_length_b 4",
      "_cell_length_c 4",
      "_cell_angle_alpha 90",
      "_cell_angle_beta 90",
      "_cell_angle_gamma 90",
      "_symmetry_space_group_name_H-M 'P 1'",
      "loop_",
      "_atom_site_label",
      "_atom_site_type_symbol",
      "_atom_site_fract_x",
      "_atom_site_fract_y",
      "_atom_site_fract_z",
      "_atom_site_occupancy",
      "Ni1 Ni 0 0 0 1.03",
      "Co1 Co 0.5 0.5 0.5 0.8",
      "Ga1 Ga 0.5 0.5 0.5 0.4",
      "Fe1 Fe2+ 0.25 0.25 0.25 0.7",
      "Fe2 Fe3+ 0.25 0.25 0.25 0.5",
      "O1 O 0.75 0.75 0.75 1",
    ].join("\n");
    const parsed = parseCifStructure(parseCif(text).blocks[0]!);
    const occupancies = Object.fromEntries(
      parsed.sites.map((site) => [
        site.label,
        site.species.map((s) => [s.element, Number(s.occupancy.toFixed(4))]),
      ]),
    );
    expect(occupancies).toEqual({
      Ni1: [["Ni", 1]],
      Co1: [
        ["Co", 0.6667],
        ["Ga", 0.3333],
      ],
      Fe1: [["Fe", 1]],
      O1: [["O", 1]],
    });
  });

  it("reads non-standard settings as written, with their Hall symbols", () => {
    const gypsum = parseCifStructure(
      parseCif(fixture("CaSO4-2H2O-2300259.cif")).blocks[0]!,
    );
    expect(gypsum.spaceGroup).toEqual({
      number: 15,
      symbol: "I 1 2/c 1",
      hallSymbol: "-I 2yc",
    });
    const perovskite = parseCifStructure(
      parseCif(fixture("CaTiO3-1567488.cif")).blocks[0]!,
    );
    expect(perovskite.spaceGroup.symbol).toBe("P b n m");
    expect(perovskite.spaceGroup.hallSymbol).toBe("-P 2c 2ab");
  });
});
