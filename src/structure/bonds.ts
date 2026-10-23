import vestaCutoffs from "../data/vesta-cutoffs.json";
import { distance } from "./lattice.js";
import type { Vec3 } from "./types.js";

const CUTOFFS = vestaCutoffs.pairs as Record<string, number>;
/** Two atoms closer than this are the alternatives of a split site, not bonded. */
const SHORTEST_BOND = 0.4;

export interface BondedAtom {
  element: string;
  position: Vec3;
}

/** A bond between two entries of `StructureScene.atoms`. */
export interface Bond {
  /** Index of one atom. */
  start: number;
  /** Index of the other. */
  end: number;
  /** Distance between them in ångström. */
  length: number;
}

/** VESTA's bond-search maximum for an element pair, or null when VESTA draws none. */
function bondCutoff(elementA: string, elementB: string): number | null {
  const key =
    elementA < elementB ? `${elementA}-${elementB}` : `${elementB}-${elementA}`;
  return CUTOFFS[key] ?? null;
}

/**
 * Bonds between the given atoms by VESTA's cutoff table. Only pairs VESTA
 * lists get bonds, so no metal-metal or anion-anion sticks appear. The bonds
 * are ordered by `start`, then `end`, and `start` is the lower index.
 */
export function findBonds(atoms: readonly BondedAtom[]): Bond[] {
  // Elements become small numbers and the cutoff of every pair present is
  // looked up once, 0 for a pair VESTA does not bond.
  const kinds = new Map<string, number>();
  const kindOf = atoms.map((atom) => {
    let kind = kinds.get(atom.element);
    if (kind === undefined) {
      kind = kinds.size;
      kinds.set(atom.element, kind);
    }
    return kind;
  });
  const elements = [...kinds.keys()];
  const cutoffs = new Float64Array(elements.length * elements.length);
  let longest = 0;
  elements.forEach((first, row) => {
    elements.forEach((second, column) => {
      const cutoff = bondCutoff(first, second) ?? 0;
      cutoffs[row * elements.length + column] = cutoff;
      longest = Math.max(longest, cutoff);
    });
  });
  if (longest < SHORTEST_BOND) {
    return [];
  }

  // Cubes as wide as the longest cutoff present: a bonded pair lies in one
  // cube or in two neighbouring ones. Keys count from one cube below the
  // lowest on each axis, so every neighbour of an occupied cube has its own.
  const cubes = atoms.map(
    (atom) =>
      atom.position.map((value) => Math.floor(value / longest) | 0) as Vec3,
  );
  const low: Vec3 = [Infinity, Infinity, Infinity];
  const high: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const cube of cubes) {
    for (let axis = 0; axis < 3; axis += 1) {
      low[axis] = Math.min(low[axis]!, cube[axis]!);
      high[axis] = Math.max(high[axis]!, cube[axis]!);
    }
  }
  const ny = high[1] - low[1] + 3;
  const nz = high[2] - low[2] + 3;
  const cubeKey = (x: number, y: number, z: number) =>
    ((x - low[0] + 1) * ny + (y - low[1] + 1)) * nz + (z - low[2] + 1);
  const grid = new Map<number, number[]>();
  cubes.forEach(([x, y, z], index) => {
    const key = cubeKey(x, y, z);
    const bucket = grid.get(key);
    if (bucket) {
      bucket.push(index);
    } else {
      grid.set(key, [index]);
    }
  });

  const bonds: Bond[] = [];
  const found: Bond[] = [];
  atoms.forEach((atom, index) => {
    const [x, y, z] = cubes[index]!;
    const row = kindOf[index]! * elements.length;
    found.length = 0;
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          for (const other of grid.get(cubeKey(x + dx, y + dy, z + dz)) ?? []) {
            const cutoff = cutoffs[row + kindOf[other]!]!;
            if (other <= index || cutoff < SHORTEST_BOND) {
              continue;
            }
            const length = distance(atom.position, atoms[other]!.position);
            if (length >= SHORTEST_BOND && length <= cutoff) {
              found.push({ start: index, end: other, length });
            }
          }
        }
      }
    }
    bonds.push(...found.sort((left, right) => left.end - right.end));
  });
  return bonds;
}
