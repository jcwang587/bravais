import {
  AlwaysStencilFunc,
  DataTexture,
  DoubleSide,
  LineBasicMaterial,
  MeshStandardMaterial,
  ReplaceStencilOp,
  type Material,
} from "three";

// Material and lighting currently follow Pretty Lattice's default (its
// "modern matte" preset).
export const METALNESS = 0.1;
export const ROUGHNESS = 0.6;
export const AMBIENT_LIGHT_INTENSITY = 0.8;
export const HEADLIGHT_INTENSITY = 2.2;
export const HEADLIGHT_OFFSET: readonly [number, number, number] = [
  0.3, 0.2, 0,
];
export const BACKGROUND_COLOR = "#fafafa";
export const CELL_FRAME_COLOR = "#444444";
/** The part of a partially occupied site nobody occupies: a faint, see-through tint. */
export const VACANCY_COLOR = "#f2f2f2";
export const VACANCY_OPACITY = 0.3;
/** Added to a vacancy texel's start fraction so the shader can tell it apart. */
export const VACANCY_FLAG = 2;

const TWO_PI = "6.28318530718";

/**
 * Insert code at includes of a three.js built-in shader, each `[include,
 * code]` replacing the include. A three.js release that renames or drops
 * one fails here by name, instead of drawing flat squares.
 */
function patchShader(
  shader: string,
  patches: [include: string, code: string][],
): string {
  return patches.reduce((source, [include, code]) => {
    if (!source.includes(include)) {
      throw new Error(
        `bravais cannot draw with this three.js: its shader has no ${include}.`,
      );
    }
    return source.replace(include, code);
  }, shader);
}

/**
 * Occupancy sectors live in a texture: each site owns a run of texels, each
 * holding the colour of one sector and the angle fraction where it begins.
 * The first sector takes the instance colour; the rest, and the vacancy,
 * come from the texels. Unused texels start at 1, which no angle reaches.
 */
export const SECTOR_TEXELS_PER_SITE = 8;
export const SECTOR_SITES_PER_ROW = 256;

/**
 * Atoms are ray-cast spheres. Each instance is a camera-facing quad of the
 * sphere's size; the fragment shader finds where the pixel's view ray meets
 * the sphere, writes that depth and shades with the sphere's normal. The
 * outline, and the cut where a bond enters, are then exact at any zoom, for
 * four vertices per atom. The cameras are orthographic, so the view ray is
 * the view z axis and the depth is linear in view z.
 */
function atomVertexShader(shader: string): string {
  return patchShader(shader, [
    [
      "#include <common>",
      `#include <common>
flat varying int vSectorSite;
flat varying vec3 vSphereCenter;
flat varying float vSphereRadius;
flat varying vec2 vDepthCoefficients;
varying vec3 vSpherePoint;`,
    ],
    [
      "#include <project_vertex>",
      `mat4 sphereMatrix = modelViewMatrix * instanceMatrix;
vSphereCenter = sphereMatrix[3].xyz;
vSphereRadius = length(sphereMatrix[0].xyz);
vSpherePoint = vSphereCenter + vec3(position.xy * vSphereRadius, 0.0);
vDepthCoefficients = vec2(projectionMatrix[2][2], projectionMatrix[3][2]);
vSectorSite = gl_InstanceID;
vec4 mvPosition = vec4(vSpherePoint, 1.0);
gl_Position = projectionMatrix * mvPosition;`,
    ],
  ]);
}

