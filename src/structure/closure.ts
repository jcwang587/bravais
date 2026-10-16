import {
  EQUIVALENT_TOLERANCE,
  applyOperation,
  samePosition,
  wrap,
  wrapVector,
} from "./fractional.js";
import type { Site, SymmetryOperation, Vec3 } from "./types.js";

/** Buckets per cell edge, much wider than the tolerance, so a match sits in a bucket or its neighbour. */
const BUCKETS = 100;

/** Listed positions bucketed for lookups within tolerance, across the cell's periodic boundaries. */
class PositionIndex {
  private readonly buckets = new Map<string, number[]>();

  constructor(private readonly positions: Vec3[]) {
    positions.forEach((position, index) => {
      const key = position
        .map((value) => Math.floor(wrap(value) * BUCKETS) % BUCKETS)
        .join(",");
      const bucket = this.buckets.get(key);
      if (bucket) {
        bucket.push(index);
      } else {
        this.buckets.set(key, [index]);
      }
    });
  }

  /** Indices of the listed positions within tolerance of `position`. */
  near(position: Vec3): number[] {
    const wrapped = wrapVector(position);
    const base = wrapped.map((value) => Math.floor(value * BUCKETS));
    const found: number[] = [];
    for (const dx of [-1, 0, 1]) {
      for (const dy of [-1, 0, 1]) {
        for (const dz of [-1, 0, 1]) {
          const key = [base[0]! + dx, base[1]! + dy, base[2]! + dz]
            .map((bucket) => ((bucket % BUCKETS) + BUCKETS) % BUCKETS)
            .join(",");
          for (const index of this.buckets.get(key) ?? []) {
            if (
              !found.includes(index) &&
              samePosition(
                this.positions[index]!,
                wrapped,
                EQUIVALENT_TOLERANCE,
              )
            ) {
              found.push(index);
            }
          }
        }
      }
    }
    return found;
  }
}

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
  const index = new PositionIndex(sites.map((site) => site.fractional));
  let preExpanded = false;
  let closed = true;
  sites.forEach((site, self) => {
    for (const operation of operations) {
      const hits = index.near(applyOperation(operation, site.fractional));
      if (hits.some((hit) => hit !== self)) {
        preExpanded = true;
      }
      if (hits.length === 0) {
        closed = false;
      }
    }
  });
  return { preExpanded, closed };
}
