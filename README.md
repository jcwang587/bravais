# bravais

[![npm](https://img.shields.io/npm/v/bravais)](https://www.npmjs.com/package/bravais)
[![CI](https://github.com/jcwang587/bravais/actions/workflows/ci.yml/badge.svg)](https://github.com/jcwang587/bravais/actions/workflows/ci.yml)

A crystal structure viewer for the browser: read a CIF, apply its symmetry,
draw it with three.js.

## Install

```sh
npm install bravais three
```

An ES module for browsers with WebGL 2 and WebAssembly. moyo's WebAssembly
binary is inlined, so the package is one 1.1 MB file that needs no served
asset. TypeScript declarations are included.

## Use

```html
<div id="viewer" style="height: 480px"></div>
```

```js
import { buildScene, createViewer, expandStructure, readCif } from "bravais";

const structure = await readCif(cifText);
const scene = buildScene(expandStructure(structure));
createViewer(document.getElementById("viewer")).setLayers([{ scene }]);
```

The viewer fills its container, so give the element a height. Also exported:
`symmetryDataset` (moyo's analysis: space group, Wyckoff letters, standard
cell), `typesetSymbol` (`P 21/c` as P2₁/c), `createThumbnailRenderer`, the
element palette (`elementColor`, `resetElementColors`), and the error classes
`CifSyntaxError`, `CifStructureError`, `SpaceGroupLookupError` and
`SymmetryAnalysisError`. Every export carries a doc comment.

## Built with

- [three.js](https://threejs.org/), MIT: rendering, as a peer dependency.
- [moyo](https://github.com/spglib/moyo), MIT, copyright 2023 Kohei
  Shinohara: space-group operations, bundled as WebAssembly together with
  its Rust dependencies (MIT and Apache 2.0).
- [pymatgen](https://github.com/materialsproject/pymatgen), MIT, copyright
  2011-2012 MIT and The Regents of the University of California: the VESTA
  bond cutoff table.
- [VESTA](https://jp-minerals.org/vesta/en/): the origin of those cutoffs,
  the occupancy-pie convention and the element colours.
- OKLab: Björn Ottosson's public-domain colour formulas, used to keep
  element colours apart.
- [Pretty Lattice](https://github.com/songfeitong/pretty-lattice) by Feitong
  Song, MIT, copyright 2026: the look this viewer follows, and its softened
  VESTA colours.

Each MIT project above is licensed under the MIT text in [LICENSE](LICENSE)
with its own copyright line. The code was written by Claude Code, under the
author's direction and review.

## License

[MIT](LICENSE)
