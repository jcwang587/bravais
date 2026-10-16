import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  Color,
  DataTexture,
  Float32BufferAttribute,
  FloatType,
  Group,
  InstancedMesh,
  LineSegments,
  Matrix4,
  NearestFilter,
  Object3D,
  PlaneGeometry,
  Quaternion,
  RGBAFormat,
  Vector3,
} from "three";

import type { SceneAtom, SceneLayer, StructureScene } from "../scene/build.js";
import type { Mat3, Vec3 } from "../structure/types.js";
import {
  SECTOR_SITES_PER_ROW,
  SECTOR_TEXELS_PER_SITE,
  VACANCY_COLOR,
  VACANCY_FLAG,
  createAtomMaterial,
  createBondMaterial,
  createCellFrameMaterial,
  disposeMaterial,
} from "./materials.js";
import { elementColor, ensureElementColors } from "./palette.js";

/** Every atom is drawn at this radius, in ångström: one size for all. */
const ATOM_RADIUS = 0.4;
/** Bond tube radius in ångström. */
const BOND_RADIUS = 0.1;
/**
 * A bond half ends on a sphere this much smaller than its atom's, so the
 * atom's surface lies in front of the tube's cap and rim: they are hidden
 * by an occupied sector, faintly tinted through a vacant one, and never
 * fight it for depth.
 */
const BOND_INSET = 0.002;
/** Radius of the sphere a bond half ends on. */
const CAP_RADIUS = ATOM_RADIUS - BOND_INSET;
/** Along-axis distance from an atom's centre to the rim of a bond half. */
const BOND_START = Math.sqrt(
  CAP_RADIUS * CAP_RADIUS - BOND_RADIUS * BOND_RADIUS,
);
const UP = new Vector3(0, 1, 0);

export interface SceneModel {
  group: Group;
  /** Cell row vectors of the first layer, the frame everything is centred on. */
  cell: Mat3;
  /** Centre of that cell, which `group` moves to the origin. */
  center: Vec3;
  /** Bounds of every atom and cell corner, in the centred frame. */
  bounds: Box3;
  /** Largest cell edge length of any layer. */
  span: number;
  elements: string[];
  dispose(): void;
}

function cellCorners(cell: Mat3): Vector3[] {
  const [a, b, c] = cell.map((row) => new Vector3(...row)) as [
    Vector3,
    Vector3,
    Vector3,
  ];
  const origin = new Vector3();
  return [
    origin,
    a.clone(),
    b.clone(),
    c.clone(),
    a.clone().add(b),
    a.clone().add(c),
    b.clone().add(c),
    a.clone().add(b).add(c),
  ];
}

export function cellCenter(cell: Mat3): Vec3 {
  const [a, b, c] = cell;
  return [
    (a[0] + b[0] + c[0]) / 2,
    (a[1] + b[1] + c[1]) / 2,
    (a[2] + b[2] + c[2]) / 2,
  ];
}

const CELL_EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 4],
  [1, 5],
  [2, 4],
  [2, 6],
  [3, 5],
  [3, 6],
  [4, 7],
  [5, 7],
  [6, 7],
];

