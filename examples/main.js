// The demo imports the sources so `npm run demo` rebuilds on change. In an
// app the same names come from the package: import { ... } from "bravais".
import {
  buildScene,
  createViewer,
  expandStructure,
  readCif,
  symmetryDataset,
  typesetSymbol,
} from "../src/index.ts";

const FIXTURES = [
  "CoO-9008618.cif",
  "TiO2-9015662.cif",
  "Co3O4-9005887.cif",
  "CaTiO3-1567488.cif",
  "CaCO3-1547350.cif",
  "CaSO4-2H2O-2300259.cif",
  "NaAlSi3O8-9001630.cif",
  "CoTiO3-5910080.cif",
  "LiNiMnCoO2-4002443.cif",
  "aspirin-1515581.cif",
  "faujasite-1507214.cif",
];

const viewer = createViewer(document.getElementById("viewer"));
const status = document.getElementById("status");
const fixtureSelect = document.getElementById("fixture");
const fileInput = document.getElementById("file");
let structure = null;

for (const name of FIXTURES) {
  const option = document.createElement("option");
  option.value = name;
  option.textContent = name;
  fixtureSelect.append(option);
}

function scene() {
  return buildScene(expandStructure(structure));
}

async function load(text, name) {
  try {
    structure = await readCif(text);
    viewer.setLayers([{ scene: scene() }]);
    const symmetry = await symmetryDataset(structure);
    status.textContent = `${name}: ${structure.sites.length} sites, ${symmetry.operations.length} operations, ${typesetSymbol(symmetry.symbol)} (${symmetry.number})`;
  } catch (error) {
    status.textContent = `${name}: ${error.message}`;
  }
}

async function loadFixture(name) {
  const response = await fetch(`../tests/fixtures/${name}`);
  await load(await response.text(), name);
}

fixtureSelect.addEventListener("change", () =>
  loadFixture(fixtureSelect.value),
);
fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (file) {
    await load(await file.text(), file.name);
  }
});
document.getElementById("reset").addEventListener("click", () => {
  viewer.resetView();
});

loadFixture(FIXTURES[0]);
