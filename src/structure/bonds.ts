import vestaCutoffs from "../data/vesta-cutoffs.json";
import { distance } from "./lattice.js";
import type { Vec3 } from "./types.js";

const CUTOFFS = vestaCutoffs.pairs as Record<string, number>;
const LONGEST_CUTOFF = Math.max(...Object.values(CUTOFFS));
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
export function bondCutoff(elementA: string, elementB: string): number | null {
  const key =
    elementA < elementB ? `${elementA}-${elementB}` : `${elementB}-${elementA}`;
  return CUTOFFS[key] ?? null;
}

function cellKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

/**
 * Bonds between the given atoms by VESTA's cutoff table. Only pairs VESTA
 * lists get bonds, so no metal-metal or anion-anion sticks appear.
 */
export function findBonds(atoms: readonly BondedAtom[]): Bond[] {
  const grid = new Map<string, number[]>();
  const cells: [number, number, number][] = [];
  atoms.forEach((atom, index) => {
    const cell: [number, number, number] = [
      Math.floor(atom.position[0] / LONGEST_CUTOFF),
      Math.floor(atom.position[1] / LONGEST_CUTOFF),
      Math.floor(atom.position[2] / LONGEST_CUTOFF),
    ];
    cells.push(cell);
    const key = cellKey(...cell);
    const bucket = grid.get(key);
    if (bucket) {
      bucket.push(index);
    } else {
      grid.set(key, [index]);
    }
  });

  const bonds: Bond[] = [];
  atoms.forEach((atom, index) => {
    const [cx, cy, cz] = cells[index] as [number, number, number];
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          const bucket = grid.get(cellKey(cx + dx, cy + dy, cz + dz));
          if (!bucket) {
            continue;
          }
          for (const other of bucket) {
            if (other <= index) {
              continue;
            }
            const neighbour = atoms[other] as BondedAtom;
            const cutoff = bondCutoff(atom.element, neighbour.element);
            if (cutoff === null) {
              continue;
            }
            const length = distance(atom.position, neighbour.position);
            if (length >= SHORTEST_BOND && length <= cutoff) {
              bonds.push({ start: index, end: other, length });
            }
          }
        }
      }
    }
  });
  return bonds;
}
