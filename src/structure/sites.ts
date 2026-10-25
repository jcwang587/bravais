import { PositionIndex, wrap } from "./fractional.js";
import type { Site, Species, Vec3 } from "./types.js";

/** Rows this close in fractional coordinates describe one site. */
export const SITE_MERGE_TOLERANCE = 1e-4;

/** Totals this far above 1 are more than rounding. */
const OVERFULL_TOLERANCE = 1e-6;

/** One species at one position, as a CIF atom-site row lists it. */
export interface SiteRow {
  label: string;
  element: string;
  occupancy: number;
  fractional: Vec3;
}

function mergeSpecies(
  species: Species[],
  element: string,
  occupancy: number,
): void {
  const existing = species.find((entry) => entry.element === element);
  if (existing) {
    existing.occupancy += occupancy;
  } else {
    species.push({ element, occupancy });
  }
  species.sort((left, right) => right.occupancy - left.occupancy);
}

/**
 * A site holds at most one atom. Refined occupancies sometimes add up to a
 * little more, and some files list far more; either way the species are
 * scaled down to a full site, the rule pymatgen applies within its
 * tolerance, so the drawn atom makes sense.
 */
function scaleOverfullSites(sites: Site[]): void {
  for (const site of sites) {
    const total = site.species.reduce(
      (sum, species) => sum + species.occupancy,
      0,
    );
    if (total > 1 + OVERFULL_TOLERANCE) {
      for (const species of site.species) {
        species.occupancy /= total;
      }
    }
  }
}

/**
 * Sites from rows of one species at one position, the way a CIF lists its
 * atoms. Positions are wrapped into the cell. Rows within
 * `SITE_MERGE_TOLERANCE` of an earlier row join its site, which keeps that
 * row's label, adds up the occupancy of a repeated element and sorts its
 * species by descending occupancy. A site whose occupancies add up to more
 * than 1 is scaled down to a full site.
 */
export function assembleSites(rows: Iterable<SiteRow>): Site[] {
  const sites: Site[] = [];
  const positions = new PositionIndex(SITE_MERGE_TOLERANCE);
  for (const row of rows) {
    const fractional: Vec3 = [
      wrap(row.fractional[0]),
      wrap(row.fractional[1]),
      wrap(row.fractional[2]),
    ];
    // The first site listed at this position, if any.
    const [shared] = positions.near(fractional);
    if (shared !== undefined) {
      mergeSpecies(sites[shared]!.species, row.element, row.occupancy);
    } else {
      positions.add(fractional);
      sites.push({
        label: row.label,
        species: [{ element: row.element, occupancy: row.occupancy }],
        fractional,
      });
    }
  }
  scaleOverfullSites(sites);
  return sites;
}
