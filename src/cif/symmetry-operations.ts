import { wrap } from "../structure/fractional.js";
import type { SymmetryOperation, Vec3 } from "../structure/types.js";
import { CifStructureError } from "./errors.js";

const AXES = ["x", "y", "z"] as const;

function parseCoefficient(text: string): number {
  if (text === "" || text === "+") {
    return 1;
  }
  if (text === "-") {
    return -1;
  }
  const fraction = text.match(/^([+-]?\d+)\/(\d+)$/);
  const value = fraction
    ? Number(fraction[1]) / Number(fraction[2])
    : Number(text);
  if (!Number.isFinite(value)) {
    throw new CifStructureError(
      `Cannot read the number ${JSON.stringify(text)} in a symmetry operation.`,
    );
  }
  return value;
}

/**
 * Parse a symmetry operation as CIF files write it, such as
 * `-x+1/2, y, -z+1/2`, into a rotation matrix and translation.
 */
export function parseSymmetryOperation(text: string): SymmetryOperation {
  // Only signs, digits, fractions, decimals and x, y, z can belong to an
  // operation; stray letters such as the "t" some exports append are dropped.
  const components = text
    .split(",")
    .map((part) => part.toLowerCase().replace(/[^xyz0-9./+-]/g, ""));
  if (components.length !== 3) {
    throw new CifStructureError(
      `A symmetry operation needs three components: ${JSON.stringify(text)}.`,
    );
  }
  const rotation: number[] = [];
  const translation: number[] = [];

  for (const component of components) {
    const terms = component.match(/[+-]?[^+-]+/g);
    if (!terms || terms.join("") !== component) {
      throw new CifStructureError(
        `Cannot read the symmetry operation ${JSON.stringify(text)}.`,
      );
    }
    const row = [0, 0, 0];
    let shift = 0;
    for (const term of terms) {
      const axis = AXES.findIndex((candidate) => term.includes(candidate));
      if (axis === -1) {
        shift += parseCoefficient(term);
      } else {
        const coefficient = parseCoefficient(
          term.replace(AXES[axis]!, "").replace(/\*$/, ""),
        );
        row[axis] = (row[axis] ?? 0) + coefficient;
      }
    }
    rotation.push(...row);
    translation.push(wrap(shift));
  }

  return { rotation, translation: translation as Vec3 };
}
