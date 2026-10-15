import { parseCif } from "./cif/parser";
import { isStructureBlock, parseCifStructure } from "./cif/structure";
import { operationsForSpaceGroup } from "./symmetry/moyo";
import { IDENTITY_OPERATION, type Structure } from "./structure/types";

export {
  parseCif,
  type CifBlock,
  type CifDocument,
  type CifLoop,
} from "./cif/parser";
export { CifSyntaxError } from "./cif/tokenizer";
export {
  CifStructureError,
  parseCifStructure,
  type ParsedCifStructure,
} from "./cif/structure";
export { parseSymmetryOperator } from "./cif/symmetry-operators";
export {
  SpaceGroupLookupError,
  ensureMoyo,
  operationsForSpaceGroup,
} from "./symmetry/moyo";
export {
  SymmetryAnalysisError,
  symmetryDataset,
  type SymmetryDataset,
  type SymmetryOptions,
} from "./symmetry/dataset";
export { typesetSymbol } from "./symmetry/symbol";
export { expandStructure } from "./structure/expand";
export { buildScene, structureElements } from "./scene/build";
export { createViewer, type Viewer, type ViewerOptions } from "./render/viewer";
export {
  createThumbnailRenderer,
  type ThumbnailRenderer,
} from "./render/thumbnails";
export type { SceneLayer } from "./render/model";
export type { ViewState } from "./render/camera";
export {
  elementColor,
  elementColorAssignments,
  ensureElementColors,
  resetElementColors,
} from "./render/palette";
export type {
  BuildSceneOptions,
  SceneAtom,
  StructureScene,
} from "./scene/build";
export type { Bond } from "./structure/bonds";
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
} from "./structure/types";

/**
 * Read the first structure in a CIF. Symmetry comes from the file's operator
 * loop, or from its space-group symbol or number through moyo when the loop
 * is missing; a file naming neither is taken as listing every atom (P1).
 */
export async function readCif(text: string): Promise<Structure> {
  const document = parseCif(text);
  const block = document.blocks.find(isStructureBlock) ?? document.blocks[0];
  if (!block) {
    throw new Error("The CIF has no data block.");
  }
  const parsed = parseCifStructure(block);
  const hasSpaceGroup =
    parsed.spaceGroup.hallSymbol !== null ||
    parsed.spaceGroup.symbol !== null ||
    parsed.spaceGroup.number !== null;
  const operations =
    parsed.operations ??
    (hasSpaceGroup
      ? await operationsForSpaceGroup(parsed.spaceGroup)
      : [IDENTITY_OPERATION]);
  return {
    lattice: parsed.lattice,
    sites: parsed.sites,
    operations,
    spaceGroup: parsed.spaceGroup,
  };
}
