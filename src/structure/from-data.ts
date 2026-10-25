import { parseSymmetryOperation } from "../cif/symmetry-operations.js";
import { resolveOperations } from "../symmetry/resolve.js";
import { isElementSymbol } from "./elements.js";
import { StructureDataError } from "./errors.js";
import { wrapVector } from "./fractional.js";
import { latticeFromParameters, latticeFromVectors } from "./lattice.js";
import { assembleSites, type SiteRow } from "./sites.js";
import type {
  Lattice,
  LatticeParameters,
  Mat3,
  SpaceGroupInfo,
  Structure,
  SymmetryOperation,
  Vec3,
} from "./types.js";

/** One site of `StructureData`: a position and the species that share it. */
export interface SiteData {
  /** Name of the site; `site1`, `site2` and so on by its place in the list when absent. */
  label?: string | null;
  /** Fractional coordinates; wrapped into the cell. */
  fractional: Vec3;
  /** The species at this position; an occupancy defaults to 1. */
  species: { element: string; occupancy?: number | null }[];
}

/**
 * A crystal structure as plain data, for structures read or built outside
 * this package. It survives JSON and `structuredClone`, so it can cross
 * workers, processes and IPC.
 */
export interface StructureData {
  /**
   * Cell lengths in ångström and angles in degrees, set with c along z and a
   * in the xz plane as in pymatgen, or the three cell vectors as rows in
   * Cartesian ångström, used as given. Vectors win when both are given.
   */
  lattice: LatticeParameters | { vectors: Mat3 };
  /**
   * The sites as listed: an asymmetric unit that `operations` or
   * `spaceGroup` expands, or every atom of the cell. Species within 1e-4 of
   * one position belong to one site, as the rows of a CIF do.
   */
  sites: SiteData[];
  /**
   * x' = R x + t on fractional coordinates, as `SymmetryOperation`s with R
   * row-major, or as strings such as `"-x, y+1/2, -z"`. They must include
   * the identity. When absent or null, `spaceGroup` supplies them, and
   * without a space group the sites list every atom of the cell.
   */
  operations?: (SymmetryOperation | string)[] | null;
  /** The space group by Hall symbol, Hermann-Mauguin symbol or number. */
  spaceGroup?: Partial<SpaceGroupInfo> | null;
}

/** Rotation entries and translations this close to a whole number are one. */
const INTEGER_TOLERANCE = 1e-9;

/** A cell smaller than this, in cubic ångström, has no volume. */
const MIN_VOLUME = 1e-6;

function fail(message: string): never {
  throw new StructureDataError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describe(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }
  if (typeof value === "object" && value !== null) {
    return Array.isArray(value) ? "an array" : "an object";
  }
  return JSON.stringify(value) ?? String(value);
}

function finite(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`${where} must be a finite number, not ${describe(value)}.`);
  }
  return value;
}

function positive(value: unknown, where: string): number {
  const number = finite(value, where);
  if (number <= 0) {
    fail(`${where} must be positive, not ${number}.`);
  }
  return number;
}

/** Three finite numbers from an array or typed array. */
function vector(value: unknown, where: string): Vec3 {
  const items =
    Array.isArray(value) || ArrayBuffer.isView(value)
      ? Array.from(value as ArrayLike<unknown>)
      : null;
  if (items === null || items.length !== 3) {
    fail(`${where} must hold three numbers, not ${describe(value)}.`);
  }
  return [
    finite(items[0], `${where}[0]`),
    finite(items[1], `${where}[1]`),
    finite(items[2], `${where}[2]`),
  ];
}

function determinant([a, b, c]: Mat3): number {
  return (
    a[0] * (b[1] * c[2] - b[2] * c[1]) -
    a[1] * (b[0] * c[2] - b[2] * c[0]) +
    a[2] * (b[0] * c[1] - b[1] * c[0])
  );
}

