import { findBonds, type Bond } from "../structure/bonds";
import { chemicalElement } from "../structure/elements";
import { periodicAtoms } from "../structure/images";
import { fractionalToCartesian } from "../structure/lattice";
import type { Mat3, Species, Structure, Vec3 } from "../structure/types";

export interface SceneAtom {
  siteIndex: number;
  /** The species with the largest occupancy; what colours the atom. */
  element: string;
  species: Species[];
  position: Vec3;
  fractional: Vec3;
  isImage: boolean;
}

export interface StructureScene {
  /** Cell row vectors in Cartesian ångström. */
  cell: Mat3;
  atoms: SceneAtom[];
  bonds: Bond[];
  /** Elements present, in order of first appearance, deuterium as hydrogen. */
  elements: string[];
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

/** Atoms, bonds and cell of a structure as the renderer draws them. */
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
