import { describe, expect, it } from "vitest";

import { buildScene, expandStructure, readCif } from "../src/index.js";
import { createSceneModel } from "../src/render/model.js";
import { latticeFromParameters } from "../src/structure/lattice.js";
import { fixture } from "./helpers.js";

async function sceneOf(name: string) {
  return buildScene(expandStructure(await readCif(fixture(name))));
}

describe("scene model", () => {
  it("frames the view on a layer at opacity 0 without drawing it", async () => {
    const structure = expandStructure(
      await readCif(fixture("CoO-9008618.cif")),
    );
    const raw = buildScene(structure);
    // The same sites in a larger cell, as a refinement might return them.
    const refined = buildScene({
      ...structure,
      lattice: latticeFromParameters({
        ...structure.lattice,
        a: 4.5,
        b: 4.5,
        c: 4.5,
      }),
    });
    const overlay = createSceneModel([
      { scene: raw, opacity: 0.6 },
      { scene: refined },
    ]);
    const rawDrawn = createSceneModel([
      { scene: raw },
      { scene: refined, opacity: 0 },
    ]);
    const refinedDrawn = createSceneModel([
      { scene: raw, opacity: 0 },
      { scene: refined },
    ]);

    for (const model of [rawDrawn, refinedDrawn]) {
      expect(model.center).toEqual(overlay.center);
      expect(model.bounds.equals(overlay.bounds)).toBe(true);
      expect(model.span).toBe(overlay.span);
    }
    expect(rawDrawn.group.children).toHaveLength(
      createSceneModel([{ scene: raw }]).group.children.length,
    );
    expect(refinedDrawn.group.children).toHaveLength(
      createSceneModel([{ scene: refined }]).group.children.length,
    );
  });

  it("lists the elements of the drawn layers only", async () => {
    const model = createSceneModel([
      { scene: await sceneOf("CoO-9008618.cif") },
      { scene: await sceneOf("TiO2-9015662.cif"), opacity: 0 },
    ]);
    expect(model.elements).toEqual(["Co", "O"]);
  });
});
