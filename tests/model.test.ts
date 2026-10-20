import { InstancedMesh, LineSegments, type Material } from "three";
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

  it("frees geometry and textures on dispose but keeps the materials", async () => {
    // Disposing the last material of a shader would make three.js delete
    // the compiled shader, and the next structure would compile it again.
    const model = createSceneModel([
      { scene: await sceneOf("faujasite-1507214.cif") },
    ]);
    const disposed: string[] = [];
    model.group.traverse((object) => {
      if (object instanceof InstancedMesh || object instanceof LineSegments) {
        object.geometry.addEventListener("dispose", () =>
          disposed.push("geometry"),
        );
        (object.material as Material).addEventListener("dispose", () =>
          disposed.push("material"),
        );
        object.userData.sectorTexture?.addEventListener("dispose", () =>
          disposed.push("texture"),
        );
      }
    });
    model.dispose();
    expect(disposed.sort()).toEqual([
      "geometry",
      "geometry",
      "geometry",
      "texture",
    ]);
  });
});
