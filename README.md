# bravais

[![npm](https://img.shields.io/npm/v/bravais)](https://www.npmjs.com/package/bravais)
[![CI](https://github.com/jcwang587/bravais/actions/workflows/ci.yml/badge.svg)](https://github.com/jcwang587/bravais/actions/workflows/ci.yml)

A crystal structure viewer for the browser: read a CIF, apply its symmetry,
draw it with three.js.

## Install

```sh
npm install bravais three
```

three.js is a peer dependency. bravais is an ES module for browsers with
WebGL 2 and WebAssembly: one 1.1 MB file (420 kB gzipped) with moyo's
WebAssembly binary inlined, so it needs no served asset and works from
`file://`. TypeScript declarations are included. Reading and analysing
structures needs no DOM and runs under Node as well.

## Use

```html
<div id="viewer" style="height: 480px"></div>
```

```js
import { buildScene, createViewer, expandStructure, readCif } from "bravais";

const structure = await readCif(cifText);
const scene = buildScene(expandStructure(structure));
const viewer = createViewer(document.getElementById("viewer"));
viewer.setLayers([{ scene }]);
```

The viewer fills its container and follows its size, so give the element a
height. In TypeScript, narrow the element first: `getElementById` returns
`HTMLElement | null`.

## API

Reading a CIF:

- `readCif(text)`: the first data block with atom coordinates, with its
  symmetry operations resolved from the file's operator loop or its space
  group. Occupancies that add up to more than one on a site are scaled down.
- `parseCif(text)`, `parseCifStructure(block)`,
  `parseSymmetryOperator(text)`: the steps behind it, for files that need
  more care.

Symmetry:

- `symmetryDataset(structure, { symprec })`: moyo's analysis of the atoms
  themselves, whatever the file said: space-group number and symbols, Hall
  number and setting, crystal system, operations, a Wyckoff letter and site
  symmetry per site, the expanded structure and the standard cell.
  `symprec` is the distance tolerance in ångström, 0.01 by default.
- `operationsForSpaceGroup(info)`: the operations of a named space group.
- `typesetSymbol(symbol)`: `F m -3 m` as Fm3̅m, `P 21/c` as P2₁/c.
- `ensureMoyo()`: instantiate the WebAssembly module ahead of first use.

Drawing:

- `expandStructure(structure)`: every atom of the cell, as a P1 structure.
- `buildScene(structure, { imageAtoms })`: atoms, bonds and cell as drawn;
  `structureElements(structure)` lists the elements present.
- `createViewer(container, { legend, gizmo })`: a viewer. `setLayers`
  draws one or more `{ scene, opacity }` layers; `getView` and `setView`
  carry a pose between viewers; `resetView`, `resize`, `onInteraction`
  and `dispose` do what they say.
- `createThumbnailRenderer()`: one shared WebGL context that paints
  previews into ordinary canvases.
- `elementColor`, `ensureElementColors`, `elementColorAssignments`,
  `resetElementColors`: the session palette, kept distinct in OKLab.

Errors: `readCif` throws `CifSyntaxError` for text that is not CIF,
`CifStructureError` for a CIF without a usable structure, and
`SpaceGroupLookupError` for a space group the table does not know;
`symmetryDataset` throws `SymmetryAnalysisError` when moyo cannot analyse
the atoms. Each message names the cause.

## Development

```sh
npm install
npm run demo           # a viewer on the test structures
npm run check          # tsc and Prettier
npm test
npm run build          # dist/
npm run check:package  # publint and arethetypeswrong on the package
```

To release, date the entry in `CHANGELOG.md`, commit, then run
`npm version <x.y.z>` and `git push --follow-tags`. The release workflow
publishes to npm through trusted publishing and opens a GitHub release. The
first version was published by hand with `npm publish --access public`,
since npm only lets a trusted publisher be added to a package that exists.

## Built with

- [three.js](https://threejs.org/), MIT: rendering, as a peer dependency.
- [moyo](https://github.com/spglib/moyo), MIT, copyright 2023 Kohei
  Shinohara: space-group operations, bundled as WebAssembly. Its binary also
  links Rust crates under the MIT and Apache 2.0 licences.
- [pymatgen](https://github.com/materialsproject/pymatgen), MIT, copyright
  2011-2012 MIT and The Regents of the University of California: the VESTA
  bond cutoff table.
- [VESTA](https://jp-minerals.org/vesta/en/): the origin of those cutoffs, of
  the occupancy-pie convention, and of the element colours, used here in
  Pretty Lattice's softened version (below).
- OKLab: Björn Ottosson's public-domain colour formulas. They supply no
  colours: they measure how alike two colours look, and move an element's
  colour only when it would clash with one already on screen.

Thanks to [Pretty Lattice](https://github.com/songfeitong/pretty-lattice)
by Feitong Song, MIT, copyright 2026 Feitong Song, whose look this viewer
follows: its material and lighting, depth fading, trackball feel, gizmo,
legend swatch, standard view and element colour table.

The MIT text in [LICENSE](LICENSE) is the licence of each MIT project above,
under its own copyright line.

The code was written by Claude Code, under the author's direction and review.

## License

[MIT](LICENSE)
