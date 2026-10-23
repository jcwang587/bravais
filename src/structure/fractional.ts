import type { SymmetryOperation, Vec3 } from "./types.js";

/** Generated equivalents this close in fractional coordinates are one atom. */
export const EQUIVALENT_TOLERANCE = 1e-3;

/** A wrapped coordinate this close below 1 is rounding; it belongs at 0. */
const WRAP_TOLERANCE = 1e-9;

/** Fold a coordinate into [0, 1); a value within `tolerance` below 1 becomes 0. */
export function wrap(value: number, tolerance = WRAP_TOLERANCE): number {
  const wrapped = value - Math.floor(value);
  return wrapped >= 1 - tolerance ? 0 : wrapped;
}

/** Fold a fractional position into the cell. */
export function wrapVector(fractional: Vec3): Vec3 {
  return [wrap(fractional[0]), wrap(fractional[1]), wrap(fractional[2])];
}

/** Periodic distance of two fractional positions, per axis, below `tolerance`. */
function samePosition(p: Vec3, q: Vec3, tolerance: number): boolean {
  for (let axis = 0; axis < 3; axis += 1) {
    let delta = Math.abs(p[axis]! - q[axis]!);
    delta -= Math.round(delta);
    if (Math.abs(delta) > tolerance) {
      return false;
    }
  }
  return true;
}

/**
 * Buckets per cell edge. A bucket is wider than any tolerance used with
 * them, so a match lies in a position's own bucket or a neighbouring one.
 */
const BUCKETS = 100;

function bucketOf(value: number): number {
  return Math.floor(wrap(value) * BUCKETS) % BUCKETS;
}

function bucketKey(x: number, y: number, z: number): number {
  return (x * BUCKETS + y) * BUCKETS + z;
}

/**
 * Fractional positions bucketed by where they fall in the cell, so finding
 * those within a tolerance of a position, across the periodic boundaries,
 * takes a few comparisons instead of one per position. The tolerance is per
 * axis, as in `samePosition`, and must stay below 1 / BUCKETS.
 */
export class PositionIndex {
  private readonly buckets = new Map<number, number[]>();
  private readonly positions: Vec3[] = [];

  constructor(private readonly tolerance: number) {}

  /** Add a position; its index counts up from 0 in the order added. */
  add(position: Vec3): number {
    const index = this.positions.length;
    this.positions.push(position);
    const key = bucketKey(
      bucketOf(position[0]),
      bucketOf(position[1]),
      bucketOf(position[2]),
    );
    const bucket = this.buckets.get(key);
    if (bucket) {
      bucket.push(index);
    } else {
      this.buckets.set(key, [index]);
    }
    return index;
  }

  /** Indices of the positions within tolerance of `position`, ascending. */
  near(position: Vec3): number[] {
    const wrapped = wrapVector(position);
    const [x, y, z] = wrapped.map(bucketOf) as Vec3;
    const found: number[] = [];
    for (let dx = -1; dx <= 1; dx += 1) {
      const bx = (x + dx + BUCKETS) % BUCKETS;
      for (let dy = -1; dy <= 1; dy += 1) {
        const by = (y + dy + BUCKETS) % BUCKETS;
        for (let dz = -1; dz <= 1; dz += 1) {
          const bz = (z + dz + BUCKETS) % BUCKETS;
          for (const index of this.buckets.get(bucketKey(bx, by, bz)) ?? []) {
            if (samePosition(this.positions[index]!, wrapped, this.tolerance)) {
              found.push(index);
            }
          }
        }
      }
    }
    return found.sort((left, right) => left - right);
  }
}

/** Apply an operation to fractional coordinates (no wrapping). */
export function applyOperation(
  operation: SymmetryOperation,
  fractional: Vec3,
): Vec3 {
  const r = operation.rotation;
  const [x, y, z] = fractional;
  const t = operation.translation;
  return [
    (r[0] ?? 0) * x + (r[1] ?? 0) * y + (r[2] ?? 0) * z + t[0],
    (r[3] ?? 0) * x + (r[4] ?? 0) * y + (r[5] ?? 0) * z + t[1],
    (r[6] ?? 0) * x + (r[7] ?? 0) * y + (r[8] ?? 0) * z + t[2],
  ];
}