function readLattice(value: unknown): Lattice {
  if (!isRecord(value)) {
    fail(
      "lattice must be an object with a, b, c, alpha, beta and gamma, or with vectors.",
    );
  }
  if (value["vectors"] !== undefined && value["vectors"] !== null) {
    const rows = value["vectors"];
    if (!Array.isArray(rows) || rows.length !== 3) {
      fail(`lattice.vectors must be three vectors, not ${describe(rows)}.`);
    }
    const vectors: Mat3 = [
      vector(rows[0], "lattice.vectors[0]"),
      vector(rows[1], "lattice.vectors[1]"),
      vector(rows[2], "lattice.vectors[2]"),
    ];
    if (Math.abs(determinant(vectors)) < MIN_VOLUME) {
      fail("lattice.vectors lie in one plane: the cell has no volume.");
    }
    return latticeFromVectors(vectors);
  }
  const parameters: LatticeParameters = {
    a: positive(value["a"], "lattice.a"),
    b: positive(value["b"], "lattice.b"),
    c: positive(value["c"], "lattice.c"),
    alpha: positive(value["alpha"], "lattice.alpha"),
    beta: positive(value["beta"], "lattice.beta"),
    gamma: positive(value["gamma"], "lattice.gamma"),
  };
  const lattice = latticeFromParameters(parameters);
  if (!(Math.abs(determinant(lattice.vectors)) >= MIN_VOLUME)) {
    fail(
      `lattice angles ${parameters.alpha}, ${parameters.beta} and ${parameters.gamma} degrees do not form a cell.`,
    );
  }
  return lattice;
}

function readSiteRows(value: unknown): SiteRow[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`sites must be a non-empty array, not ${describe(value)}.`);
  }
  const rows: SiteRow[] = [];
  value.forEach((site: unknown, index: number) => {
    const where = `sites[${index}]`;
    if (!isRecord(site)) {
      fail(`${where} must be an object, not ${describe(site)}.`);
    }
    const rawLabel = site["label"];
    if (
      rawLabel !== undefined &&
      rawLabel !== null &&
      typeof rawLabel !== "string"
    ) {
      fail(`${where}.label must be a string, not ${describe(rawLabel)}.`);
    }
    const label = rawLabel ?? `site${index + 1}`;
    const fractional = vector(site["fractional"], `${where}.fractional`);
    const species = site["species"];
    if (!Array.isArray(species) || species.length === 0) {
      fail(
        `${where}.species must be a non-empty array, not ${describe(species)}.`,
      );
    }
    species.forEach((entry: unknown, position: number) => {
      const at = `${where}.species[${position}]`;
      if (!isRecord(entry)) {
        fail(`${at} must be an object, not ${describe(entry)}.`);
      }
      const element = entry["element"];
      if (typeof element !== "string" || !isElementSymbol(element)) {
        fail(
          `${at}.element must be an element symbol such as "Fe", or "D", not ${describe(element)}.`,
        );
      }
      const rawOccupancy = entry["occupancy"];
      const occupancy =
        rawOccupancy === undefined || rawOccupancy === null
          ? 1
          : finite(rawOccupancy, `${at}.occupancy`);
      if (occupancy < 0) {
        fail(`${at}.occupancy must not be negative, not ${occupancy}.`);
      }
      rows.push({ label, element, occupancy, fractional });
    });
  });
  return rows;
}

function isWhole(value: number): boolean {
  return Math.abs(value - Math.round(value)) <= INTEGER_TOLERANCE;
}

function isIdentity(operation: SymmetryOperation): boolean {
  return (
    operation.rotation.every(
      (value, index) =>
        Math.abs(value - (index % 4 === 0 ? 1 : 0)) <= INTEGER_TOLERANCE,
    ) && operation.translation.every((value) => isWhole(value))
  );
}

