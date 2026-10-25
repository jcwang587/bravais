import { describe, expect, it } from "vitest";

import {
  CifStructureError,
  SpaceGroupLookupError,
  StructureDataError,
  StructureError,
  expandStructure,
  parseCif,
  parseCifStructure,
  readCif,
  readStructure,
  type Structure,
  type StructureData,
} from "../src/index.js";
import { fixture, fixtureNames } from "./helpers.js";

/** A cubic cell with one site per argument, given as [element, x, y, z]. */
function cubic(
  ...sites: [string, number, number, number][]
): Pick<StructureData, "lattice" | "sites"> {
  return {
    lattice: { a: 4, b: 4, c: 4, alpha: 90, beta: 90, gamma: 90 },
    sites: sites.map(([element, x, y, z]) => ({
      fractional: [x, y, z],
      species: [{ element }],
    })),
  };
}

/** What `readCif` reads from a fixture, written out as structure data. */
function asData(text: string): StructureData {
  const block = parseCif(text).blocks.find(
    (candidate) => candidate.findLoop("_atom_site_fract_x") !== null,
  )!;
  const { lattice, sites, operations, spaceGroup } = parseCifStructure(block);
  return {
    lattice: {
      a: lattice.a,
      b: lattice.b,
      c: lattice.c,
      alpha: lattice.alpha,
      beta: lattice.beta,
      gamma: lattice.gamma,
    },
    sites: sites.map(({ label, fractional, species }) => ({
      label,
      fractional,
      species,
    })),
    operations,
    spaceGroup,
  };
}

