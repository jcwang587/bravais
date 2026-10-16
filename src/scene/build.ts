import { findBonds, type Bond } from "../structure/bonds.js";
import { chemicalElement } from "../structure/elements.js";
import { periodicAtoms } from "../structure/images.js";
import { fractionalToCartesian } from "../structure/lattice.js";
import type { Mat3, Species, Structure, Vec3 } from "../structure/types.js";

export interface SceneAtom {
  /** Index into `Structure.sites` of the site this atom belongs to. */
  siteIndex: number;
  /** The species with the largest occupancy; what colours the atom. */
  element: string;
  /** Every species on the site, by descending occupancy. */
  species: Species[];
  /** Cartesian position in ångström. */
  position: Vec3;
  /** Fractional position; image atoms lie on the far faces, edges or corners. */
  fractional: Vec3;
  /** True for a boundary site repeated on the opposite face, edge or corner. */
  isImage: boolean;
}

export interface StructureScene {
  /** Cell row vectors in Cartesian ångström. */
  cell: Mat3;
  atoms: SceneAtom[];
  /** Bonds between entries of `atoms`. */
  bonds: Bond[];
  /** Elements present, in order of first appearance, deuterium as hydrogen. */
  elements: string[];
}

/** One structure drawn in a viewer; several overlay, each with its own opacity. */
export interface SceneLayer {
  scene: StructureScene;
  /** 1 draws the layer solid; a lower value draws it translucent over the others. Default 1. */
  opacity?: number;
}

export interface BuildSceneOptions {
  /** Draw image atoms: boundary sites repeated on the opposite faces, edges and corners. Default true. */
  imageAtoms?: boolean;
}

/** Every chemical element on any site, in order of first appearance. */
export function structureElements(structure: Structure): string[] {
  const elements: string[] = [];
  for (const site of structure.sites) {
    for (const species of site.species) {
      const element = chemicalElement(species.element);
      if (!elements.includes(element)) {
        elements.push(element);
      }
    }
  }
  return elements;
}

/**
 * Atoms, bonds and cell of a structure as the renderer draws them. The sites
 * are drawn as listed and `operations` are not applied: pass
 * `expandStructure(structure)` to draw the full cell.
 */
export function buildScene(
  structure: Structure,
  options: BuildSceneOptions = {},
): StructureScene {
  const atoms: SceneAtom[] = periodicAtoms(
    structure.sites,
    options.imageAtoms ?? true,
  ).map((atom) => {
    const site = structure.sites[atom.siteIndex];
    if (!site) {
      throw new Error(`Site ${atom.siteIndex} is missing.`);
    }
    const majority = site.species[0];
    if (!majority) {
      throw new Error(`Site ${site.label} has no species.`);
    }
    return {
      siteIndex: atom.siteIndex,
      element: majority.element,
      species: site.species,
      position: fractionalToCartesian(structure.lattice, atom.fractional),
      fractional: atom.fractional,
      isImage: atom.isImage,
    };
  });
  return {
    cell: structure.lattice.vectors,
    atoms,
    bonds: findBonds(atoms),
    elements: structureElements(structure),
  };
}
