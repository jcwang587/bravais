import elementColors from "../data/element-colors.json";
import { ELEMENT_SYMBOLS } from "../structure/elements.js";
import {
  clampChromaToGamut,
  hexToOklab,
  oklabToHex,
  oklabToOklch,
  oklchToOklab,
  type Oklab,
  type Oklch,
} from "./oklab.js";

const BASE_COLORS = elementColors.elements as Record<string, string>;

/**
 * The base table gives a few elements that usually share a structure one and
 * the same colour: chromium and cobalt, vanadium and oxygen, fluorine and
 * nitrogen. The less common one of each pair gets a fixed refinement in the
 * same key, so those structures need no automatic adjustment. Every other
 * clash is left to the session palette below, since any further fixed
 * choice would clash with some other common partner.
 */
const ANCHOR_REFINEMENTS: Record<string, string> = {
  // Steel periwinkle, against cobalt's deep blue.
  Cr: "#6d87c9",
  // Crimson rose, against oxygen's red.
  V: "#bf4b62",
  // Pale aqua, against nitrogen's lavender.
  F: "#9bd7d0",
};

/**
 * Elements by how often they appear in refined inorganic structures. When
 * colours collide inside one structure, the earlier element keeps its
 * anchor and the later one moves. Elements not listed follow by atomic
 * number.
 */
const PRIORITY = [
  "O",
  "Li",
  "Na",
  "K",
  "Mg",
  "Ca",
  "Sr",
  "Ba",
  "Al",
  "Si",
  "Ti",
  "Mn",
  "Fe",
  "Co",
  "Ni",
  "Cu",
  "Zn",
  "V",
  "Cr",
  "Ga",
  "Ge",
  "Y",
  "Zr",
  "Nb",
  "Mo",
  "Ru",
  "Ag",
  "Cd",
  "In",
  "Sn",
  "Sb",
  "La",
  "Ce",
  "Nd",
  "Sm",
  "Gd",
  "Ta",
  "W",
  "Pt",
  "Au",
  "Pb",
  "Bi",
  "H",
  "C",
  "N",
  "F",
  "P",
  "S",
  "Cl",
  "Se",
  "Te",
  "I",
  "Br",
  "B",
  "Sc",
  "Rb",
  "Cs",
  "Hf",
  "Re",
  "Ir",
  "Pd",
  "Rh",
  "Os",
  "Pr",
  "Eu",
  "Tb",
  "Dy",
  "Ho",
  "Er",
  "Tm",
  "Yb",
  "Lu",
  "Th",
  "U",
];
const PRIORITY_RANK = new Map(
  PRIORITY.map((element, index) => [element, index]),
);

/** Two colours closer than this, in weighted OKLab, read as one. */
const MIN_DISTANCE = 0.1;
/** Shading already varies lightness on a sphere, so hue and chroma count more. */
const LIGHTNESS_WEIGHT = 0.7;
/** Adjusted colours stay in the palette's pastel band: never near white or black, never garish. */
const BAND = { minL: 0.45, maxL: 0.88, maxC: 0.2 };
/** Below this chroma a colour is a grey, whose hue means nothing. */
const GREY_CHROMA = 0.025;
/** A grey that must differ takes a dusty tint: this much chroma, this much darker. */
const TINT_CHROMA = 0.09;
const TINT_DARKENING = 0.1;

const HUE_OFFSETS = [
  0, 10, -10, 20, -20, 30, -30, 45, -45, 60, -60, 80, -80, 100, -100, 120, -120,
  150, -150, 180,
];
const LIGHTNESS_OFFSETS = [0, -0.05, 0.05, -0.1, 0.1, -0.15, 0.15, -0.2, 0.2];
/** Changes of vividness, as fractions of the chroma sRGB can show at a hue. */
const VIVIDNESS_OFFSETS = [0, 0.15, -0.15, 0.3];
const TINT_HUES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
/** Cost of one step in hue (degrees), lightness, and vividness. */
const HUE_STEP = 30;
const LIGHTNESS_STEP = 0.08;
const VIVIDNESS_STEP = 0.15;
/** Brightening a grey toward the background reads worse than darkening it. */
const BRIGHTENING_PENALTY = 1.5;
/** A grey darkens before it takes a tint: more than one darkening step, less than two. */
const TINT_COST = 2;

