/**
 * OKLab and OKLCH (Björn Ottosson, 2020): a colour space where Euclidean
 * distance tracks perceived difference, so the palette can reason about
 * "clearly different" colours.
 */
export interface Oklab {
  L: number;
  a: number;
  b: number;
}

/** Lightness, chroma and hue in degrees. */
export interface Oklch {
  L: number;
  C: number;
  h: number;
}

function srgbToLinear(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel: number): number {
  return channel <= 0.0031308
    ? channel * 12.92
    : 1.055 * channel ** (1 / 2.4) - 0.055;
}

export function hexToOklab(hex: string): Oklab {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = srgbToLinear(((value >> 16) & 255) / 255);
  const g = srgbToLinear(((value >> 8) & 255) / 255);
  const b = srgbToLinear((value & 255) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/** Linear sRGB of an OKLab colour; channels may fall outside [0, 1]. */
function oklabToLinearRgb(lab: Oklab): [number, number, number] {
  const l = (lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b) ** 3;
  const m = (lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b) ** 3;
  const s = (lab.L - 0.0894841775 * lab.a - 1.291485548 * lab.b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function isInGamut(lab: Oklab): boolean {
  return oklabToLinearRgb(lab).every(
    (channel) => channel >= -1e-4 && channel <= 1 + 1e-4,
  );
}

export function oklabToHex(lab: Oklab): string {
  const hex = oklabToLinearRgb(lab).map((channel) => {
    const srgb = linearToSrgb(Math.min(1, Math.max(0, channel)));
    return Math.round(srgb * 255)
      .toString(16)
      .padStart(2, "0");
  });
  return `#${hex.join("")}`;
}

export function oklabToOklch(lab: Oklab): Oklch {
  const C = Math.hypot(lab.a, lab.b);
  const h = ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360;
  return { L: lab.L, C, h };
}

export function oklchToOklab(lch: Oklch): Oklab {
  const radians = (lch.h * Math.PI) / 180;
  return {
    L: lch.L,
    a: lch.C * Math.cos(radians),
    b: lch.C * Math.sin(radians),
  };
}

/** The same hue and lightness with the chroma reduced until sRGB can show it. */
export function clampChromaToGamut(lch: Oklch): Oklch {
  if (isInGamut(oklchToOklab(lch))) {
    return lch;
  }
  let low = 0;
  let high = lch.C;
  for (let step = 0; step < 24; step += 1) {
    const middle = (low + high) / 2;
    if (isInGamut(oklchToOklab({ ...lch, C: middle }))) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return { ...lch, C: low };
}
