import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The CIF text without its symmetry-operator loop. */
export function withoutOperatorLoop(text: string): string {
  return text.replace(
    /loop_\s*\n((?:\s*_\S+\s*\n)+)((?:(?!\s*loop_|\s*_)[^\n]*\n)+)/g,
    (block, tags: string) =>
      /_space_group_symop_operation_xyz|_symmetry_equiv_pos_as_xyz/.test(tags)
        ? ""
        : block,
  );
}

export function fixture(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)),
    "utf8",
  );
}
