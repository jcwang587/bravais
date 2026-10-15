import { Box3, Matrix4, OrthographicCamera, Quaternion, Vector3 } from "three";

import type { Mat3, Vec3 } from "../structure/types";

/**
 * A camera pose the app can store and restore: orientation, the point looked
 * at (in the centred frame) and the zoom relative to the fitted zoom, so the
 * same view reads the same in a 72 px thumbnail and the main viewer.
 */
export interface ViewState {
  quaternion: [number, number, number, number];
  target: Vec3;
  scale: number;
}

/**
 * The standard view is Naumann's clinographic projection, the convention of
 * crystal drawings and Pretty Lattice's default: c vertical, the crystal
 * turned by arctan(1/3) about c and tilted toward the viewer by arctan(1/6).
 */
const NAUMANN_HORIZONTAL_RATIO = 1 / 3;
const NAUMANN_VERTICAL_RATIO = 1 / 6;
/** The projected cell takes half the viewport's geometric mean size. */
const PROJECTED_FIT_PADDING_RATIO = 2;
const EPSILON = 1e-12;
const CAMERA_FORWARD = new Vector3(0, 0, -1);
const CAMERA_UP = new Vector3(0, 1, 0);

function projectPerpendicular(vector: Vector3, axis: Vector3): Vector3 | null {
  const projected = vector
    .clone()
    .sub(axis.clone().multiplyScalar(vector.dot(axis)));
  return projected.lengthSq() < EPSILON ? null : projected.normalize();
}

function stablePerpendicular(axis: Vector3): Vector3 {
  for (const candidate of [
    new Vector3(0, 0, 1),
    new Vector3(0, 1, 0),
    new Vector3(1, 0, 0),
  ]) {
    const projected = projectPerpendicular(candidate, axis);
    if (projected) {
      return projected;
    }
  }
  return new Vector3(0, 1, 0);
}

/** Camera outward direction and up vector of the standard view of a cell. */
export function standardViewVectors(cell: Mat3): {
  outward: Vector3;
  up: Vector3;
} {
  const a = new Vector3(...cell[0]);
  const b = new Vector3(...cell[1]);
  const vertical = new Vector3(...cell[2]).normalize();
  const basalReference =
    projectPerpendicular(a, vertical) ??
    projectPerpendicular(b, vertical) ??
    stablePerpendicular(vertical);
  const basalRight = vertical.clone().cross(basalReference).normalize();
  const outward = basalReference
    .clone()
    .add(basalRight.multiplyScalar(NAUMANN_HORIZONTAL_RATIO))
    .add(vertical.clone().multiplyScalar(NAUMANN_VERTICAL_RATIO))
    .normalize();
  const up =
    projectPerpendicular(vertical, outward) ?? stablePerpendicular(outward);
  return { outward, up };
}

/** Distance of the orthographic camera from its target; only the clipping depends on it. */
export function cameraDistance(span: number): number {
  return Math.max(4, span * 4);
}

export function standardQuaternion(cell: Mat3): Quaternion {
  const { outward, up } = standardViewVectors(cell);
  const right = up.clone().cross(outward).normalize();
  const correctedUp = outward.clone().cross(right).normalize();
  const basis = new Matrix4().makeBasis(right, correctedUp, outward);
  return new Quaternion().setFromRotationMatrix(basis).normalize();
}

/** Pose a camera from a view state. */
export function applyViewState(
  camera: OrthographicCamera,
  view: Pick<ViewState, "quaternion" | "target">,
  distance: number,
  span: number,
): void {
  const quaternion = new Quaternion(...view.quaternion).normalize();
  const target = new Vector3(...view.target);
  const forward = CAMERA_FORWARD.clone().applyQuaternion(quaternion);
  camera.position.copy(target).sub(forward.multiplyScalar(distance));
  camera.up.copy(CAMERA_UP.clone().applyQuaternion(quaternion));
  camera.quaternion.copy(quaternion);
  camera.near = 0.01;
  camera.far = Math.max(1000, distance + span * 8);
  camera.updateProjectionMatrix();
}

/** The orientation of a camera as a view-state quaternion. */
export function quaternionTuple(
  quaternion: Quaternion,
): [number, number, number, number] {
  return [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
}

/** Size of `bounds` projected on the screen plane of `quaternion`. */
export function projectedSize(
  bounds: Box3,
  quaternion: Quaternion,
): { width: number; height: number } {
  const right = new Vector3(1, 0, 0).applyQuaternion(quaternion);
  const up = new Vector3(0, 1, 0).applyQuaternion(quaternion);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const corner = new Vector3(x, y, z);
        const px = corner.dot(right);
        const py = corner.dot(up);
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      }
    }
  }
  return { width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

/** Orthographic zoom (pixels per ångström) that fits `bounds` in the viewport. */
export function fitZoom(
  bounds: Box3,
  quaternion: Quaternion,
  width: number,
  height: number,
): number {
  const projected = projectedSize(bounds, quaternion);
  const availableLength = Math.sqrt(Math.max(1, width) * Math.max(1, height));
  const projectedLength = Math.sqrt(projected.width * projected.height);
  return Math.max(
    0.01,
    availableLength / (projectedLength * PROJECTED_FIT_PADDING_RATIO),
  );
}

/** Frustum of an orthographic camera in pixel units, so `zoom` is pixels per ångström. */
export function applyPixelFrustum(
  camera: OrthographicCamera,
  width: number,
  height: number,
): void {
  camera.left = -width / 2;
  camera.right = width / 2;
  camera.top = height / 2;
  camera.bottom = -height / 2;
  camera.updateProjectionMatrix();
}
