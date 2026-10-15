import {
  AmbientLight,
  DirectionalLight,
  OrthographicCamera,
  Quaternion,
  Scene,
  Vector3,
  WebGLRenderer,
  ACESFilmicToneMapping,
} from "three";

import {
  applyPixelFrustum,
  applyViewState,
  cameraDistance,
  fitZoom,
  quaternionTuple,
  standardQuaternion,
  type ViewState,
} from "./camera";
import {
  AMBIENT_LIGHT_INTENSITY,
  BACKGROUND_COLOR,
  HEADLIGHT_INTENSITY,
  HEADLIGHT_OFFSET,
} from "./materials";
import { createSceneModel, type SceneLayer, type SceneModel } from "./model";

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
  /** Drop the cached model of `key`. */
  release(key: string): void;
  dispose(): void;
}

interface CachedModel {
  layers: SceneLayer[];
  model: SceneModel;
}

/**
 * One shared WebGL context that paints small previews into ordinary 2D
 * canvases, so a list of structures does not open a context per card.
 */
export function createThumbnailRenderer(): ThumbnailRenderer {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(BACKGROUND_COLOR, 1);
  renderer.toneMapping = ACESFilmicToneMapping;
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 1000);
  const headlight = new DirectionalLight("#ffffff", HEADLIGHT_INTENSITY);
  scene.add(
    new AmbientLight("#ffffff", AMBIENT_LIGHT_INTENSITY),
    headlight,
    headlight.target,
  );
  const cache = new Map<string, CachedModel>();
  const headlightOffset = new Vector3();

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
      const pose: ViewState = view ?? {
        quaternion: quaternionTuple(standardQuaternion(model.cell)),
        target: [0, 0, 0],
        scale: 1,
      };
      applyViewState(camera, pose, distance, model.span);
      const target = new Vector3(...pose.target);
      camera.position.add(target);
      camera.zoom =
        fitZoom(
          model.bounds,
          new Quaternion(...pose.quaternion),
          width,
          height,
        ) * pose.scale;
      camera.updateProjectionMatrix();
      headlightOffset
        .set(...HEADLIGHT_OFFSET)
        .multiplyScalar(Math.max(camera.position.length(), 4))
        .applyQuaternion(camera.quaternion);
      headlight.position.copy(camera.position).add(headlightOffset);

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
