import { OrthographicCamera, Scene, Vector3 } from "three";
import { expect, it, vi } from "vitest";

import { buildScene, expandStructure, readCif } from "../src/index.js";
import type { ViewState } from "../src/render/view-state.js";
import { fixture } from "./helpers.js";

/** Where the view's target lands on screen, in normalized device coordinates. */
const drawn: Vector3[] = [];
let target = new Vector3();

// A stage without WebGL: rendering records where the target projects.
vi.mock("../src/render/stage.js", () => ({
  createStage: () => {
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 1000);
    const domElement = { width: 0, height: 0 };
    return {
      renderer: {
        domElement,
        setSize(width: number, height: number) {
          domElement.width = width;
          domElement.height = height;
        },
        render() {
          camera.updateMatrixWorld();
          drawn.push(target.clone().project(camera));
        },
        dispose() {},
      },
      scene: new Scene(),
      camera,
      updateHeadlight() {},
    };
  },
}));

it("centres a thumbnail on the view's target", async () => {
  const { createThumbnailRenderer } =
    await import("../src/render/thumbnails.js");
  const scene = buildScene(
    expandStructure(await readCif(fixture("CoO-9008618.cif"))),
  );
  const view: ViewState = {
    quaternion: [0.1, 0.2, 0.3, 0.9],
    target: [0.5, -1, 1.5],
    scale: 1,
  };
  target = new Vector3(...view.target);
  const canvas = {
    width: 64,
    height: 48,
    getContext: () => ({ clearRect() {}, drawImage() {} }),
  };
  createThumbnailRenderer().render("CoO", [{ scene }], view, canvas as never);
  expect(drawn).toHaveLength(1);
  expect(drawn[0]!.x).toBeCloseTo(0, 9);
  expect(drawn[0]!.y).toBeCloseTo(0, 9);
});
