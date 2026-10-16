import type { Lattice, LatticeParameters, Mat3, Vec3 } from "./types.js";

const DEGREES = Math.PI / 180;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Cartesian row vectors for cell parameters, in the convention pymatgen uses
 * by default: c along z and a in the xz plane.
 */
export function latticeFromParameters(parameters: LatticeParameters): Lattice {
  const { a, b, c } = parameters;
  const alpha = parameters.alpha * DEGREES;
  const beta = parameters.beta * DEGREES;
  const gamma = parameters.gamma * DEGREES;
  const cosAlpha = Math.cos(alpha);
  const cosBeta = Math.cos(beta);
  const cosGamma = Math.cos(gamma);
  const sinAlpha = Math.sin(alpha);
  const sinBeta = Math.sin(beta);
  const gammaStar = Math.acos(
    clamp((cosAlpha * cosBeta - cosGamma) / (sinAlpha * sinBeta), -1, 1),
  );
  const vectorA: Vec3 = [a * sinBeta, 0, a * cosBeta];
  const vectorB: Vec3 = [
    -b * sinAlpha * Math.cos(gammaStar),
    b * sinAlpha * Math.sin(gammaStar),
    b * cosAlpha,
  ];
  const vectorC: Vec3 = [0, 0, c];
  return { ...parameters, vectors: [vectorA, vectorB, vectorC] };
}

/** Cell parameters of three Cartesian row vectors. */
export function latticeFromVectors(vectors: Mat3): Lattice {
  const [a, b, c] = vectors;
  const length = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);
  const angle = (u: Vec3, v: Vec3) =>
    Math.acos(
      clamp(
        (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (length(u) * length(v)),
        -1,
        1,
      ),
    ) / DEGREES;
  return {
    a: length(a),
    b: length(b),
    c: length(c),
    alpha: angle(b, c),
    beta: angle(a, c),
    gamma: angle(a, b),
    vectors,
  };
}

export function fractionalToCartesian(
  lattice: Lattice,
  fractional: Vec3,
): Vec3 {
  const [va, vb, vc] = lattice.vectors;
  const [x, y, z] = fractional;
  return [
    x * va[0] + y * vb[0] + z * vc[0],
    x * va[1] + y * vb[1] + z * vc[1],
    x * va[2] + y * vb[2] + z * vc[2],
  ];
}

export function cartesianToFractional(lattice: Lattice, cartesian: Vec3): Vec3 {
  const inverse = invertMatrix(lattice.vectors);
  const [x, y, z] = cartesian;
  const [ra, rb, rc] = inverse;
  return [
    x * ra[0] + y * rb[0] + z * rc[0],
    x * ra[1] + y * rb[1] + z * rc[1],
    x * ra[2] + y * rb[2] + z * rc[2],
  ];
}

/** Inverse of a matrix given as three row vectors, also as row vectors. */
export function invertMatrix(rows: Mat3): Mat3 {
  const [[a, b, c], [d, e, f], [g, h, i]] = rows;
  const determinant =
    a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(determinant) < 1e-12) {
    throw new Error("The lattice vectors are coplanar.");
  }
  const s = 1 / determinant;
  return [
    [(e * i - f * h) * s, (c * h - b * i) * s, (b * f - c * e) * s],
    [(f * g - d * i) * s, (a * i - c * g) * s, (c * d - a * f) * s],
    [(d * h - e * g) * s, (b * g - a * h) * s, (a * e - b * d) * s],
  ];
}

export function latticeVolume(lattice: Lattice): number {
  const [[a, b, c], [d, e, f], [g, h, i]] = lattice.vectors;
  return Math.abs(
    a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g),
  );
}

export function distance(p: Vec3, q: Vec3): number {
  const dx = p[0] - q[0];
  const dy = p[1] - q[1];
  const dz = p[2] - q[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
