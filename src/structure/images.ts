import { wrap } from "./fractional.js";
import type { Site, Vec3 } from "./types.js";

/** A coordinate this close to 0 or 1 sits on the cell boundary. */
const BOUNDARY_TOLERANCE = 1e-4;

export interface PeriodicAtom {
  siteIndex: number;
  fractional: Vec3;
  /** True for a copy of a boundary site on the opposite face, edge or corner. */
  isImage: boolean;
}

/**
 * The sites of a cell, each folded into [0, 1), plus the image atoms of
 * every boundary site when requested: a corner site appears at all eight
 * corners, an edge site at four edges, a face site on both faces.
 */
export function periodicAtoms(
  sites: Site[],
  includeImages: boolean,
): PeriodicAtom[] {
  const atoms: PeriodicAtom[] = [];
  sites.forEach((site, siteIndex) => {
    const fractional = site.fractional.map((value) =>
      wrap(value, BOUNDARY_TOLERANCE),
    ) as Vec3;
    atoms.push({ siteIndex, fractional, isImage: false });
    if (!includeImages) {
      return;
    }
    const boundaryAxes = ([0, 1, 2] as const).filter(
      (axis) => fractional[axis] < BOUNDARY_TOLERANCE,
    );
    const subsetCount = 1 << boundaryAxes.length;
    for (let subset = 1; subset < subsetCount; subset += 1) {
      const image: Vec3 = [fractional[0], fractional[1], fractional[2]];
      boundaryAxes.forEach((axis, bit) => {
        if (subset & (1 << bit)) {
          image[axis] += 1;
        }
      });
      atoms.push({ siteIndex, fractional: image, isImage: true });
    }
  });
  return atoms;
}
