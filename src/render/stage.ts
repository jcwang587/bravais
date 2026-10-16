import {
  ACESFilmicToneMapping,
  AmbientLight,
  DirectionalLight,
  OrthographicCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";

import {
  AMBIENT_LIGHT_INTENSITY,
  BACKGROUND_COLOR,
  HEADLIGHT_INTENSITY,
  HEADLIGHT_OFFSET,
} from "./materials.js";

/** The renderer, scene, camera and lights the viewer and the thumbnail renderer share. */
export interface Stage {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: OrthographicCamera;
  /** Move the headlight along with the camera; call before each render. */
  updateHeadlight(): void;
}

export function createStage(options: { stencil?: boolean } = {}): Stage {
  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: true,
    stencil: options.stencil ?? false,
  });
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
  const offset = new Vector3();
  return {
    renderer,
    scene,
    camera,
    updateHeadlight() {
      const lightDistance = Math.max(camera.position.length(), 4);
      offset
        .set(...HEADLIGHT_OFFSET)
        .multiplyScalar(lightDistance)
        .applyQuaternion(camera.quaternion);
      headlight.position.copy(camera.position).add(offset);
    },
  };
}
