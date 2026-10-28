import { OrthographicCamera, Scene, Vector3 } from "three";
import { expect, it, vi } from "vitest";

import { buildScene, expandStructure, readCif } from "../src/index.js";
import { standardView } from "../src/render/camera.js";
import type { ViewState } from "../src/render/view-state.js";
import { fixture } from "./helpers.js";

/** Where the view's target lands on screen, in normalized device coordinates. */
const drawn: Vector3[] = [];
/** The camera zoom of each render. */
const zooms: number[] = [];
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
        compile() {},
        render() {
          camera.updateMatrixWorld();
          drawn.push(target.clone().project(camera));
          zooms.push(camera.zoom);
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

it("draws a view at the zoom its scale says, whatever its orientation", async () => {
  const { createThumbnailRenderer } =
    await import("../src/render/thumbnails.js");
  const scene = buildScene(
    expandStructure(await readCif(fixture("LiNiMnCoO2-4002443.cif"))),
  );
  const standard = standardView(scene.cell);
  // Looking down the long c axis, where the cell projects much smaller.
  const rotated: ViewState = { ...standard, quaternion: [0, 0, 0, 1] };
  const canvas = {
    width: 64,
    height: 48,
    getContext: () => ({ clearRect() {}, drawImage() {} }),
  };
  const renderer = createThumbnailRenderer();
  zooms.length = 0;
  renderer.render("standard", [{ scene }], standard, canvas as never);
  renderer.render("rotated", [{ scene }], rotated, canvas as never);
  expect(zooms).toHaveLength(2);
  expect(zooms[1]).toBeCloseTo(zooms[0]!, 9);
});
