import {
  EQUIVALENT_TOLERANCE,
  PositionIndex,
  applyOperation,
} from "./fractional.js";
import type { Site, SymmetryOperation } from "./types.js";

export interface ListingClosure {
  /** Some listed site is a symmetry image of another: the list is already expanded, fully or partly. */
  preExpanded: boolean;
  /** Every image of every listed site is itself a listed site. */
  closed: boolean;
}

/**
 * How the listed sites relate to the operations. An asymmetric unit lists
 * no site that is an image of another, and its images are new positions,
 * as they should be. A list that is already expanded repeats such images,
 * and then the operations must map the list onto itself, or they are not
 * the symmetry of these atoms.
 */
export function listingClosure(
  sites: Site[],
  operations: SymmetryOperation[],
): ListingClosure {
  const positions = new PositionIndex(EQUIVALENT_TOLERANCE);
  for (const site of sites) {
    positions.add(site.fractional);
  }
  let preExpanded = false;
  let closed = true;
  sites.forEach((site, siteIndex) => {
    for (const operation of operations) {
      const hits = positions.near(applyOperation(operation, site.fractional));
      if (hits.some((hit) => hit !== siteIndex)) {
        preExpanded = true;
      }
      if (hits.length === 0) {
        closed = false;
      }
    }
  });
  return { preExpanded, closed };
}
