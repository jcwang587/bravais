/** Element symbols in atomic-number order. */
export const ELEMENT_SYMBOLS = [
  "H",
  "He",
  "Li",
  "Be",
  "B",
  "C",
  "N",
  "O",
  "F",
  "Ne",
  "Na",
  "Mg",
  "Al",
  "Si",
  "P",
  "S",
  "Cl",
  "Ar",
  "K",
  "Ca",
  "Sc",
  "Ti",
  "V",
  "Cr",
  "Mn",
  "Fe",
  "Co",
  "Ni",
  "Cu",
  "Zn",
  "Ga",
  "Ge",
  "As",
  "Se",
  "Br",
  "Kr",
  "Rb",
  "Sr",
  "Y",
  "Zr",
  "Nb",
  "Mo",
  "Tc",
  "Ru",
  "Rh",
  "Pd",
  "Ag",
  "Cd",
  "In",
  "Sn",
  "Sb",
  "Te",
  "I",
  "Xe",
  "Cs",
  "Ba",
  "La",
  "Ce",
  "Pr",
  "Nd",
  "Pm",
  "Sm",
  "Eu",
  "Gd",
  "Tb",
  "Dy",
  "Ho",
  "Er",
  "Tm",
  "Yb",
  "Lu",
  "Hf",
  "Ta",
  "W",
  "Re",
  "Os",
  "Ir",
  "Pt",
  "Au",
  "Hg",
  "Tl",
  "Pb",
  "Bi",
  "Po",
  "At",
  "Rn",
  "Fr",
  "Ra",
  "Ac",
  "Th",
  "Pa",
  "U",
  "Np",
  "Pu",
  "Am",
  "Cm",
  "Bk",
  "Cf",
  "Es",
  "Fm",
  "Md",
  "No",
  "Lr",
  "Rf",
  "Db",
  "Sg",
  "Bh",
  "Hs",
  "Mt",
  "Ds",
  "Rg",
  "Cn",
  "Nh",
  "Fl",
  "Mc",
  "Lv",
  "Ts",
  "Og",
];

const ELEMENTS = new Set(ELEMENT_SYMBOLS);

/** Deuterium keeps its own symbol for display and counts as hydrogen. */
const DEUTERIUM = "D";

/** True for an element symbol as written, such as "Fe", or "D" for deuterium. */
export function isElementSymbol(symbol: string): boolean {
  return ELEMENTS.has(symbol) || symbol === DEUTERIUM;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * The element behind a CIF atom label or type symbol: `Fe3+`, `O2-`, `Co1`,
 * `OW`, `fe` and `Wat` all resolve. Null when no element symbol fits.
 */
export function elementFromCifSymbol(raw: string): string | null {
  const letters = raw.match(/^[A-Za-z]{1,2}/)?.[0];
  if (!letters) {
    return null;
  }
  const two = capitalize(letters);
  if (letters.length === 2 && isElementSymbol(two)) {
    return two;
  }
  const one = letters.charAt(0).toUpperCase();
  return isElementSymbol(one) ? one : null;
}

/** The chemical element, with deuterium reported as hydrogen. */
export function chemicalElement(symbol: string): string {
  return symbol === DEUTERIUM ? "H" : symbol;
}
