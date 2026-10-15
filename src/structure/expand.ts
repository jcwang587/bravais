import { sameFractionalPosition } from "../cif/structure";
import { applyOperation } from "../cif/symmetry-operators";
import {
  IDENTITY_OPERATION,
  type Site,
  type Structure,
  type Vec3,
} from "./types";

/** Generated equivalents this close in fractional coordinates are one atom. */
const EQUIVALENT_TOLERANCE = 1e-3;

function wrap(fractional: Vec3): Vec3 {
  return fractional.map((value) => {
    const wrapped = value - Math.floor(value);
    return wrapped >= 1 - 1e-9 ? 0 : wrapped;
  }) as Vec3;
}

/**
 * Apply every operation to every site and keep the distinct positions: the
 * full cell as an explicit list of sites (P1).
 */
export function expandStructure(structure: Structure): Structure {
  const sites: Site[] = [];
  for (const site of structure.sites) {
    for (const operation of structure.operations) {
      const fractional = wrap(applyOperation(operation, site.fractional));
      const duplicate = sites.some((existing) =>
        sameFractionalPosition(
          existing.fractional,
          fractional,
          EQUIVALENT_TOLERANCE,
        ),
      );
      if (!duplicate) {
        sites.push({ label: site.label, species: site.species, fractional });
      }
    }
  }
  return { ...structure, sites, operations: [IDENTITY_OPERATION] };
}
