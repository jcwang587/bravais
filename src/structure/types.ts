/** Three Cartesian or fractional components. */
export type Vec3 = [number, number, number];

/** Three row vectors. */
export type Mat3 = [Vec3, Vec3, Vec3];

export interface LatticeParameters {
  a: number;
  b: number;
  c: number;
  /** Degrees. */
  alpha: number;
  beta: number;
  gamma: number;
}

export interface Lattice extends LatticeParameters {
  /** Row vectors a, b, c in Cartesian ångström. */
  vectors: Mat3;
}

export interface Species {
  /** Element symbol, such as "Fe"; "D" for deuterium. */
  element: string;
  /** Share of the site this species occupies, 0 to 1; a site's shares add up to at most 1. */
  occupancy: number;
}

/** One crystallographic site; several species share it when disordered. */
export interface Site {
  label: string;
  /** Sorted by descending occupancy. */
  species: Species[];
  fractional: Vec3;
}

/** x' = R x + t on fractional coordinates; `rotation` is row-major. */
export interface SymmetryOperation {
  rotation: number[];
  translation: Vec3;
}

/** What a CIF or structure data says about its space group; null for what it leaves out. */
export interface SpaceGroupInfo {
  /** Number in the International Tables, 1 to 230. */
  number: number | null;
  /** Hermann-Mauguin symbol as written in the source. */
  symbol: string | null;
  /** Hall symbol as written in the source. */
  hallSymbol: string | null;
}

export interface Structure {
  lattice: Lattice;
  sites: Site[];
  /** Operations that generate the full cell from `sites`; the identity alone once expanded. */
  operations: SymmetryOperation[];
  spaceGroup: SpaceGroupInfo;
}

/**
 * A structure as its source lists it, before its symmetry is settled: the
 * operations are null when the source gives none, and `spaceGroup` then
 * decides them.
 */
export interface StructureListing {
  lattice: Lattice;
  sites: Site[];
  operations: SymmetryOperation[] | null;
  spaceGroup: SpaceGroupInfo;
}

export const IDENTITY_OPERATION: SymmetryOperation = {
  rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  translation: [0, 0, 0],
};
