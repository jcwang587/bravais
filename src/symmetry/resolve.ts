import { CifStructureError, type ParsedCifStructure } from "../cif/structure";
import { listingClosure } from "../structure/closure";
import {
  IDENTITY_OPERATION,
  type LatticeParameters,
  type Site,
  type SymmetryOperation,
} from "../structure/types";
import { operationSettings } from "./moyo";

/** Lengths within this fraction, and angles within this many degrees, are equal. */
const SAME_LENGTH = 1e-3;
const SAME_ANGLE = 0.01;

function misfit(): CifStructureError {
  return new CifStructureError(
    "The symmetry does not fit the listed atoms: they are already expanded, yet the operations generate positions the file does not list.",
  );
}

function assertFits(sites: Site[], operations: SymmetryOperation[]): void {
  const closure = listingClosure(sites, operations);
  if (closure.preExpanded && !closure.closed) {
    throw misfit();
  }
}

/** The axes a cell is set on when its shape says so: rhombohedral or hexagonal. */
function axesOfCell({
  a,
  b,
  c,
  alpha,
  beta,
  gamma,
}: LatticeParameters): "H" | "R" | null {
  const sameLength = (x: number, y: number) =>
    Math.abs(x - y) <= SAME_LENGTH * Math.max(x, y);
  const sameAngle = (x: number, y: number) => Math.abs(x - y) <= SAME_ANGLE;
  if (
    sameLength(a, b) &&
    sameLength(b, c) &&
    sameAngle(alpha, beta) &&
    sameAngle(beta, gamma) &&
    !sameAngle(alpha, 90)
  ) {
    return "R";
  }
  if (
    sameLength(a, b) &&
    sameAngle(alpha, 90) &&
    sameAngle(beta, 90) &&
    sameAngle(gamma, 120)
  ) {
    return "H";
  }
  return null;
}

/**
 * The operations a parsed CIF's atoms are expanded with: the file's own
 * loop, checked to fit the atoms, or else the setting of its space group
 * that fits them. A symbol admitting several settings, such as a
 * rhombohedral group with no `:H` or `:R`, is settled by the atoms when the
 * list is already expanded, since only the right setting maps it onto
 * itself, and otherwise by the cell shape, then by the standard setting.
 */
export async function resolveOperations(
  parsed: ParsedCifStructure,
): Promise<SymmetryOperation[]> {
  if (parsed.operations) {
    assertFits(parsed.sites, parsed.operations);
    return parsed.operations;
  }
  const { spaceGroup } = parsed;
  if (
    spaceGroup.hallSymbol === null &&
    spaceGroup.symbol === null &&
    spaceGroup.number === null
  ) {
    return [IDENTITY_OPERATION];
  }
  const settings = await operationSettings(spaceGroup);
  if (settings.length === 1) {
    const [only] = settings;
    assertFits(parsed.sites, only!.operations);
    return only!.operations;
  }
  const closures = settings.map((setting) =>
    listingClosure(parsed.sites, setting.operations),
  );
  const fitting = settings.find(
    (_, index) => closures[index]!.preExpanded && closures[index]!.closed,
  );
  if (fitting) {
    return fitting.operations;
  }
  if (closures.some((closure) => closure.preExpanded)) {
    throw misfit();
  }
  const axes = axesOfCell(parsed.lattice);
  const byCell =
    axes === null
      ? undefined
      : settings.find((setting) => setting.setting.toUpperCase() === axes);
  return (byCell ?? settings[0]!).operations;
}
