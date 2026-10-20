import { parseCif } from "./cif/parser.js";
import {
  CifStructureError,
  isStructureBlock,
  parseCifStructure,
} from "./cif/structure.js";
import { resolveOperations } from "./symmetry/resolve.js";
import type { Structure } from "./structure/types.js";

export {
  parseCif,
  type CifBlock,
  type CifDocument,
  type CifLoop,
} from "./cif/parser.js";
export { CifSyntaxError } from "./cif/tokenizer.js";
export {
  CifStructureError,
  parseCifStructure,
  type ParsedCifStructure,
} from "./cif/structure.js";
export { parseSymmetryOperator } from "./cif/symmetry-operators.js";
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
export { buildScene, structureElements } from "./scene/build.js";
export {
  createViewer,
  type Viewer,
  type ViewerOptions,
} from "./render/viewer.js";
export {
  createThumbnailRenderer,
  type ThumbnailRenderer,
} from "./render/thumbnails.js";
export type { SceneLayer } from "./scene/build.js";
export type { ViewState } from "./render/view-state.js";
export {
  elementColor,
  elementColorAssignments,
  ensureElementColors,
  resetElementColors,
} from "./render/palette.js";
export type {
  BuildSceneOptions,
  SceneAtom,
  StructureScene,
} from "./scene/build.js";
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

/**
 * Read the first structure in a CIF. Symmetry comes from the file's operator
 * loop, checked to fit its atoms, or from moyo by the file's space-group
 * symbol or number, in the setting its atoms or its cell select; a file
 * naming neither is taken as listing every atom (P1). Throws
 * `CifSyntaxError` for text that is not CIF, `CifStructureError` for a
 * CIF without a usable structure, and `SpaceGroupLookupError` for a space
 * group the symmetry table does not know.
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
