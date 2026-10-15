import type { SymmetryOperation, Vec3 } from "../structure/types";

const AXES = ["x", "y", "z"] as const;

function parseCoefficient(text: string): number {
  if (text === "" || text === "+") {
    return 1;
  }
  if (text === "-") {
    return -1;
  }
  const fraction = text.match(/^([+-]?\d+)\/(\d+)$/);
  if (fraction) {
    return Number(fraction[1]) / Number(fraction[2]);
  }
  const value = Number(text);
  if (!Number.isFinite(value)) {
    throw new Error(
      `Cannot read the number ${JSON.stringify(text)} in a symmetry operator.`,
    );
  }
  return value;
}

function wrapTranslation(value: number): number {
  const wrapped = value - Math.floor(value);
  return Math.abs(wrapped - 1) < 1e-9 ? 0 : wrapped;
}

/**
 * Parse one Jones-faithful operator such as `-x+1/2, y, -z+1/2` or
 * `2/3+x,1/3+y,1/3+z` into a rotation matrix and translation.
 */
export function parseSymmetryOperator(text: string): SymmetryOperation {
  // Only signs, digits, fractions, decimals and x, y, z can belong to an
  // operator; stray letters such as the "t" some exports append are dropped.
  const components = text
    .split(",")
    .map((part) => part.toLowerCase().replace(/[^xyz0-9./+-]/g, ""));
  if (components.length !== 3) {
    throw new Error(
      `A symmetry operator needs three components: ${JSON.stringify(text)}.`,
    );
  }
  const rotation: number[] = [];
  const translation: number[] = [];

  for (const component of components) {
    const terms = component.match(/[+-]?[^+-]+/g);
    if (!terms || terms.join("") !== component) {
      throw new Error(
        `Cannot read the symmetry operator ${JSON.stringify(text)}.`,
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
          term.replace(AXES[axis] as string, "").replace(/\*$/, ""),
        );
        row[axis] = (row[axis] ?? 0) + coefficient;
      }
    }
    rotation.push(...row);
    translation.push(wrapTranslation(shift));
  }

  return { rotation, translation: translation as Vec3 };
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
