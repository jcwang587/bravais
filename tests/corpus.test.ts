import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildScene, expandStructure, readCif } from "../src/index";

/** Set BRAVAIS_CIF_CORPUS to a directory to read every CIF below it. */
const corpus = process.env.BRAVAIS_CIF_CORPUS;

function listCifs(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      files.push(...listCifs(path));
    } else if (entry.toLowerCase().endsWith(".cif")) {
      files.push(path);
    }
  }
  return files;
}

describe.skipIf(!corpus)("CIF corpus", () => {
  it("reads, expands and builds every file", async () => {
    const files = listCifs(corpus as string);
    const failures: string[] = [];
    for (const file of files) {
      try {
        const structure = await readCif(readFileSync(file, "utf8"));
        const scene = buildScene(expandStructure(structure));
        if (scene.atoms.length === 0) {
          failures.push(`${file}: no atoms`);
        }
      } catch (error) {
        failures.push(`${file}: ${(error as Error).message}`);
      }
    }
    expect(files.length).toBeGreaterThan(0);
    expect(failures).toEqual([]);
  }, 600_000);
});