function atomFragmentShader(shader: string): string {
  return patchShader(shader, [
    [
      "#include <common>",
      `#include <common>
uniform sampler2D sectorTexture;
uniform float vacancyOpacity;
flat varying int vSectorSite;
flat varying vec3 vSphereCenter;
flat varying float vSphereRadius;
flat varying vec2 vDepthCoefficients;
varying vec3 vSpherePoint;`,
    ],
    [
      "#include <clipping_planes_fragment>",
      `// Where the view ray meets the sphere. The outline is smoothed over one
// pixel through the alpha: sample coverage, or blending in a see-through layer.
vec2 sphereOffset = vSpherePoint.xy - vSphereCenter.xy;
float sphereDistance = length(sphereOffset);
float sphereCoverage = clamp(
  (vSphereRadius - sphereDistance) / max(fwidth(sphereDistance), 1e-6) + 0.5,
  0.0,
  1.0
);
if (sphereCoverage <= 0.0) {
  discard;
}
float sphereHeight = sqrt(
  max(0.0, vSphereRadius * vSphereRadius - dot(sphereOffset, sphereOffset))
);
vec3 sphereNormal = vec3(sphereOffset, sphereHeight) / vSphereRadius;
float sphereZ = vSphereCenter.z + sphereHeight;
gl_FragDepth = (vDepthCoefficients.x * sphereZ + vDepthCoefficients.y) * 0.5 + 0.5;
#include <clipping_planes_fragment>`,
    ],
    [
      "#include <color_fragment>",
      `#include <color_fragment>
{
  // A pie chart facing the viewer, like VESTA's occupancy pies: the instance
  // colour fills the first sector from 12 o'clock clockwise, then each
  // texel's colour from its stop on.
  float sectorAngle = fract(atan(sphereOffset.x, sphereOffset.y) / ${TWO_PI});
  vec3 sectorColor = vColor.rgb;
  float sectorOpacity = 1.0;
  int sectorRow = vSectorSite / ${SECTOR_SITES_PER_ROW};
  int sectorColumn = (vSectorSite - sectorRow * ${SECTOR_SITES_PER_ROW}) * ${SECTOR_TEXELS_PER_SITE};
  for (int k = 0; k < ${SECTOR_TEXELS_PER_SITE}; k++) {
    vec4 sector = texelFetch(sectorTexture, ivec2(sectorColumn + k, sectorRow), 0);
    bool vacant = sector.a >= ${VACANCY_FLAG}.0;
    float start = vacant ? sector.a - ${VACANCY_FLAG}.0 : sector.a;
    if (sectorAngle >= start) {
      sectorColor = sector.rgb;
      sectorOpacity = vacant ? vacancyOpacity : 1.0;
    }
  }
  diffuseColor.rgb = diffuse * sectorColor;
  diffuseColor.a *= sectorOpacity * sphereCoverage;
}`,
    ],
    [
      "#include <normal_fragment_begin>",
      `#include <normal_fragment_begin>
normal = sphereNormal;
nonPerturbedNormal = normal;`,
    ],
  ]);
}

/**
 * Atom material: the matte preset drawing ray-cast spheres with occupancy
 * sectors read from `sectorTexture`. A layer with vacancies is blended so
 * their sectors show what lies behind; one without stays on the opaque path
 * and smooths its outlines through sample coverage.
 */