/** A rotation of nine whole numbers, row by row, with determinant 1 or -1. */
function rotation(value: unknown, where: string): number[] {
  const entries =
    Array.isArray(value) || ArrayBuffer.isView(value)
      ? Array.from(value as ArrayLike<unknown>)
      : null;
  if (entries === null || entries.length !== 9) {
    fail(
      `${where} must hold nine numbers, row by row, not ${describe(value)}.`,
    );
  }
  const matrix = entries.map((entry, index) =>
    finite(entry, `${where}[${index}]`),
  );
  if (!matrix.every(isWhole)) {
    fail(`${where} must hold whole numbers.`);
  }
  const rows: Mat3 = [
    [matrix[0]!, matrix[1]!, matrix[2]!],
    [matrix[3]!, matrix[4]!, matrix[5]!],
    [matrix[6]!, matrix[7]!, matrix[8]!],
  ];
  if (Math.abs(Math.abs(determinant(rows)) - 1) > INTEGER_TOLERANCE) {
    fail(`${where} must have determinant 1 or -1.`);
  }
  return matrix.map(Math.round);
}

function readOperation(value: unknown, where: string): SymmetryOperation {
  if (typeof value === "string") {
    let parsed: SymmetryOperation;
    try {
      parsed = parseSymmetryOperation(value);
    } catch (error) {
      fail(
        `${where}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return {
      rotation: rotation(parsed.rotation, `${where} (${value})`),
      translation: parsed.translation,
    };
  }
  if (!isRecord(value)) {
    fail(
      `${where} must be a string such as "x, y, z" or an object with rotation and translation, not ${describe(value)}.`,
    );
  }
  return {
    rotation: rotation(value["rotation"], `${where}.rotation`),
    translation: wrapVector(
      vector(value["translation"], `${where}.translation`),
    ),
  };
}

function readOperations(value: unknown): SymmetryOperation[] | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Array.isArray(value) || value.length === 0) {
    fail(
      `operations must be a non-empty array, or absent, not ${describe(value)}.`,
    );
  }
  const operations = value.map((operation: unknown, index: number) =>
    readOperation(operation, `operations[${index}]`),
  );
  if (!operations.some(isIdentity)) {
    fail("operations must include the identity, x, y, z.");
  }
  return operations;
}

function readSpaceGroup(value: unknown): SpaceGroupInfo {
  if (value === undefined || value === null) {
    return { number: null, symbol: null, hallSymbol: null };
  }
  if (!isRecord(value)) {
    fail(
      `spaceGroup must be an object with number, symbol or hallSymbol, not ${describe(value)}.`,
    );
  }
  const number = value["number"];
  if (
    number !== undefined &&
    number !== null &&
    !(
      typeof number === "number" &&
      Number.isInteger(number) &&
      number >= 1 &&
      number <= 230
    )
  ) {
    fail(
      `spaceGroup.number must be a whole number from 1 to 230, not ${describe(number)}.`,
    );
  }
  const text = (key: "symbol" | "hallSymbol"): string | null => {
    const entry = value[key];
    if (entry === undefined || entry === null) {
      return null;
    }
    if (typeof entry !== "string" || entry.trim() === "") {
      fail(
        `spaceGroup.${key} must be a non-empty string, not ${describe(entry)}.`,
      );
    }
    return entry.trim();
  };
  return {
    number: number ?? null,
    symbol: text("symbol"),
    hallSymbol: text("hallSymbol"),
  };
}

/**
 * Read a structure given as data instead of a CIF, such as one a CIF reader
 * outside this package produced, so it can be expanded, drawn and analysed
 * like a structure from `readCif`. The data is checked and then read the way
 * a CIF's atoms are: positions wrapped into the cell, species at one position
 * joined into a site and sorted by occupancy, overfull sites scaled to a full
 * one, and the symmetry checked against the atoms, or looked up from the
 * space group.
 *
 * Throws `StructureDataError` for data that is missing or malformed, or
 * whose operations do not fit its atoms, and `SpaceGroupLookupError` for an
 * unknown space group.
 */
export async function readStructure(data: StructureData): Promise<Structure> {
  if (!isRecord(data)) {
    fail(`Structure data must be an object, not ${describe(data)}.`);
  }
  const lattice = readLattice(data["lattice"]);
  const sites = assembleSites(readSiteRows(data["sites"]));
  const spaceGroup = readSpaceGroup(data["spaceGroup"]);
  const operations = await resolveOperations(
    {
      lattice,
      sites,
      operations: readOperations(data["operations"]),
      spaceGroup,
    },
    StructureDataError,
  );
  return { lattice, sites, operations, spaceGroup };
}
