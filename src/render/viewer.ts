import {
  AmbientLight,
  DirectionalLight,
  Fog,
  MOUSE,
  OrthographicCamera,
  Quaternion,
  Scene,
  Vector3,
  WebGLRenderer,
  ACESFilmicToneMapping,
} from "three";
import { TrackballControls } from "three/addons/controls/TrackballControls.js";

import {
  applyPixelFrustum,
  applyViewState,
  cameraDistance,
  fitZoom,
  quaternionTuple,
  standardQuaternion,
} from "./camera.js";
import { AxesGizmo } from "./gizmo.js";
import { ElementLegend, ensureViewerStyles } from "./legend.js";
import {
  AMBIENT_LIGHT_INTENSITY,
  BACKGROUND_COLOR,
  HEADLIGHT_INTENSITY,
  HEADLIGHT_OFFSET,
} from "./materials.js";
import { createSceneModel, type SceneModel } from "./model.js";
import type { ViewState } from "./view-state.js";
import type { SceneLayer } from "../scene/build.js";

export interface ViewerOptions {
  /** Show the element legend. Default true. */
  legend?: boolean;
  /** Show the a, b, c axes in the corner. Default true. */
  gizmo?: boolean;
}

export interface Viewer {
  /**
   * Replace what is drawn with scenes from `buildScene`, usually of expanded
   * structures. The view resets to the standard orientation unless `view`
   * is given.
   */
  setLayers(layers: SceneLayer[], view?: ViewState | null): void;
  /** Remove everything drawn. */
  clear(): void;
  /** The current pose, or null while nothing is loaded. */
  getView(): ViewState | null;
  /** Restore a pose from `getView`, of this or another viewer. */
  setView(view: ViewState): void;
  /** Back to the standard orientation, fitted to the viewport. */
  resetView(): void;
  /** Refit to the element's size; call after layout changes the viewer's box. */
  resize(): void;
  /** Draw a frame now. */
  render(): void;
  /** Called after the user moves the camera. Returns the unsubscribe function. */
  onInteraction(listener: () => void): () => void;
  /** Take the viewer out of its container and release its WebGL resources. */
  dispose(): void;
}

/** Depth fading currently follows Pretty Lattice's default (amount and start 40%). */
const FOG_AMOUNT = 0.4;
const FOG_START = 0.4;
const FOG_FRONT_PADDING_RATIO = 0.4;
/** Trackball feel currently follows Pretty Lattice's: inertia on, no panning. */
const ROTATE_SPEED = 2;
const ZOOM_SPEED = 1.2;
const DAMPING = 0.2;
/**
 * TrackballControls turns the structure by pointer motion over half the
 * canvas width, so a narrow pane feels twitchier than a full window. The
 * rotate speed is scaled to the feel of a window this wide, whatever the
 * pane size.
 */
const REFERENCE_WIDTH_PX = 1500;
const MIN_SCALE = 0.2;
const MAX_SCALE = 5;
const IDLE_FRAMES = 3;
const MOTION_EPSILON = 1e-5;
/** Interaction listeners run every few rendered frames, and once more when motion stops. */
const NOTIFY_EVERY_FRAMES = 4;
/** Gizmo size as a share of the viewer's smaller side, within limits. */
const GIZMO_SIDE_RATIO = 0.35;
const GIZMO_MIN_PX = 110;
const GIZMO_MAX_PX = 180;

function depthFog(
  model: SceneModel,
  distance: number,
  quaternion: Quaternion,
): Fog {
  // The fog spans the structure's depth range along the standard view: it
  // starts a little in front of the farthest point and reaches full strength
  // at (back - near) / amount behind the start.
  const outward = new Vector3(0, 0, 1).applyQuaternion(quaternion);
  let front = 0;
  let back = 0;
  const corner = new Vector3();
  for (const x of [model.bounds.min.x, model.bounds.max.x]) {
    for (const y of [model.bounds.min.y, model.bounds.max.y]) {
      for (const z of [model.bounds.min.z, model.bounds.max.z]) {
        const depth = corner.set(x, y, z).dot(outward);
        front = Math.max(front, depth);
        back = Math.min(back, depth);
      }
    }
  }
  const span = Math.max(1, model.span);
  const backOffset = Math.max(0.01 * span, -back);
  const frontOffset = Math.min(backOffset, -front);
  const frontPadding = span * FOG_FRONT_PADDING_RATIO;
  const firstStart = frontOffset - frontPadding;
  const lastStart = Math.max(firstStart, backOffset - frontPadding);
  const startOffset = firstStart + (lastStart - firstStart) * FOG_START;
  const near = distance + startOffset;
  const far = near + (distance + backOffset - near) / FOG_AMOUNT;
  return new Fog(BACKGROUND_COLOR, near, far);
}

