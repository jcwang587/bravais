import type { SymmetryOperation, Vec3 } from "./types.js";

/** Generated equivalents this close in fractional coordinates are one atom. */
export const EQUIVALENT_TOLERANCE = 1e-3;

/** A wrapped coordinate this close below 1 is rounding; it belongs at 0. */
const NEAR_ONE = 1e-9;

/** Fold a coordinate into [0, 1); a value within `nearOne` below 1 becomes 0. */
export function wrap(value: number, nearOne = NEAR_ONE): number {
  const wrapped = value - Math.floor(value);
  return wrapped >= 1 - nearOne ? 0 : wrapped;
}

/** Fold a fractional position into the cell. */
export function wrapVector(fractional: Vec3): Vec3 {
  return [wrap(fractional[0]), wrap(fractional[1]), wrap(fractional[2])];
}

/** Periodic distance of two fractional positions, per axis, below `tolerance`. */
export function samePosition(p: Vec3, q: Vec3, tolerance: number): boolean {
  for (let axis = 0; axis < 3; axis += 1) {
    let delta = Math.abs((p[axis] as number) - (q[axis] as number));
    delta -= Math.round(delta);
    if (Math.abs(delta) > tolerance) {
      return false;
    }
  }
  return true;
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