describe("readStructure", () => {
  it.each(fixtureNames())("reads %s as readCif does", async (name) => {
    const text = fixture(name);
    expect(await readStructure(asData(text))).toEqual(await readCif(text));
  });

  it.each(fixtureNames())(
    "reads a structure from %s after a JSON round trip",
    async (name) => {
      const structure = await readCif(fixture(name));
      const read = await readStructure(
        JSON.parse(JSON.stringify(structure)) as StructureData,
      );
      expect(read.sites).toEqual(structure.sites);
      expect(read.operations).toEqual(structure.operations);
      expect(read.spaceGroup).toEqual(structure.spaceGroup);
      expect(read.lattice.vectors).toEqual(structure.lattice.vectors);
      for (const key of ["a", "b", "c", "alpha", "beta", "gamma"] as const) {
        expect(read.lattice[key]).toBeCloseTo(structure.lattice[key], 9);
      }
    },
  );

  it("joins species listed one per row at a shared position into one site", async () => {
    const structure = await readStructure({
      ...cubic(),
      sites: [
        {
          label: "M1",
          fractional: [0, 0, 0],
          species: [{ element: "Li", occupancy: 0.25 }],
        },
        {
          label: "M2",
          fractional: [1, 1e-5, 0],
          species: [{ element: "Ni", occupancy: 0.75 }],
        },
        { fractional: [0.5, 0.5, 0.5], species: [{ element: "O" }] },
      ],
    });
    expect(structure.sites).toEqual([
      {
        label: "M1",
        fractional: [0, 0, 0],
        species: [
          { element: "Ni", occupancy: 0.75 },
          { element: "Li", occupancy: 0.25 },
        ],
      },
      {
        label: "site3",
        fractional: [0.5, 0.5, 0.5],
        species: [{ element: "O", occupancy: 1 }],
      },
    ]);
  });

  it("scales an overfull site to a full one", async () => {
    const structure = await readStructure({
      ...cubic(),
      sites: [
        {
          fractional: [0, 0, 0],
          species: [
            { element: "Fe", occupancy: 0.6 },
            { element: "Co", occupancy: 0.6 },
          ],
        },
      ],
    });
    const [site] = structure.sites;
    expect(site!.species.map((species) => species.occupancy)).toEqual([
      0.5, 0.5,
    ]);
  });

  it("reads operations written as strings or as matrices", async () => {
    const strings = await readStructure({
      ...cubic(["Co", 0.1, 0.2, 0.3]),
      operations: ["x, y, z", "-x, -y, -z"],
    });
    const matrices = await readStructure({
      ...cubic(["Co", 0.1, 0.2, 0.3]),
      operations: [
        { rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], translation: [0, 0, 0] },
        { rotation: [-1, 0, 0, 0, -1, 0, 0, 0, -1], translation: [1, 0, 0] },
      ],
    });
    expect(matrices.operations).toEqual(strings.operations);
    expect(expandStructure(strings).sites.map((site) => site.fractional))
      .toMatchInlineSnapshot(`
        [
          [
            0.1,
            0.2,
            0.3,
          ],
          [
            0.9,
            0.8,
            0.7,
          ],
        ]
      `);
  });

  it("takes the operations from the space group when none are given", async () => {
    const structure = await readStructure({
      lattice: { a: 4.26, b: 4.26, c: 4.26, alpha: 90, beta: 90, gamma: 90 },
      sites: [
        { label: "Co", fractional: [0, 0, 0], species: [{ element: "Co" }] },
        {
          label: "O",
          fractional: [0.5, 0.5, 0.5],
          species: [{ element: "O" }],
        },
      ],
      spaceGroup: { symbol: "F m -3 m" },
    });
    expect(structure.operations).toHaveLength(192);
    expect(structure.spaceGroup).toEqual({
      number: null,
      symbol: "F m -3 m",
      hallSymbol: null,
    });
    expect(expandStructure(structure).sites).toHaveLength(8);
  });

  it("reads the sites as every atom when nothing gives the symmetry", async () => {
    const structure = await readStructure(cubic(["Na", 0, 0, 0]));
    expect(structure.operations).toEqual([
      { rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], translation: [0, 0, 0] },
    ]);
  });

  it("builds the lattice from cell vectors as given", async () => {
    const vectors: Structure["lattice"]["vectors"] = [
      [3, 0, 0],
      [0, 4, 0],
      [0, 0, 5],
    ];
    const structure = await readStructure({
      lattice: { vectors },
      sites: [{ fractional: [0, 0, 0], species: [{ element: "Si" }] }],
    });
    expect(structure.lattice).toEqual({
      a: 3,
      b: 4,
      c: 5,
      alpha: 90,
      beta: 90,
      gamma: 90,
      vectors,
    });
  });

  it("accepts typed arrays, as structured clones of reader output carry them", async () => {
    const structure = await readStructure({
      ...cubic(),
      sites: [
        {
          fractional: new Float64Array([0.25, 0.5, 0.75]) as unknown as [
            number,
            number,
            number,
          ],
          species: [{ element: "D" }],
        },
      ],
      operations: [
        {
          rotation: Array.from(new Int32Array([1, 0, 0, 0, 1, 0, 0, 0, 1])),
          translation: new Float64Array([0, 0, 0]) as unknown as [
            number,
            number,
            number,
          ],
        },
      ],
    });
    expect(structure.sites[0]!.fractional).toEqual([0.25, 0.5, 0.75]);
    expect(structure.sites[0]!.species).toEqual([
      { element: "D", occupancy: 1 },
    ]);
  });

  it("refuses operations that do not fit already expanded sites", async () => {
    const promise = readStructure({
      ...cubic(["Co", 0.1, 0.2, 0.3], ["Co", 0.9, 0.8, 0.7]),
      operations: ["x, y, z", "-x, -y, -z", "x+1/2, y, z"],
    });
    await expect(promise).rejects.toBeInstanceOf(StructureDataError);
    await expect(promise).rejects.toThrow(/does not fit/);
  });

  it("reports an unknown space group as readCif does", async () => {
    await expect(
      readStructure({
        ...cubic(["Na", 0, 0, 0]),
        spaceGroup: { symbol: "Q 1 2 3" },
      }),
    ).rejects.toBeInstanceOf(SpaceGroupLookupError);
  });

  const base = cubic(["Na", 0, 0, 0]);
  const site = base.sites[0]!;
  const invalid: [string, unknown, RegExp][] = [
    ["no object", null, /must be an object/],
    ["no lattice", { sites: base.sites }, /lattice must be an object/],
    [
      "a negative length",
      { ...base, lattice: { ...base.lattice, a: -4 } },
      /lattice\.a must be positive/,
    ],
    [
      "a missing angle",
      { ...base, lattice: { a: 4, b: 4, c: 4, alpha: 90, beta: 90 } },
      /lattice\.gamma must be a finite number/,
    ],
    [
      "angles that form no cell",
      {
        ...base,
        lattice: { a: 4, b: 4, c: 4, alpha: 170, beta: 170, gamma: 170 },
      },
      /do not form a cell/,
    ],
    [
      "vectors in one plane",
      {
        ...base,
        lattice: {
          vectors: [
            [1, 0, 0],
            [0, 1, 0],
            [1, 1, 0],
          ],
        },
      },
      /no volume/,
    ],
    ["no sites", { ...base, sites: [] }, /sites must be a non-empty array/],
    [
      "two coordinates",
      { ...base, sites: [{ ...site, fractional: [0, 0] }] },
      /sites\[0\]\.fractional must hold three numbers/,
    ],
    [
      "a coordinate that is not a number",
      { ...base, sites: [{ ...site, fractional: [0, Number.NaN, 0] }] },
      /sites\[0\]\.fractional\[1\] must be a finite number/,
    ],
    [
      "a label that is not text",
      { ...base, sites: [{ ...site, label: 7 }] },
      /sites\[0\]\.label must be a string/,
    ],
    [
      "no species",
      { ...base, sites: [{ ...site, species: [] }] },
      /sites\[0\]\.species must be a non-empty array/,
    ],
    [
      "an unknown element",
      { ...base, sites: [{ ...site, species: [{ element: "Xx" }] }] },
      /must be an element symbol/,
    ],
    [
      "an element in the wrong case",
      { ...base, sites: [{ ...site, species: [{ element: "fe" }] }] },
      /must be an element symbol/,
    ],
    [
      "a negative occupancy",
      {
        ...base,
        sites: [{ ...site, species: [{ element: "Na", occupancy: -0.5 }] }],
      },
      /occupancy must not be negative/,
    ],
    [
      "an empty list of operations",
      { ...base, operations: [] },
      /operations must be a non-empty array/,
    ],
    [
      "an operation that does not parse",
      { ...base, operations: ["x, y"] },
      /operations\[0\]: .*three components/,
    ],
    [
      "a rotation of eight numbers",
      {
        ...base,
        operations: [
          { rotation: [1, 0, 0, 0, 1, 0, 0, 0], translation: [0, 0, 0] },
        ],
      },
      /rotation must hold nine numbers/,
    ],
    [
      "a rotation that is not whole",
      {
        ...base,
        operations: [
          { rotation: [0.5, 0, 0, 0, 1, 0, 0, 0, 1], translation: [0, 0, 0] },
        ],
      },
      /must hold whole numbers/,
    ],
    [
      "a singular rotation",
      { ...base, operations: ["x, y, z", "x, x, z"] },
      /determinant 1 or -1/,
    ],
    [
      "operations without the identity",
      { ...base, operations: ["-x, -y, -z"] },
      /must include the identity/,
    ],
    [
      "a space-group number out of range",
      { ...base, spaceGroup: { number: 231 } },
      /from 1 to 230/,
    ],
    [
      "an empty space-group symbol",
      { ...base, spaceGroup: { symbol: " " } },
      /spaceGroup\.symbol must be a non-empty string/,
    ],
  ];

  it.each(invalid)("refuses data with %s", async (_, data, message) => {
    const promise = readStructure(data as StructureData);
    await expect(promise).rejects.toBeInstanceOf(StructureDataError);
    await expect(promise).rejects.toThrow(message);
  });
});

describe("StructureError", () => {
  it("is the common class of CIF and structure-data errors", async () => {
    const fromData = await readStructure(
      null as unknown as StructureData,
    ).catch((error: unknown) => error);
    const fromCif = await readCif("").catch((error: unknown) => error);
    expect(fromData).toBeInstanceOf(StructureError);
    expect(fromData).toHaveProperty("name", "StructureDataError");
    expect(fromCif).toBeInstanceOf(StructureError);
    expect(fromCif).toBeInstanceOf(CifStructureError);
    expect(fromCif).toHaveProperty("name", "CifStructureError");
  });
});
