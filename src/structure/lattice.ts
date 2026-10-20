import type { Lattice, LatticeParameters, Mat3, Vec3 } from "./types.js";

const DEGREES = Math.PI / 180;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * A lattice from cell lengths in ångström and angles in degrees. The c axis
 * points along z and a lies in the xz plane, as in pymatgen.
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

/** A lattice from its three cell vectors, in ångström. */
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

export function distance(p: Vec3, q: Vec3): number {
  const dx = p[0] - q[0];
  const dy = p[1] - q[1];
  const dz = p[2] - q[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
