import {
  AmbientLight,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  EqualStencilFunc,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  NotEqualStencilFunc,
  OrthographicCamera,
  Quaternion,
  SRGBColorSpace,
  Scene,
  Sprite,
  SpriteMaterial,
  SphereGeometry,
  Vector3,
  type WebGLRenderer,
} from "three";

import type { Mat3 } from "../structure/types.js";
import { GIZMO_AXIS_STENCIL, createGizmoMaterial } from "./materials.js";

/** Axis colours and proportions currently follow Pretty Lattice's gizmo. */
const AXIS_COLORS = { a: "#d27686", b: "#80c393", c: "#75a4dd" } as const;
const SHAFT_LENGTH = 0.82;
const SHAFT_RADIUS = 0.055;
const CONE_LENGTH = 0.24;
const CONE_RADIUS = 0.13;
const ORIGIN_RADIUS = 0.13;
const LABEL_DISTANCE = 1.3;
const LABEL_SCALE = 0.5;
/** Label texture size, a little above its size on screen, mipmapped down. */
const LABEL_TEXTURE_SIZE = 128;
/**
 * Each letter is drawn twice, dark over the background and white over an
 * arrow, the two told apart by the stencil mark the arrows leave, so a
 * letter stays readable where it crosses an arrow.
 */
const LABEL_COLOR = "#2a2a2a";
const LABEL_COLOR_OVER_AXES = "#ffffff";
/** World units visible across the gizmo viewport. */
const VIEW_EXTENT = 3.2;
const UP = new Vector3(0, 1, 0);

/** The plain italic letter of an axis, in the interface's font, drawn white for the sprite to tint. */
function labelTexture(label: string, fontFamily: string): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = LABEL_TEXTURE_SIZE;
  canvas.height = LABEL_TEXTURE_SIZE;
  const context = canvas.getContext("2d");
  if (context) {
    const fontSize = LABEL_TEXTURE_SIZE * 0.68;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = `italic 600 ${fontSize}px ${fontFamily}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#ffffff";
    context.fillText(label, canvas.width / 2, canvas.height / 2);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.premultiplyAlpha = true;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  return texture;
}

/** An arrow along +y with its letter at the tip; `setCell` turns it to its axis. */
function createAxisArrow(
  color: string,
  label: string,
  fontFamily: string,
): Group {
  const arrow = new Group();
  const material = createGizmoMaterial(color, GIZMO_AXIS_STENCIL);
  const shaft = new Mesh(
    new CylinderGeometry(SHAFT_RADIUS, SHAFT_RADIUS, SHAFT_LENGTH, 24),
    material,
  );
  shaft.position.y = SHAFT_LENGTH / 2;
  const cone = new Mesh(
    new ConeGeometry(CONE_RADIUS, CONE_LENGTH, 32),
    material,
  );
  cone.position.y = SHAFT_LENGTH + CONE_LENGTH / 2;
  arrow.add(shaft, cone);

  const texture = labelTexture(label, fontFamily);
  const passes = [
    [LABEL_COLOR, NotEqualStencilFunc],
    [LABEL_COLOR_OVER_AXES, EqualStencilFunc],
  ] as const;
  for (const [labelColor, stencilFunc] of passes) {
    const labelSprite = new Sprite(
      new SpriteMaterial({
        map: texture,
        color: labelColor,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        stencilWrite: true,
        stencilRef: GIZMO_AXIS_STENCIL,
        stencilFunc,
      }),
    );
    labelSprite.scale.set(LABEL_SCALE, LABEL_SCALE, 1);
    labelSprite.position.y = LABEL_DISTANCE;
    labelSprite.renderOrder = 10;
    arrow.add(labelSprite);
  }
  return arrow;
}

/** The a, b, c axes of the cell drawn in a corner, following the camera. */
export class AxesGizmo {
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
  private readonly axes = new Group();
  /** The a, b and c arrows, built once and turned to each new cell. */
  private readonly arrows: Group[];
  private readonly headlight = new DirectionalLight("#ffffff", 1.78);
  private readonly inverse = new Quaternion();
  private readonly direction = new Vector3();

  /** `fontFamily` is the interface font the axis letters are drawn in. */
  constructor(fontFamily: string) {
    this.camera.position.set(0, 0, 5);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(new AmbientLight("#ffffff", 0.68));
    this.headlight.position.set(1.6, 1.1, 5);
    this.scene.add(this.headlight);
    this.arrows = (["a", "b", "c"] as const).map((label) =>
      createAxisArrow(AXIS_COLORS[label], label, fontFamily),
    );
    const origin = new Mesh(
      new SphereGeometry(ORIGIN_RADIUS, 32, 16),
      createGizmoMaterial("#f3f2ee", 0),
    );
    this.axes.add(...this.arrows, origin);
    this.scene.add(this.axes);
  }

  /** Point the arrows along the cell's a, b and c axes. */
  setCell(cell: Mat3): void {
    this.arrows.forEach((arrow, axis) => {
      arrow.quaternion.setFromUnitVectors(
        UP,
        this.direction.set(...cell[axis]!).normalize(),
      );
    });
  }

  /** Draw into the bottom-left `size` pixels of a renderer whose main pass is done. */
  render(
    renderer: WebGLRenderer,
    cameraQuaternion: Quaternion,
    size: number,
  ): void {
    this.axes.quaternion.copy(this.inverse.copy(cameraQuaternion).invert());
    const half = VIEW_EXTENT / 2;
    this.camera.left = -half;
    this.camera.right = half;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
    const previousAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setViewport(0, 0, size, size);
    renderer.setScissor(0, 0, size, size);
    renderer.setScissorTest(true);
    renderer.clear(false, true, true);
    renderer.render(this.scene, this.camera);
    renderer.setScissorTest(false);
    renderer.autoClear = previousAutoClear;
  }

  dispose(): void {
    this.axes.traverse((object) => {
      if (object instanceof Mesh || object instanceof Sprite) {
        object.geometry.dispose();
        const material = object.material;
        if ("map" in material && material.map) {
          material.map.dispose();
        }
        material.dispose();
      }
    });
    this.axes.clear();
  }
}