interface Candidate {
  lch: Oklch;
  lab: Oklab;
  cost: number;
}

function weightedDistance(p: Oklab, q: Oklab): number {
  const dL = (p.L - q.L) * LIGHTNESS_WEIGHT;
  return Math.hypot(dL, p.a - q.a, p.b - q.b);
}

function hashString(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619) >>> 0;
  }
  return hash;
}

/**
 * The anchor of an element: its refinement, else its base colour, else a
 * hue spread by the golden angle over the atomic number, so an element the
 * base table lacks still gets the same colour every time.
 */
function anchorHex(element: string): string | null {
  return ANCHOR_REFINEMENTS[element] ?? BASE_COLORS[element] ?? null;
}

function anchorColor(element: string): Oklch {
  const hex = anchorHex(element);
  if (hex) {
    return oklabToOklch(hexToOklab(hex));
  }
  const atomicNumber = ELEMENT_SYMBOLS.indexOf(element) + 1;
  const seed = atomicNumber > 0 ? atomicNumber : hashString(element);
  return { L: 0.68, C: 0.12, h: (seed * 137.508) % 360 };
}

function priorityRank(element: string): number {
  const listed = PRIORITY_RANK.get(element);
  if (listed !== undefined) {
    return listed;
  }
  const atomicNumber = ELEMENT_SYMBOLS.indexOf(element);
  return (
    PRIORITY.length +
    (atomicNumber >= 0 ? atomicNumber : ELEMENT_SYMBOLS.length)
  );
}

function withinBand(lch: Oklch): Oklch {
  return clampChromaToGamut({
    L: Math.min(BAND.maxL, Math.max(BAND.minL, lch.L)),
    C: Math.min(BAND.maxC, Math.max(0, lch.C)),
    h: ((lch.h % 360) + 360) % 360,
  });
}

/** The largest chroma sRGB can show at a lightness and hue. */
function maxChroma(L: number, h: number): number {
  return clampChromaToGamut({ L, C: 0.5, h }).C;
}

function candidate(lch: Oklch, cost: number): Candidate {
  const banded = withinBand(lch);
  return { lch: banded, lab: oklchToOklab(banded), cost };
}

/**
 * Colours near an anchor, cheapest first. A hue turn is cheaper than a
 * lightness step, which is cheaper than a change of vividness, so an
 * element keeps its character for as long as the palette allows. Turning
 * the hue keeps the anchor's vividness relative to what sRGB can show at
 * the new hue, so a soft green turns into a soft teal, not a loud one. A
 * grey anchor has no hue to turn; it darkens first, then takes a dusty tint.
 */
function candidatesAround(anchor: Oklch): Candidate[] {
  const candidates: Candidate[] = [];
  if (anchor.C < GREY_CHROMA) {
    for (const lightnessOffset of LIGHTNESS_OFFSETS) {
      const lightnessCost =
        (Math.abs(lightnessOffset) / LIGHTNESS_STEP) *
        (lightnessOffset > 0 ? BRIGHTENING_PENALTY : 1);
      candidates.push(
        candidate({ ...anchor, L: anchor.L + lightnessOffset }, lightnessCost),
      );
      for (const hue of TINT_HUES) {
        candidates.push(
          candidate(
            {
              L: anchor.L - TINT_DARKENING + lightnessOffset,
              C: TINT_CHROMA,
              h: hue,
            },
            TINT_COST + lightnessCost + hue / 3600,
          ),
        );
      }
    }
    return candidates.sort((left, right) => left.cost - right.cost);
  }
  const vividness = anchor.C / Math.max(1e-6, maxChroma(anchor.L, anchor.h));
  for (const hueOffset of HUE_OFFSETS) {
    for (const lightnessOffset of LIGHTNESS_OFFSETS) {
      for (const vividnessOffset of VIVIDNESS_OFFSETS) {
        const L = Math.min(
          BAND.maxL,
          Math.max(BAND.minL, anchor.L + lightnessOffset),
        );
        const h = anchor.h + hueOffset;
        const C =
          Math.min(1, Math.max(0.1, vividness + vividnessOffset)) *
          maxChroma(L, h);
        const cost =
          Math.abs(hueOffset) / HUE_STEP +
          Math.abs(lightnessOffset) / LIGHTNESS_STEP +
          Math.abs(vividnessOffset) / VIVIDNESS_STEP;
        candidates.push(candidate({ L, C, h }, cost));
      }
    }
  }
  return candidates.sort((left, right) => left.cost - right.cost);
}