/**
 * Mount a crystal viewer in `container`. The viewer fills the container and
 * follows its size, so the container needs a height of its own. The call
 * gives the container the class `bravais-viewer` and adds, once per
 * document, a `<style id="bravais-styles">` for the overlays.
 */
export function createViewer(
  container: HTMLElement,
  options: ViewerOptions = {},
): Viewer {
  const root = container.ownerDocument;
  ensureViewerStyles(root);
  container.classList.add("bravais-viewer");

  // The stencil buffer is for the gizmo: its letters change colour over the axes.
  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: true,
    stencil: true,
  });
  renderer.setPixelRatio(root.defaultView?.devicePixelRatio ?? 1);
  renderer.setClearColor(BACKGROUND_COLOR, 1);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.domElement.className = "bravais-canvas";
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 1000);
  const ambient = new AmbientLight("#ffffff", AMBIENT_LIGHT_INTENSITY);
  const headlight = new DirectionalLight("#ffffff", HEADLIGHT_INTENSITY);
  headlight.target.position.set(0, 0, 0);
  scene.add(ambient, headlight, headlight.target);

  const legend = options.legend === false ? null : new ElementLegend(root);
  if (legend) {
    container.appendChild(legend.element);
  }
  // The axis letters are drawn in the font of the element the viewer sits in,
  // like the legend, so both match the surrounding interface.
  const fontFamily =
    root.defaultView?.getComputedStyle(container).fontFamily ?? "sans-serif";
  const gizmo = options.gizmo === false ? null : new AxesGizmo(fontFamily);

  const controls = new TrackballControls(camera, renderer.domElement);
  controls.rotateSpeed = ROTATE_SPEED;
  controls.zoomSpeed = ZOOM_SPEED;
  controls.dynamicDampingFactor = DAMPING;
  controls.staticMoving = false;
  controls.noPan = true;
  controls.mouseButtons.LEFT = MOUSE.ROTATE;
  controls.mouseButtons.MIDDLE = MOUSE.DOLLY;
  controls.mouseButtons.RIGHT = null;

  let model: SceneModel | null = null;
  let distance = 4;
  let fitted = 1;
  let width = 1;
  let height = 1;
  let frame: number | null = null;
  /** True from a wake until the loop decides to stop; a wake never starts a second loop. */
  let loopActive = false;
  let idleFrames = 0;
  /** A pointer button is down on the canvas; the loop must outlive idle frames. */
  let dragging = false;
  let framesSinceNotify = 0;
  let notifyPending = false;
  const lastQuaternion = new Quaternion();
  let lastZoom = 0;
  const lastTarget = new Vector3();
  const listeners = new Set<() => void>();
  const headlightOffset = new Vector3();

  function notify(): void {
    framesSinceNotify = 0;
    notifyPending = false;
    for (const listener of listeners) {
      listener();
    }
  }

  function updateHeadlight(): void {
    const lightDistance = Math.max(camera.position.length(), 4);
    headlightOffset
      .set(...HEADLIGHT_OFFSET)
      .multiplyScalar(lightDistance)
      .applyQuaternion(camera.quaternion);
    headlight.position.copy(camera.position).add(headlightOffset);
  }

  function render(): void {
    updateHeadlight();
    renderer.setViewport(0, 0, width, height);
    renderer.render(scene, camera);
    if (gizmo && model) {
      const size = Math.round(
        Math.min(
          GIZMO_MAX_PX,
          Math.max(GIZMO_MIN_PX, Math.min(width, height) * GIZMO_SIDE_RATIO),
        ),
      );
      gizmo.render(renderer, camera.quaternion, size);
    }
  }

  function measure(): void {
    const rect = container.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    renderer.setSize(width, height, false);
    applyPixelFrustum(camera, width, height);
    // The trackball maps pointer motion through the canvas size it last saw.
    controls.handleResize();
    controls.rotateSpeed = ROTATE_SPEED * (width / REFERENCE_WIDTH_PX);
  }

  function refit(quaternion: Quaternion): void {
    if (!model) {
      return;
    }
    fitted = fitZoom(model.bounds, quaternion, width, height);
    controls.minZoom = fitted * MIN_SCALE;
    controls.maxZoom = fitted * MAX_SCALE;
  }

  function cameraMoved(): boolean {
    const moved =
      lastQuaternion.angleTo(camera.quaternion) > MOTION_EPSILON ||
      Math.abs(lastZoom - camera.zoom) > MOTION_EPSILON * fitted ||
      lastTarget.distanceToSquared(controls.target) > MOTION_EPSILON;
    lastQuaternion.copy(camera.quaternion);
    lastZoom = camera.zoom;
    lastTarget.copy(controls.target);
    return moved;
  }

  // TrackballControls needs frames while a button is down and while it
  // damps afterwards; run a loop for exactly that long.
  function tick(): void {
    frame = null;
    // update() emits "change" when the camera moved; the wake that handles
    // it must not schedule a second loop, hence loopActive.
    controls.update();
    if (cameraMoved()) {
      idleFrames = 0;
      render();
      framesSinceNotify += 1;
      notifyPending = true;
      if (framesSinceNotify >= NOTIFY_EVERY_FRAMES) {
        notify();
      }
    } else {
      idleFrames += 1;
    }
    if (dragging || idleFrames < IDLE_FRAMES) {
      frame = requestAnimationFrame(tick);
      return;
    }
    loopActive = false;
    if (notifyPending) {
      notify();
    }
  }

  function wake(): void {
    idleFrames = 0;
    if (!loopActive) {
      loopActive = true;
      frame = requestAnimationFrame(tick);
    }
  }

  function stopLoop(): void {
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
    loopActive = false;
  }

  controls.addEventListener("start", () => {
    dragging = true;
    wake();
  });
  controls.addEventListener("end", () => {
    dragging = false;
    wake();
  });
  controls.addEventListener("change", wake);

  const observer =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          const scale = fitted > 0 ? camera.zoom / fitted : 1;
          measure();
          refit(camera.quaternion);
          camera.zoom = fitted * scale;
          camera.updateProjectionMatrix();
          render();
        });
  observer?.observe(container);
  measure();

  function applyView(view: ViewState): void {
    if (!model) {
      return;
    }
    applyViewState(camera, view, distance, model.span);
    controls.target.set(...view.target);
    refit(camera.quaternion);
    camera.zoom = fitted * view.scale;
    camera.updateProjectionMatrix();
    controls.update();
    cameraMoved();
  }

  function standardView(): ViewState {
    const quaternion = model
      ? standardQuaternion(model.cell)
      : new Quaternion();
    return {
      quaternion: quaternionTuple(quaternion),
      target: [0, 0, 0],
      scale: 1,
    };
  }

  const viewer: Viewer = {
    setLayers(layers, view = null) {
      viewer.clear();
      if (layers.length === 0) {
        return;
      }
      model = createSceneModel(layers);
      scene.add(model.group);
      distance = cameraDistance(model.span);
      scene.fog = depthFog(model, distance, standardQuaternion(model.cell));
      legend?.setElements(model.elements);
      gizmo?.setCell(model.cell);
      measure();
      applyView(view ?? standardView());
      render();
    },
    clear() {
      stopLoop();
      if (model) {
        scene.remove(model.group);
        model.dispose();
        model = null;
      }
      scene.fog = null;
      legend?.setElements([]);
      renderer.setViewport(0, 0, width, height);
      renderer.clear();
    },
    getView() {
      if (!model) {
        return null;
      }
      return {
        quaternion: quaternionTuple(camera.quaternion),
        target: [controls.target.x, controls.target.y, controls.target.z],
        scale: fitted > 0 ? camera.zoom / fitted : 1,
      };
    },
    setView(view) {
      applyView(view);
      render();
    },
    resetView() {
      applyView(standardView());
      render();
      notify();
    },
    resize() {
      const scale = fitted > 0 ? camera.zoom / fitted : 1;
      measure();
      refit(camera.quaternion);
      camera.zoom = fitted * scale;
      camera.updateProjectionMatrix();
      render();
    },
    render,
    onInteraction(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      viewer.clear();
      dragging = false;
      observer?.disconnect();
      controls.dispose();
      gizmo?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      legend?.element.remove();
      container.classList.remove("bravais-viewer");
    },
  };

  return viewer;
}
