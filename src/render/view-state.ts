import type { Vec3 } from "../structure/types.js";

/**
 * A view an app can save and restore, or pass between a viewer and a
 * thumbnail. It looks the same at any canvas size.
 */
export interface ViewState {
  /** Orientation of the camera as [x, y, z, w], three.js order. */
  quaternion: [number, number, number, number];
  /** The point looked at, in the centred frame: the first layer's cell centre is the origin. */
  target: Vec3;
  /**
   * Zoom relative to the zoom that fits every layer in the viewport in the
   * standard orientation, so a view keeps its zoom whatever its orientation.
   */
  scale: number;
}
