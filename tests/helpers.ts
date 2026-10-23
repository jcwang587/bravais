import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FIXTURES = fileURLToPath(new URL("./fixtures/", import.meta.url));

/** The CIF text without its symmetry-operation loop. */
export function withoutOperationLoop(text: string): string {
  return text.replace(
    /loop_\s*\n((?:\s*_\S+\s*\n)+)((?:(?!\s*loop_|\s*_)[^\n]*\n)+)/g,
    (block, tags: string) =>
      /_space_group_symop_operation_xyz|_symmetry_equiv_pos_as_xyz/.test(tags)
        ? ""
        : block,
  );
}

/** The names of the CIFs under tests/fixtures. */
export function fixtureNames(): string[] {
  return readdirSync(FIXTURES)
    .filter((name) => name.endsWith(".cif"))
    .sort();
}

export function fixture(name: string): string {
  return readFileSync(`${FIXTURES}${name}`, "utf8");
}
