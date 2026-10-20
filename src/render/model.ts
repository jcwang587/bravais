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
  /** Bounds of every atom and cell corner of every layer, in the centred frame. */
  bounds: Box3;
  /** Largest cell edge length of any layer. */
  span: number;
  /** Elements of the drawn layers. */
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

/** Session colours as three.js colours, each parsed once. */
function colorLookup(): (element: string) => Color {
  const colors = new Map<string, Color>();
  return (element) => {
    let color = colors.get(element);
    if (!color) {
      color = new Color(elementColor(element));
      colors.set(element, color);
    }
    return color;
  };
}

function createAtoms(
  atoms: SceneAtom[],
  opacity: number,
  colorOf: (element: string) => Color = colorLookup(),
): InstancedMesh {
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
    mesh.setColorAt(index, colorOf(atom.element));
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
  colorOf: (element: string) => Color = colorLookup(),
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
      mesh.setColorAt(index * 2 + slot, colorOf(atom.element));
    }
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  return mesh;
}

/**
 * Build the three.js objects for the layers, centred on the first cell. A
 * layer at opacity 0 is not drawn but still counts toward the centre, the
 * bounds and the span.
 */
export function createSceneModel(layers: SceneLayer[]): SceneModel {
  const first = layers[0];
  if (!first) {
    throw new Error("A scene model needs at least one layer.");
  }
  // Colours are settled for the whole set in one go, most common element
  // first, so the result depends neither on the order atoms are drawn in nor
  // on which layers are drawn.
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
  const offset = new Vector3(...center);
  const position = new Vector3();
  const extent = new Vector3();

  for (const layer of layers) {
    for (const corner of cellCorners(layer.scene.cell)) {
      bounds.expandByPoint(corner.sub(offset));
    }
    for (const atom of layer.scene.atoms) {
      position.set(...atom.position).sub(offset);
      bounds.expandByPoint(extent.copy(position).addScalar(ATOM_RADIUS));
      bounds.expandByPoint(extent.copy(position).subScalar(ATOM_RADIUS));
    }
    for (const row of layer.scene.cell) {
      span = Math.max(span, Math.hypot(...row));
    }
    const opacity = layer.opacity ?? 1;
    if (opacity <= 0) {
      continue;
    }
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
      disposeGeometry(disposables);
      group.clear();
    },
  };
}

/**
 * Free the geometry and textures of `objects`. The materials are left to the
 * garbage collector: disposing the last material of a shader makes three.js
 * delete the compiled shader, and the next structure would compile it again.
 */
function disposeGeometry(objects: (InstancedMesh | LineSegments)[]): void {
  for (const object of objects) {
    object.geometry.dispose();
    const sectors = object.userData.sectorTexture;
    if (sectors instanceof DataTexture) {
      sectors.dispose();
    }
  }
}

/** Two atoms 2 Å apart and the bond between them. */
const WARMUP_SCENE: StructureScene = {
  cell: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  atoms: [0, 2].map((z, siteIndex) => ({
    siteIndex,
    element: "X",
    species: [{ element: "X", occupancy: 1 }],
    position: [0, 0, z],
    fractional: [0, 0, z],
    isImage: false,
  })),
  bonds: [{ start: 0, end: 1, length: 2 }],
  elements: [],
};

/**
 * A placeholder atom, bond and cell frame in every material a structure is
 * drawn with, opaque and see-through, so their shaders can compile before
 * the first structure arrives. It gives no element a colour.
 */
export function createShaderWarmup(): { group: Group; dispose(): void } {
  const white = new Color("#ffffff");
  const objects: (InstancedMesh | LineSegments)[] = [];
  for (const opacity of [1, 0.5]) {
    objects.push(
      createAtoms(WARMUP_SCENE.atoms, opacity, () => white),
      createBonds(WARMUP_SCENE, opacity, () => white) as InstancedMesh,
    );
  }
  objects.push(createCellFrame(WARMUP_SCENE.cell, 1));
  const group = new Group();
  group.add(...objects);
  return { group, dispose: () => disposeGeometry(objects) };
}
