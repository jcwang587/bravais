import {
  analyze_cell,
  hall_symbol_entry,
  space_group_type,
  type MoyoCell,
  type MoyoDataset,
  type MoyoHallSymbolEntry,
} from "@spglib/moyo-wasm";

import { expandStructure } from "../structure/expand";
import { latticeFromVectors } from "../structure/lattice";
import {
  IDENTITY_OPERATION,
  type Mat3,
  type Site,
  type Species,
  type Structure,
  type SymmetryOperation,
  type Vec3,
} from "../structure/types";
import { ensureMoyo, fromMoyoOperation } from "./moyo";

/**
 * Distance tolerance of the symmetry search, in ångström: pymatgen's
 * default, loose enough for coordinates rounded to four decimals.
 */
const DEFAULT_SYMPREC = 0.01;

export class SymmetryAnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SymmetryAnalysisError";
  }
}

export interface SymmetryOptions {
  /** Distance tolerance in ångström. Default 0.01. */
  symprec?: number;
}

/** What moyo finds when it analyses the atoms of a structure. */
export interface SymmetryDataset {
  /** Space-group number in the International Tables. */
  number: number;
  /** Short Hermann-Mauguin symbol of the standard setting, as moyo writes it. */
  symbol: string;
  fullSymbol: string;
  hallSymbol: string;
  hallNumber: number;
  /** Setting of the Hall entry: "2" for origin choice 2, "H" for hexagonal axes, "" when there is one setting. */
  setting: string;
  crystalSystem: string;
  /** Operations of the analysed cell, in its own basis. */
  operations: SymmetryOperation[];
  /** Wyckoff letter of every site of `structure`, in its order. */
  wyckoffs: string[];
  /** Site-symmetry symbol of every site of `structure`, in its order. */
  siteSymmetries: string[];
  /** The expanded structure the analysis ran on. */
  structure: Structure;
  /** The same crystal in moyo's standard setting: a symmetry-refined conventional cell listing every atom. */
  standard: Structure;
}

/**
 * moyo tells sites apart by an integer label. Every distinct species list,
 * occupancies included, gets a label of its own, the way pymatgen types
 * sites, so a half-occupied sodium site never matches a full one and the
 * standard cell maps back to exactly the species it was given.
 */
function labelSpecies(sites: Site[]): {
  numbers: number[];
  speciesByLabel: Map<number, Species[]>;
} {
  const labelByKey = new Map<string, number>();
  const speciesByLabel = new Map<number, Species[]>();
  const numbers = sites.map((site) => {
    const key = JSON.stringify(site.species);
    let label = labelByKey.get(key);
    if (label === undefined) {
      label = labelByKey.size + 1;
      labelByKey.set(key, label);
      speciesByLabel.set(label, site.species);
    }
    return label;
  });
  return { numbers, speciesByLabel };
}

function wrap(fractional: Vec3): Vec3 {
  return fractional.map((value) => {
    const wrapped = value - Math.floor(value);
    return wrapped >= 1 - 1e-9 ? 0 : wrapped;
  }) as Vec3;
}

/** moyo's standardized cell as a structure, every atom listed. */
function standardStructure(
  dataset: MoyoDataset,
  speciesByLabel: Map<number, Species[]>,
  entry: MoyoHallSymbolEntry,
): Structure {
  const basis = dataset.std_cell.lattice.basis;
  const vectors: Mat3 = [
    [basis[0], basis[1], basis[2]],
    [basis[3], basis[4], basis[5]],
    [basis[6], basis[7], basis[8]],
  ];
  const counts = new Map<string, number>();
  const sites = dataset.std_cell.positions.map((position, index) => {
    const label = dataset.std_cell.numbers[index] ?? 0;
    const species = speciesByLabel.get(label) ?? [];
    const element = species[0]?.element ?? "X";
    const count = (counts.get(element) ?? 0) + 1;
    counts.set(element, count);
    return {
      label: `${element}${count}`,
      species,
      fractional: wrap(position),
    };
  });
  return {
    lattice: latticeFromVectors(vectors),
    sites,
    operations: [IDENTITY_OPERATION],
    spaceGroup: {
      number: dataset.number,
      symbol: dataset.hm_symbol,
      hallSymbol: entry.hall_symbol,
    },
  };
}

/**
 * Analyse the symmetry of what a structure actually contains. The structure
 * is expanded to every atom in its cell and handed to moyo, which finds the
 * space group from the atoms alone, so the result does not depend on how,
 * or whether, the file named it.
 */
export async function symmetryDataset(
  structure: Structure,
  options: SymmetryOptions = {},
): Promise<SymmetryDataset> {
  await ensureMoyo();
  const expanded = expandStructure(structure);
  const { numbers, speciesByLabel } = labelSpecies(expanded.sites);
  const [a, b, c] = expanded.lattice.vectors;
  const cell: MoyoCell = {
    lattice: { basis: [...a, ...b, ...c] },
    positions: expanded.sites.map((site) => site.fractional),
    numbers,
  };
  let dataset: MoyoDataset;
  try {
    dataset = analyze_cell(
      JSON.stringify(cell),
      options.symprec ?? DEFAULT_SYMPREC,
      "Standard",
    );
  } catch (error) {
    throw new SymmetryAnalysisError(
      `moyo could not analyse the structure: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const entry = hall_symbol_entry(dataset.hall_number);
  const type = space_group_type(dataset.number);
  const standard = standardStructure(dataset, speciesByLabel, entry);
  return {
    number: dataset.number,
    symbol: dataset.hm_symbol,
    fullSymbol: entry.hm_full,
    hallSymbol: entry.hall_symbol,
    hallNumber: dataset.hall_number,
    setting: entry.setting,
    crystalSystem: type.crystal_system,
    operations: dataset.operations.map(fromMoyoOperation),
    wyckoffs: dataset.wyckoffs,
    siteSymmetries: dataset.site_symmetry_symbols,
    structure: expanded,
    standard,
  };
}
