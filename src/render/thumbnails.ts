import { Quaternion } from "three";

import {
  applyPixelFrustum,
  applyViewState,
  cameraDistance,
  fitZoom,
  standardView,
} from "./camera.js";
import {
  createSceneModel,
  createShaderWarmup,
  type SceneModel,
} from "./model.js";
import { createStage } from "./stage.js";
import type { ViewState } from "./view-state.js";
import type { SceneLayer } from "../scene/build.js";

export interface ThumbnailRenderer {
  /**
   * Draw `layers` into `canvas` with `view`, or the standard view when null.
   * Models are cached by `key` and rebuilt when the layers array changes.
   */
  render(
    key: string,
    layers: SceneLayer[],
    view: ViewState | null,
    canvas: HTMLCanvasElement,
  ): void;
  /** Forget the cached model of `key`. */
  release(key: string): void;
  /** Free the shared WebGL context and every cached model. */
  dispose(): void;
}

interface CachedModel {
  layers: SceneLayer[];
  model: SceneModel;
}

/**
 * Draw small previews into ordinary canvases from one shared WebGL context,
 * so a list of structures does not need a context for each.
 */
export function createThumbnailRenderer(): ThumbnailRenderer {
  const { renderer, scene, camera, updateHeadlight } = createStage();
  const cache = new Map<string, CachedModel>();

  // Compile every shader now, all at once, so the driver can compile them in
  // parallel instead of one by one at the first thumbnail.
  const warmup = createShaderWarmup();
  scene.add(warmup.group);
  renderer.compile(scene, camera);
  scene.remove(warmup.group);
  warmup.dispose();

  function modelFor(key: string, layers: SceneLayer[]): SceneModel {
    const cached = cache.get(key);
    if (cached && cached.layers === layers) {
      return cached.model;
    }
    cached?.model.dispose();
    const model = createSceneModel(layers);
    cache.set(key, { layers, model });
    return model;
  }

  return {
    render(key, layers, view, canvas) {
      const context = canvas.getContext("2d");
      if (!context || layers.length === 0) {
        return;
      }
      const model = modelFor(key, layers);
      const width = Math.max(1, canvas.width);
      const height = Math.max(1, canvas.height);
      // Resizing a WebGL canvas recreates its drawing buffer; only do it on change.
      if (
        renderer.domElement.width !== width ||
        renderer.domElement.height !== height
      ) {
        renderer.setSize(width, height, false);
      }
      applyPixelFrustum(camera, width, height);
      const distance = cameraDistance(model.span);
      const pose = view ?? standardView(model.cell);
      applyViewState(camera, pose, distance, model.span);
      camera.zoom =
        fitZoom(
          model.bounds,
          new Quaternion(...pose.quaternion),
          width,
          height,
        ) * pose.scale;
      camera.updateProjectionMatrix();
      updateHeadlight();

      scene.add(model.group);
      renderer.render(scene, camera);
      scene.remove(model.group);
      context.clearRect(0, 0, width, height);
      context.drawImage(renderer.domElement, 0, 0, width, height);
    },
    release(key) {
      cache.get(key)?.model.dispose();
      cache.delete(key);
    },
    dispose() {
      for (const cached of cache.values()) {
        cached.model.dispose();
      }
      cache.clear();
      renderer.dispose();
    },
  };
}