export function createAtomMaterial(
  opacity: number,
  sectorTexture: DataTexture,
  hasVacancies: boolean,
): MeshStandardMaterial {
  const transparent = opacity < 1 || hasVacancies;
  const material = new MeshStandardMaterial({
    color: "#ffffff",
    metalness: METALNESS,
    roughness: ROUGHNESS,
    opacity,
    transparent,
    alphaToCoverage: !transparent,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.sectorTexture = { value: sectorTexture };
    shader.uniforms.vacancyOpacity = { value: VACANCY_OPACITY };
    shader.vertexShader = atomVertexShader(shader.vertexShader);
    shader.fragmentShader = atomFragmentShader(shader.fragmentShader);
  };
  material.customProgramCacheKey = () => "bravais-atom-spheres";
  return material;
}

/**
 * Bonds are ray-cast tubes, one half per instance. Each instance is the box
 * around its half; the fragment shader finds where the pixel's view ray
 * enters the solid tube, which is cut on the atom's sphere at the atom end
 * and flat at the bond midpoint, writes that depth and shades with the
 * surface normal. The wall, the cut where a tube meets its sphere and every
 * crossing with another sphere are then exact at any zoom.
 */
function bondVertexShader(shader: string): string {
  return patchShader(shader, [
    [
      "#include <common>",
      `#include <common>
uniform float capRadius;
flat varying vec3 vTubeCenter;
flat varying vec3 vTubeAxis;
flat varying vec3 vAtomCenter;
flat varying float vTubeRadius;
flat varying float vTubeHalfLength;
flat varying vec2 vDepthCoefficients;
varying vec3 vBoxPoint;`,
    ],
    [
      "#include <project_vertex>",
      `mat4 tubeMatrix = modelViewMatrix * instanceMatrix;
float tubeLength = max(length(tubeMatrix[1].xyz), 1e-6);
vTubeRadius = length(tubeMatrix[0].xyz);
vTubeHalfLength = tubeLength * 0.5;
vTubeCenter = tubeMatrix[3].xyz;
vTubeAxis = tubeMatrix[1].xyz / tubeLength;
float rim = sqrt(max(0.0, capRadius * capRadius - vTubeRadius * vTubeRadius));
vAtomCenter = vTubeCenter - vTubeAxis * (rim + vTubeHalfLength);
vDepthCoefficients = vec2(projectionMatrix[2][2], projectionMatrix[3][2]);
vec4 mvPosition = tubeMatrix * vec4(position, 1.0);
vBoxPoint = mvPosition.xyz;
gl_Position = projectionMatrix * mvPosition;`,
    ],
  ]);
}

function bondFragmentShader(shader: string): string {
  return patchShader(shader, [
    [
      "#include <common>",
      `#include <common>
uniform float capRadius;
flat varying vec3 vTubeCenter;
flat varying vec3 vTubeAxis;
flat varying vec3 vAtomCenter;
flat varying float vTubeRadius;
flat varying float vTubeHalfLength;
flat varying vec2 vDepthCoefficients;
varying vec3 vBoxPoint;`,
    ],
    [
      "#include <clipping_planes_fragment>",
      `// The view ray through this pixel runs down view z. The tube's surface is
// the nearest of: the wall outside the atom's sphere, the sphere's far side
// inside the tube (the cut face) and the midpoint disc. Along the ray,
// q(z) = p(z) - centre has q.a = k + (z - cz) a.z and |q|^2 = u + (z - cz)^2.
vec2 tubePixel = vBoxPoint.xy;
vec2 tubeOffset = tubePixel - vTubeCenter.xy;
float tubeK = dot(tubeOffset, vTubeAxis.xy);
float tubeU = dot(tubeOffset, tubeOffset);
float axisZ = vTubeAxis.z;
float quadA = 1.0 - axisZ * axisZ;
float quadB = -2.0 * tubeK * axisZ;
float quadC = tubeU - tubeK * tubeK - vTubeRadius * vTubeRadius;
float tubeRadius2 = vTubeRadius * vTubeRadius;
// The ray's closest approach to the axis, for the outline's coverage.
float axisDistance2 = tubeU - tubeK * tubeK;
if (quadA > 1e-6) {
  axisDistance2 -= quadB * quadB / (4.0 * quadA);
}
float axisDistance = sqrt(max(0.0, axisDistance2));
float tubeCoverage = clamp(
  (vTubeRadius - axisDistance) / max(fwidth(axisDistance), 1e-6) + 0.5,
  0.0,
  1.0
);
if (tubeCoverage <= 0.0) {
  discard;
}
float tubeHitZ = -1e30;
vec3 tubeNormal = vec3(0.0, 0.0, 1.0);
if (quadA > 1e-6) {
  float discriminant = quadB * quadB - 4.0 * quadA * quadC;
  if (discriminant >= 0.0) {
    float z = vTubeCenter.z + (-quadB + sqrt(discriminant)) / (2.0 * quadA);
    vec3 d = vec3(tubePixel, z) - vTubeCenter;
    float s = dot(d, vTubeAxis);
    if (abs(s) <= vTubeHalfLength && distance(vec3(tubePixel, z), vAtomCenter) >= capRadius) {
      tubeHitZ = z;
      tubeNormal = (d - s * vTubeAxis) / vTubeRadius;
    }
  }
}
if (axisZ > 1e-6) {
  float z = vTubeCenter.z + (vTubeHalfLength - tubeK) / axisZ;
  vec3 d = vec3(tubePixel, z) - vTubeCenter;
  if (dot(d, d) - vTubeHalfLength * vTubeHalfLength <= tubeRadius2 && z > tubeHitZ &&
      distance(vec3(tubePixel, z), vAtomCenter) >= capRadius) {
    tubeHitZ = z;
    tubeNormal = vTubeAxis;
  }
}
{
  vec2 m = tubePixel - vAtomCenter.xy;
  float inside = capRadius * capRadius - dot(m, m);
  if (inside >= 0.0) {
    float z = vAtomCenter.z - sqrt(inside);
    vec3 d = vec3(tubePixel, z) - vTubeCenter;
    float s = dot(d, vTubeAxis);
    if (abs(s) <= vTubeHalfLength && dot(d, d) - s * s <= tubeRadius2 && z > tubeHitZ) {
      tubeHitZ = z;
      tubeNormal = (vAtomCenter - vec3(tubePixel, z)) / capRadius;
    }
  }
}
if (tubeHitZ < -1e29) {
  discard;
}
gl_FragDepth = (vDepthCoefficients.x * tubeHitZ + vDepthCoefficients.y) * 0.5 + 0.5;
#include <clipping_planes_fragment>`,
    ],
    [
      "#include <color_fragment>",
      `#include <color_fragment>
diffuseColor.a *= tubeCoverage;`,
    ],
    [
      "#include <normal_fragment_begin>",
      `#include <normal_fragment_begin>
normal = tubeNormal;
nonPerturbedNormal = normal;`,
    ],
  ]);
}

/**
 * Bond material: the matte preset drawing ray-cast tubes cut on their atoms'
 * spheres of radius `capRadius`.
 */
export function createBondMaterial(
  opacity: number,
  capRadius: number,
): MeshStandardMaterial {
  const transparent = opacity < 1;
  const material = new MeshStandardMaterial({
    color: "#ffffff",
    metalness: METALNESS,
    roughness: ROUGHNESS,
    opacity,
    transparent,
    alphaToCoverage: !transparent,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.capRadius = { value: capRadius };
    shader.vertexShader = bondVertexShader(shader.vertexShader);
    shader.fragmentShader = bondFragmentShader(shader.fragmentShader);
  };
  material.customProgramCacheKey = () => "bravais-bond-tubes";
  return material;
}

export function createCellFrameMaterial(opacity: number): LineBasicMaterial {
  return new LineBasicMaterial({
    color: CELL_FRAME_COLOR,
    opacity,
    transparent: true,
    fog: false,
  });
}

/** Stencil value the gizmo's arrows leave on every pixel they cover. */
export const GIZMO_AXIS_STENCIL = 1;

/**
 * A gizmo surface. `stencilRef` is written wherever the surface is the one
 * seen: GIZMO_AXIS_STENCIL for the arrows, 0 for the origin ball, so the
 * axis letters can tell what they are drawn over.
 */
export function createGizmoMaterial(
  color: string,
  stencilRef: number,
): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    metalness: 0,
    roughness: 0.8,
    side: DoubleSide,
    stencilWrite: true,
    stencilRef,
    stencilFunc: AlwaysStencilFunc,
    stencilZPass: ReplaceStencilOp,
  });
}

export function disposeMaterial(material: Material | Material[]): void {
  for (const entry of Array.isArray(material) ? material : [material]) {
    entry.dispose();
  }
}
