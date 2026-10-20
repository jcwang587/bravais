import { DataTexture, ShaderChunk, ShaderLib } from "three";
import { describe, expect, it } from "vitest";

import {
  createAtomMaterial,
  createBondMaterial,
} from "../src/render/materials.js";

/** What three.js hands `onBeforeCompile` for a MeshStandardMaterial. */
function standardShader() {
  return {
    uniforms: {},
    vertexShader: ShaderLib.standard.vertexShader,
    fragmentShader: ShaderLib.standard.fragmentShader,
  };
}

describe("materials", () => {
  it("find every shader include they patch in the installed three.js", () => {
    for (const material of [
      createAtomMaterial(1, new DataTexture(), true),
      createBondMaterial(1, 0.398),
    ]) {
      const shader = standardShader();
      material.onBeforeCompile(shader as never, null as never);
      expect(shader.vertexShader).toContain("gl_Position = projectionMatrix");
      expect(shader.fragmentShader).toContain("gl_FragDepth");
    }
    // The patched normal also replaces the one three.js keeps unperturbed.
    expect(ShaderChunk.normal_fragment_begin).toContain("nonPerturbedNormal");
  });

  it("name the include a three.js release no longer has", () => {
    const shader = { ...standardShader(), vertexShader: "void main() {}" };
    expect(() =>
      createBondMaterial(1, 0.398).onBeforeCompile(
        shader as never,
        null as never,
      ),
    ).toThrow("#include <common>");
  });
});
