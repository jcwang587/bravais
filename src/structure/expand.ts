import {
  EQUIVALENT_TOLERANCE,
  applyOperation,
  samePosition,
  wrapVector,
} from "./fractional.js";
import { IDENTITY_OPERATION, type Site, type Structure } from "./types.js";

/**
 * Apply every operation to every site and keep the distinct positions: the
 * full cell as an explicit list of sites (P1).
 */
export function expandStructure(structure: Structure): Structure {
  const sites: Site[] = [];
  for (const site of structure.sites) {
    for (const operation of structure.operations) {
      const fractional = wrapVector(applyOperation(operation, site.fractional));
      const duplicate = sites.some((existing) =>
        samePosition(existing.fractional, fractional, EQUIVALENT_TOLERANCE),
      );
      if (!duplicate) {
        sites.push({ label: site.label, species: site.species, fractional });
      }
    }
  }
  return { ...structure, sites, operations: [IDENTITY_OPERATION] };
}