function createCellFrame(cell: Mat3, opacity: number): LineSegments {
  const corners = cellCorners(cell);
  const positions: number[] = [];
  for (const [start, end] of CELL_EDGES) {
    const from = corners[start] as Vector3;
    const to = corners[end] as Vector3;
    positions.push(from.x, from.y, from.z, to.x, to.y, to.z);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  return new LineSegments(geometry, createCellFrameMaterial(opacity));
}

/**
 * The sector texture of a layer: per site, up to SECTOR_TEXELS_PER_SITE
 * texels of (colour, start fraction). The first species is the instance
 * colour and needs no texel; a vacant share ends the run in the vacancy
 * colour; species past the available texels extend the last sector.
 */
function createSectorTexture(atoms: SceneAtom[]): {
  texture: DataTexture;
  hasVacancies: boolean;
} {
  const width = SECTOR_SITES_PER_ROW * SECTOR_TEXELS_PER_SITE;
  const height = Math.max(1, Math.ceil(atoms.length / SECTOR_SITES_PER_ROW));
  const data = new Float32Array(width * height * 4).fill(1);
  const vacancy = new Color(VACANCY_COLOR);
  const color = new Color();
  let hasVacancies = false;
  atoms.forEach((atom, index) => {
    const row = Math.floor(index / SECTOR_SITES_PER_ROW);
    const column = (index % SECTOR_SITES_PER_ROW) * SECTOR_TEXELS_PER_SITE;
    let offset = (row * width + column) * 4;
    let written = 0;
    let cumulative = Math.min(1, atom.species[0]?.occupancy ?? 1);
    for (const entry of atom.species.slice(1)) {
      if (written < SECTOR_TEXELS_PER_SITE - 1) {
        color.set(elementColor(entry.element)).toArray(data, offset);
        data[offset + 3] = cumulative;
        offset += 4;
        written += 1;
      }
      cumulative = Math.min(1, cumulative + entry.occupancy);
    }
    if (cumulative < 1 - 1e-6) {
      vacancy.toArray(data, offset);
      data[offset + 3] = cumulative + VACANCY_FLAG;
      hasVacancies = true;
    }
  });
  const texture = new DataTexture(data, width, height, RGBAFormat, FloatType);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return { texture, hasVacancies };
}

function createAtoms(atoms: SceneAtom[], opacity: number): InstancedMesh {
  // One camera-facing quad per atom; the material draws the sphere on it.
  const geometry = new PlaneGeometry(2, 2);
  const sectors = createSectorTexture(atoms);
  const mesh = new InstancedMesh(
    geometry,
    createAtomMaterial(opacity, sectors.texture, sectors.hasVacancies),
    atoms.length,
  );
  const matrix = new Matrix4();
  atoms.forEach((atom, index) => {
    matrix.makeScale(ATOM_RADIUS, ATOM_RADIUS, ATOM_RADIUS);
    matrix.setPosition(atom.position[0], atom.position[1], atom.position[2]);
    mesh.setMatrixAt(index, matrix);
    mesh.setColorAt(index, new Color(elementColor(atom.element)));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.userData.sectorTexture = sectors.texture;
  return mesh;
}

/**
 * Two half tubes per bond, each in its atom's colour, from the atom's sphere
 * to the midpoint. Each instance is the box around its half; the material
 * draws the tube inside it, cut on the atom's sphere.
 */
function createBonds(
  scene: StructureScene,
  opacity: number,
): InstancedMesh | null {
  if (scene.bonds.length === 0) {
    return null;
  }
  const geometry = new BoxGeometry(2, 1, 2);
  const mesh = new InstancedMesh(
    geometry,
    createBondMaterial(opacity, CAP_RADIUS),
    scene.bonds.length * 2,
  );
  const placeholder = new Object3D();
  const start = new Vector3();
  const end = new Vector3();
  const direction = new Vector3();
  const quaternion = new Quaternion();
  scene.bonds.forEach((bond, index) => {
    const startAtom = scene.atoms[bond.start] as SceneAtom;
    const endAtom = scene.atoms[bond.end] as SceneAtom;
    start.set(...startAtom.position);
    end.set(...endAtom.position);
    direction.subVectors(end, start);
    const half = direction.length() / 2;
    direction.normalize();
    quaternion.setFromUnitVectors(UP, direction);
    const halves: [number, SceneAtom, number, number][] = [
      [0, startAtom, BOND_START, half],
      [1, endAtom, half, 2 * half - BOND_START],
    ];
    for (const [slot, atom, from, to] of halves) {
      const length = Math.max(0, to - from);
      placeholder.position
        .copy(start)
        .addScaledVector(direction, from + length / 2);
      placeholder.quaternion.copy(quaternion);
      placeholder.scale.set(BOND_RADIUS, length, BOND_RADIUS);
      placeholder.updateMatrix();
      mesh.setMatrixAt(index * 2 + slot, placeholder.matrix);
      mesh.setColorAt(index * 2 + slot, new Color(elementColor(atom.element)));
    }
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  return mesh;
}

/** Build the three.js objects for the layers, centred on the first cell. */
export function createSceneModel(layers: SceneLayer[]): SceneModel {
  const first = layers[0];
  if (!first) {
    throw new Error("A scene model needs at least one layer.");
  }
  // Colours are settled for the whole set in one go, most common element
  // first, so the result does not depend on the order atoms are drawn in.
  ensureElementColors(
    layers.flatMap((layer) => [
      ...layer.scene.elements,
      ...layer.scene.atoms.map((atom) => atom.element),
    ]),
  );
  const center = cellCenter(first.scene.cell);
  const group = new Group();
  group.position.set(-center[0], -center[1], -center[2]);
  const bounds = new Box3();
  const elements: string[] = [];
  let span = 1;
  const disposables: (InstancedMesh | LineSegments)[] = [];

  for (const layer of layers) {
    const opacity = layer.opacity ?? 1;
    const atoms = createAtoms(layer.scene.atoms, opacity);
    group.add(atoms);
    disposables.push(atoms);
    const bonds = createBonds(layer.scene, opacity);
    if (bonds) {
      group.add(bonds);
      disposables.push(bonds);
    }
    const frame = createCellFrame(layer.scene.cell, opacity);
    group.add(frame);
    disposables.push(frame);
    for (const corner of cellCorners(layer.scene.cell)) {
      bounds.expandByPoint(corner.sub(new Vector3(...center)));
    }
    for (const atom of layer.scene.atoms) {
      const position = new Vector3(...atom.position).sub(
        new Vector3(...center),
      );
      bounds.expandByPoint(position.clone().addScalar(ATOM_RADIUS));
      bounds.expandByPoint(position.clone().subScalar(ATOM_RADIUS));
    }
    for (const row of layer.scene.cell) {
      span = Math.max(span, Math.hypot(...row));
    }
    for (const element of layer.scene.elements) {
      if (!elements.includes(element)) {
        elements.push(element);
      }
    }
  }

  return {
    group,
    cell: first.scene.cell,
    center,
    bounds,
    span,
    elements,
    dispose() {
      for (const object of disposables) {
        object.geometry.dispose();
        disposeMaterial(object.material);
        const sectors = object.userData.sectorTexture;
        if (sectors instanceof DataTexture) {
          sectors.dispose();
        }
      }
      group.clear();
    },
  };
}
