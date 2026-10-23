import { CifStructureError } from "./cif/errors.js";
import { parseCif } from "./cif/parser.js";
import { isStructureBlock, parseCifStructure } from "./cif/structure.js";
import { resolveOperations } from "./symmetry/resolve.js";
import type { Structure } from "./structure/types.js";

export { CifStructureError, CifSyntaxError } from "./cif/errors.js";
export {
  parseCif,
  type CifBlock,
  type CifDocument,
  type CifLoop,
} from "./cif/parser.js";
export { parseCifStructure, type ParsedCifStructure } from "./cif/structure.js";
export { parseSymmetryOperation } from "./cif/symmetry-operations.js";
export {
  SpaceGroupLookupError,
  ensureMoyo,
  operationsForSpaceGroup,
} from "./symmetry/moyo.js";
export {
  SymmetryAnalysisError,
  symmetryDataset,
  type SymmetryDataset,
  type SymmetryOptions,
} from "./symmetry/dataset.js";
export { typesetSymbol } from "./symmetry/symbol.js";
export { expandStructure } from "./structure/expand.js";
export {
  latticeFromParameters,
  latticeFromVectors,
} from "./structure/lattice.js";
export type { Bond } from "./structure/bonds.js";
export type {
  Lattice,
  LatticeParameters,
  Mat3,
  Site,
  SpaceGroupInfo,
  Species,
  Structure,
  SymmetryOperation,
  Vec3,
} from "./structure/types.js";
export {
  buildScene,
  structureElements,
  type BuildSceneOptions,
  type SceneAtom,
  type SceneLayer,
  type StructureScene,
} from "./scene/build.js";
export {
  createViewer,
  type Viewer,
  type ViewerOptions,
} from "./render/viewer.js";
export {
  createThumbnailRenderer,
  type ThumbnailRenderer,
} from "./render/thumbnails.js";
export type { ViewState } from "./render/view-state.js";
export {
  elementColor,
  elementColorAssignments,
  ensureElementColors,
  resetElementColors,
} from "./render/palette.js";

/**
 * Read the first structure in a CIF file. Its symmetry comes from the
 * file's list of symmetry operations or, without one, from its space-group
 * symbol or number; a file with neither is read as listing every atom.
 *
 * Throws `CifSyntaxError` for text that is not valid CIF,
 * `CifStructureError` for a file without a usable structure, and
 * `SpaceGroupLookupError` for an unknown space group.
 */
export async function readCif(text: string): Promise<Structure> {
  const document = parseCif(text);
  const block = document.blocks.find(isStructureBlock) ?? document.blocks[0];
  if (!block) {
    throw new CifStructureError("The CIF has no data block.");
  }
  const parsed = parseCifStructure(block);
  return {
    lattice: parsed.lattice,
    sites: parsed.sites,
    operations: await resolveOperations(parsed),
    spaceGroup: parsed.spaceGroup,
  };
}
