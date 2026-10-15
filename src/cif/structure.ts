import { elementFromCifSymbol } from "../structure/elements";
import { latticeFromParameters } from "../structure/lattice";
import type {
  Lattice,
  Site,
  SpaceGroupInfo,
  Species,
  SymmetryOperation,
  Vec3,
} from "../structure/types";
import {
  isCifPlaceholder,
  loopColumn,
  parseCifNumber,
  type CifBlock,
} from "./parser";
import { parseSymmetryOperator } from "./symmetry-operators";

export class CifStructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CifStructureError";
  }
}

/** Rows this close in fractional coordinates describe one site. */
const SITE_MERGE_TOLERANCE = 1e-4;

const OPERATOR_TAGS = [
  "_space_group_symop_operation_xyz",
  "_symmetry_equiv_pos_as_xyz",
];
const SPACE_GROUP_NUMBER_TAGS = [
  "_space_group_it_number",
  "_symmetry_int_tables_number",
];
const HERMANN_MAUGUIN_TAGS = [
  "_space_group_name_h-m_alt",
  "_symmetry_space_group_name_h-m",
  "_space_group_name_h-m_full",
];
const HALL_TAGS = ["_space_group_name_hall", "_symmetry_space_group_name_hall"];

export interface ParsedCifStructure {
  lattice: Lattice;
  sites: Site[];
  /** Null when the file lists no operators; see `spaceGroup` then. */
  operations: SymmetryOperation[] | null;
  spaceGroup: SpaceGroupInfo;
}

function requireNumber(block: CifBlock, tag: string): number {
  const value = parseCifNumber(block.get(tag));
  if (value === null) {
    throw new CifStructureError(
      `${block.name || "The CIF"} has no usable ${tag}.`,
    );
  }
  return value;
}

function wrapFraction(value: number): number {
  const wrapped = value - Math.floor(value);
  return wrapped >= 1 ? 0 : wrapped;
}

/** Periodic distance of two fractional positions, per axis, below `tolerance`. */
export function sameFractionalPosition(
  p: Vec3,
  q: Vec3,
  tolerance: number,
): boolean {
  for (let axis = 0; axis < 3; axis += 1) {
    let delta = Math.abs((p[axis] as number) - (q[axis] as number));
    delta -= Math.round(delta);
    if (Math.abs(delta) > tolerance) {
      return false;
    }
  }
  return true;
}

function mergeSpecies(
  species: Species[],
  element: string,
  occupancy: number,
): void {
  const existing = species.find((entry) => entry.element === element);
  if (existing) {
    existing.occupancy = Math.min(1, existing.occupancy + occupancy);
  } else {
    species.push({ element, occupancy });
  }
  species.sort((left, right) => right.occupancy - left.occupancy);
}

function readSites(block: CifBlock): Site[] {
  const loop = block.findLoop("_atom_site_fract_x");
  if (!loop) {
    throw new CifStructureError(
      `${block.name || "The CIF"} has no atom sites.`,
    );
  }
  const xs = loopColumn(loop, "_atom_site_fract_x") ?? [];
  const ys = loopColumn(loop, "_atom_site_fract_y") ?? [];
  const zs = loopColumn(loop, "_atom_site_fract_z") ?? [];
  const labels = loopColumn(loop, "_atom_site_label");
  const typeSymbols = loopColumn(loop, "_atom_site_type_symbol");
  const occupancies = loopColumn(loop, "_atom_site_occupancy");
  const sites: Site[] = [];

  for (let row = 0; row < loop.rows.length; row += 1) {
    const x = parseCifNumber(xs[row]);
    const y = parseCifNumber(ys[row]);
    const z = parseCifNumber(zs[row]);
    if (x === null || y === null || z === null) {
      continue;
    }
    const label = labels?.[row] ?? typeSymbols?.[row] ?? `site${row + 1}`;
    const typeSymbol = typeSymbols?.[row];
    const element =
      (typeSymbol && !isCifPlaceholder(typeSymbol)
        ? elementFromCifSymbol(typeSymbol)
        : null) ?? elementFromCifSymbol(label);
    if (!element) {
      throw new CifStructureError(
        `Atom site ${JSON.stringify(label)} names no element (type symbol ${JSON.stringify(typeSymbol ?? "")}).`,
      );
    }
    const occupancy = parseCifNumber(occupancies?.[row]) ?? 1;
    const fractional: Vec3 = [
      wrapFraction(x),
      wrapFraction(y),
      wrapFraction(z),
    ];
    const shared = sites.find((site) =>
      sameFractionalPosition(site.fractional, fractional, SITE_MERGE_TOLERANCE),
    );
    if (shared) {
      mergeSpecies(shared.species, element, occupancy);
    } else {
      sites.push({ label, species: [{ element, occupancy }], fractional });
    }
  }

  if (sites.length === 0) {
    throw new CifStructureError(
      `${block.name || "The CIF"} has no atom sites with coordinates.`,
    );
  }
  return sites;
}

function readOperations(block: CifBlock): SymmetryOperation[] | null {
  const loop = block.findLoop(OPERATOR_TAGS);
  if (!loop) {
    const single = block.get(OPERATOR_TAGS);
    return single === null ? null : [parseSymmetryOperator(single)];
  }
  const column = loopColumn(loop, OPERATOR_TAGS) ?? [];
  const operations = column
    .filter((text) => !isCifPlaceholder(text))
    .map(parseSymmetryOperator);
  return operations.length > 0 ? operations : null;
}

function readSpaceGroup(block: CifBlock): SpaceGroupInfo {
  const numberText = block.get(SPACE_GROUP_NUMBER_TAGS);
  const number = numberText === null ? null : parseCifNumber(numberText);
  const symbol = block.get(HERMANN_MAUGUIN_TAGS);
  const hallSymbol = block.get(HALL_TAGS);
  return {
    number:
      number !== null &&
      Number.isInteger(number) &&
      number >= 1 &&
      number <= 230
        ? number
        : null,
    symbol: symbol !== null && !isCifPlaceholder(symbol) ? symbol.trim() : null,
    hallSymbol:
      hallSymbol !== null && !isCifPlaceholder(hallSymbol)
        ? hallSymbol.trim()
        : null,
  };
}

/** True when the block carries atom coordinates (the one a viewer wants). */
export function isStructureBlock(block: CifBlock): boolean {
  return block.findLoop("_atom_site_fract_x") !== null;
}

/** Lattice, merged sites, operators and space-group tags of one data block. */
export function parseCifStructure(block: CifBlock): ParsedCifStructure {
  const lattice = latticeFromParameters({
    a: requireNumber(block, "_cell_length_a"),
    b: requireNumber(block, "_cell_length_b"),
    c: requireNumber(block, "_cell_length_c"),
    alpha: requireNumber(block, "_cell_angle_alpha"),
    beta: requireNumber(block, "_cell_angle_beta"),
    gamma: requireNumber(block, "_cell_angle_gamma"),
  });
  return {
    lattice,
    sites: readSites(block),
    operations: readOperations(block),
    spaceGroup: readSpaceGroup(block),
  };
}
