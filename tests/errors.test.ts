import { describe, expect, it } from "vitest";

import {
  CifStructureError,
  CifSyntaxError,
  SpaceGroupLookupError,
  SymmetryAnalysisError,
  buildScene,
  ensureMoyo,
  operationsForSpaceGroup,
  parseCif,
  parseCifStructure,
  parseSymmetryOperation,
  readCif,
  structureElements,
  symmetryDataset,
} from "../src/index.js";

/** A two-site cubic cell listed in P1, naming no symmetry at all. */
const P1 = `data_nacl
_cell_length_a 4
_cell_length_b 4
_cell_length_c 4
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Na1 Na 0 0 0
Cl1 Cl 0.5 0.5 0.5
`;

function block(text: string) {
  const [first] = parseCif(text).blocks;
  if (!first) {
    throw new Error("no block");
  }
  return first;
}

describe("CifSyntaxError", () => {
  it("names the line of an unterminated quoted string", () => {
    const text = "data_t\n_a 'unterminated\n";
    expect(() => parseCif(text)).toThrow(CifSyntaxError);
    expect(() => parseCif(text)).toThrow(/^CIF line 2:/);
    try {
      parseCif(text);
    } catch (error) {
      expect((error as CifSyntaxError).line).toBe(2);
      expect((error as CifSyntaxError).name).toBe("CifSyntaxError");
    }
  });

  it("rejects a loop whose values do not fill its rows", () => {
    expect(() => parseCif("data_t\nloop_\n_a\n_b\n1 2 3\n")).toThrow(
      CifSyntaxError,
    );
  });

  it("rejects a tag without a value and a value without a tag", () => {
    expect(() => parseCif("data_t\n_a\n")).toThrow(CifSyntaxError);
    expect(() => parseCif("data_t\n_a 1\nstray\n")).toThrow(CifSyntaxError);
  });
});

describe("CifStructureError", () => {
  it("is thrown for a block without a cell", () => {
    const text = P1.replace(/_cell_length_a 4\n/, "");
    expect(() => parseCifStructure(block(text))).toThrow(CifStructureError);
    expect(() => parseCifStructure(block(text))).toThrow(/_cell_length_a/);
  });

  it("is thrown for a block without atom sites", () => {
    const text = P1.slice(0, P1.indexOf("loop_"));
    expect(() => parseCifStructure(block(text))).toThrow(CifStructureError);
    expect(() => parseCifStructure(block(text))).toThrow(/no atom sites/);
  });

  it("is thrown for a site that names no element", () => {
    const text = P1.replace("Na1 Na 0 0 0", "Xx1 Xx 0 0 0");
    expect(() => parseCifStructure(block(text))).toThrow(CifStructureError);
    expect(() => parseCifStructure(block(text))).toThrow(/names no element/);
  });

  it("is thrown when no site has coordinates", () => {
    const text = P1.replace("Na1 Na 0 0 0", "Na1 Na ? ? ?").replace(
      "Cl1 Cl 0.5 0.5 0.5",
      "Cl1 Cl ? ? ?",
    );
    expect(() => parseCifStructure(block(text))).toThrow(CifStructureError);
    expect(() => parseCifStructure(block(text))).toThrow(/coordinates/);
  });

  it("is thrown for operations that cannot be read", () => {
    expect(() => parseSymmetryOperation("x, y")).toThrow(CifStructureError);
    expect(() => parseSymmetryOperation("x, y")).toThrow(/three components/);
    expect(() => parseSymmetryOperation("x, y, ++z")).toThrow(
      CifStructureError,
    );
    expect(() => parseSymmetryOperation("x, y, 1.2.3+z")).toThrow(
      CifStructureError,
    );
    expect(() => parseSymmetryOperation("x+1/0, y, z")).toThrow(
      CifStructureError,
    );
  });

  it("reaches readCif from an operation loop", async () => {
    const text = `${P1}loop_\n_space_group_symop_operation_xyz\n'x, y'\n`;
    await expect(readCif(text)).rejects.toBeInstanceOf(CifStructureError);
  });

  it("is thrown by readCif for text without a data block", async () => {
    await expect(readCif("")).rejects.toBeInstanceOf(CifStructureError);
    await expect(readCif("# a comment\n")).rejects.toThrow(/no data block/);
  });
});

describe("SpaceGroupLookupError", () => {
  it("is thrown when nothing names the space group", async () => {
    await expect(
      operationsForSpaceGroup({ number: null, symbol: null, hallSymbol: null }),
    ).rejects.toBeInstanceOf(SpaceGroupLookupError);
  });

  it("is thrown for a symbol the table does not know", async () => {
    await expect(
      operationsForSpaceGroup({
        number: null,
        symbol: "Q 1 2 3",
        hallSymbol: null,
      }),
    ).rejects.toBeInstanceOf(SpaceGroupLookupError);
  });
});

describe("SymmetryAnalysisError", () => {
  it("is thrown when moyo cannot analyse the cell", async () => {
    const structure = await readCif(P1);
    const flat = {
      ...structure,
      lattice: {
        ...structure.lattice,
        vectors: [
          [1, 0, 0],
          [2, 0, 0],
          [3, 0, 0],
        ] as typeof structure.lattice.vectors,
      },
    };
    await expect(symmetryDataset(flat)).rejects.toBeInstanceOf(
      SymmetryAnalysisError,
    );
    await expect(symmetryDataset(flat)).rejects.toThrow(/moyo could not/);
  });
});

describe("readCif without symmetry tags", () => {
  it("takes the file as P1", async () => {
    const structure = await readCif(P1);
    expect(structure.operations).toHaveLength(1);
    expect(structure.spaceGroup).toEqual({
      number: null,
      symbol: null,
      hallSymbol: null,
    });
    expect(structureElements(structure)).toEqual(["Na", "Cl"]);
    expect(buildScene(structure, { imageAtoms: false }).atoms).toHaveLength(2);
    expect(buildScene(structure).atoms).toHaveLength(9);
  });

  it("skips a leading block without atoms", async () => {
    const text = `data_global\n_journal_name_full 'A journal'\n${P1}`;
    const structure = await readCif(text);
    expect(structure.sites).toHaveLength(2);
  });
});

describe("ensureMoyo", () => {
  it("instantiates the module once", async () => {
    const first = ensureMoyo();
    expect(ensureMoyo()).toBe(first);
    await expect(first).resolves.toBeUndefined();
  });
});
