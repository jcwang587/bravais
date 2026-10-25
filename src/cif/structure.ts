import { elementFromCifSymbol } from "../structure/elements.js";
import { latticeFromParameters } from "../structure/lattice.js";
import { assembleSites, type SiteRow } from "../structure/sites.js";
import type {
  Site,
  SpaceGroupInfo,
  StructureListing,
  SymmetryOperation,
} from "../structure/types.js";
import {
  isCifPlaceholder,
  loopColumn,
  parseCifNumber,
  type CifBlock,
} from "./parser.js";
import { CifStructureError } from "./errors.js";
import { parseSymmetryOperation } from "./symmetry-operations.js";

const OPERATION_TAGS = [
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

/**
 * A data block's lattice, merged sites, operations (null when the file lists
 * none; see `spaceGroup` then) and space-group tags.
 */
export type ParsedCifStructure = StructureListing;

function requireNumber(block: CifBlock, tag: string): number {
  const value = parseCifNumber(block.get(tag));
  if (value === null) {
    throw new CifStructureError(
      `${block.name || "The CIF"} has no usable ${tag}.`,
    );
  }
  return value;
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
  const rows: SiteRow[] = [];

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
    rows.push({ label, element, occupancy, fractional: [x, y, z] });
  }

  const sites = assembleSites(rows);
  if (sites.length === 0) {
    throw new CifStructureError(
      `${block.name || "The CIF"} has no atom sites with coordinates.`,
    );
  }
  return sites;
}

function readOperations(block: CifBlock): SymmetryOperation[] | null {
  const loop = block.findLoop(OPERATION_TAGS);
  if (!loop) {
    const single = block.get(OPERATION_TAGS);
    return single === null ? null : [parseSymmetryOperation(single)];
  }
  const column = loopColumn(loop, OPERATION_TAGS) ?? [];
  const operations = column
    .filter((text) => !isCifPlaceholder(text))
    .map(parseSymmetryOperation);
  return operations.length > 0 ? operations : null;
}

function readSpaceGroup(block: CifBlock): SpaceGroupInfo {
  const number = parseCifNumber(block.get(SPACE_GROUP_NUMBER_TAGS));
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

/** Lattice, merged sites, operations and space-group tags of one data block. */
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