interface Assignment {
  hex: string;
  lab: Oklab;
}

/**
 * The colours of the elements shown in this session. An element keeps its
 * colour from the moment it first appears, so a structure loaded later can
 * never recolour one loaded earlier; a newcomer whose anchor is too close to
 * a colour already on screen takes the nearest clearly different colour.
 * The outcome depends only on the order in which elements first appeared.
 */
const assigned = new Map<string, Assignment>();

/**
 * The anchor itself when it is clearly different from every colour on
 * screen; otherwise the cheapest candidate that is, taking the better
 * separated of equally cheap ones; otherwise the best separated of all.
 */
function choose(hex: string | null, anchor: Oklch): Assignment {
  const taken = [...assigned.values()].map((assignment) => assignment.lab);
  const separationFrom = (lab: Oklab) =>
    taken.reduce(
      (minimum, other) => Math.min(minimum, weightedDistance(lab, other)),
      Infinity,
    );
  const anchorLab = oklchToOklab(anchor);
  if (separationFrom(anchorLab) >= MIN_DISTANCE) {
    return { hex: hex ?? oklabToHex(anchorLab), lab: anchorLab };
  }
  let best: Candidate | null = null;
  let bestSeparation = -Infinity;
  let bestCost = Infinity;
  let fallback: Candidate | null = null;
  let fallbackSeparation = -Infinity;
  for (const entry of candidatesAround(anchor)) {
    const separation = separationFrom(entry.lab);
    if (separation >= MIN_DISTANCE) {
      if (
        entry.cost < bestCost - 1e-9 ||
        (Math.abs(entry.cost - bestCost) <= 1e-9 && separation > bestSeparation)
      ) {
        best = entry;
        bestCost = entry.cost;
        bestSeparation = separation;
      }
      if (entry.cost > bestCost + 1e-9) {
        break;
      }
    } else if (separation > fallbackSeparation) {
      fallback = entry;
      fallbackSeparation = separation;
    }
  }
  const chosen = best ?? fallback ?? { lab: anchorLab, lch: anchor, cost: 0 };
  return { hex: oklabToHex(chosen.lab), lab: chosen.lab };
}

/** Assign session colours to `elements` before drawing them, most common first. */
export function ensureElementColors(elements: readonly string[]): void {
  const newcomers = [...new Set(elements)]
    .filter((element) => !assigned.has(element))
    .sort((left, right) => priorityRank(left) - priorityRank(right));
  for (const element of newcomers) {
    assigned.set(element, choose(anchorHex(element), anchorColor(element)));
  }
}

/** The session colour of an element, assigned now if it is new. */
export function elementColor(element: string): string {
  const assignment = assigned.get(element);
  if (assignment) {
    return assignment.hex;
  }
  ensureElementColors([element]);
  return (assigned.get(element) as Assignment).hex;
}

/** Elements seen in this session with their colours, in order of first appearance. */
export function elementColorAssignments(): [string, string][] {
  return [...assigned].map(([element, assignment]) => [
    element,
    assignment.hex,
  ]);
}

/**
 * Forget the session's colours, for when every structure is cleared. The
 * palette is shared by every viewer and thumbnail renderer in the page,
 * which pick up new colours at their next draw.
 */
export function resetElementColors(): void {
  assigned.clear();
}
