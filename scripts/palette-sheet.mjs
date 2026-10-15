// Print the session palette for sample element sets as JSON, for a visual check.
// usage: node scripts/palette-sheet.mjs > sets.json  (run after npm run build)
import {
  elementColor,
  elementColorAssignments,
  ensureElementColors,
  resetElementColors,
} from "../dist/bravais.js";

const SETS = [
  ["Li", "Fe", "P", "O"],
  ["Ru", "Cr", "Ni", "Mn", "Co", "O"],
  ["Sr", "Co", "Ga", "O"],
  ["Li", "Ni", "Mn", "Co", "O"],
  ["Li", "La", "Zr", "O"],
  ["La", "Sr", "Mn", "O"],
  ["Y", "Ba", "Cu", "O"],
  ["Si", "Cu", "O"],
  ["Ni", "Ag", "Pd", "Pt", "Au"],
  ["N", "F", "Cl", "Sr", "Ba", "Zr"],
  ["Li", "Co", "Ni", "Mn", "Fe", "Cr", "V", "Ti", "Cu", "Zn", "Al", "Mg", "O"],
  ["Tb", "Dy", "Ho", "Er", "Tm", "Yb", "Lu", "O"],
];
const result = [];
for (const elements of SETS) {
  resetElementColors();
  ensureElementColors(elements);
  result.push({
    elements,
    colors: elements.map((element) => elementColor(element)),
  });
}
// A session: structures loaded one after another keep earlier colours.
resetElementColors();
const session = [];
for (const elements of [
  ["Cu", "O"],
  ["Si", "O"],
  ["Co", "O"],
  ["Cr", "Mn", "O"],
]) {
  ensureElementColors(elements);
  session.push({
    elements,
    colors: elements.map((element) => elementColor(element)),
  });
}
result.push({
  elements: elementColorAssignments().map(([e]) => e),
  colors: elementColorAssignments().map(([, c]) => c),
  label: "session",
});
console.log(JSON.stringify({ sets: result, session }, null, 1));
