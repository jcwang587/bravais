import type { Vec3 } from "../structure/types.js";

/**
 * A camera pose an app can store, restore and carry between a viewer and a
 * thumbnail: the same state reads the same at any canvas size.
 */
export interface ViewState {
  /** Orientation of the camera as [x, y, z, w], three.js order. */
  quaternion: [number, number, number, number];
  /** The point looked at, in the centred frame: the first layer's cell centre is the origin. */
  target: Vec3;
  /** Zoom relative to the zoom that fits the structure in the viewport. */
  scale: number;
}
