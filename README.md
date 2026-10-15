# bravais

[![npm](https://img.shields.io/npm/v/bravais)](https://www.npmjs.com/package/bravais)
[![CI](https://github.com/jcwang587/bravais/actions/workflows/ci.yml/badge.svg)](https://github.com/jcwang587/bravais/actions/workflows/ci.yml)

A crystal structure viewer for the browser: read a CIF, apply its symmetry,
draw it with three.js.

## Install

```sh
npm install bravais three
```

## Use

```js
import { buildScene, createViewer, expandStructure, readCif } from "bravais";

const structure = await readCif(cifText);
const scene = buildScene(expandStructure(structure));
createViewer(document.getElementById("viewer")).setLayers([{ scene }]);
```

`npm run demo` opens a viewer on the test structures. Development and release
steps are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Built with

- [three.js](https://threejs.org/): rendering, as a peer dependency.
- [moyo](https://github.com/spglib/moyo): space-group
  operations, bundled as WebAssembly.
- [pymatgen](https://github.com/materialsproject/pymatgen): the VESTA
  bond cutoff table.
- [VESTA](https://jp-minerals.org/vesta/en/): the origin of those cutoffs, of
  the occupancy-pie convention, and of the element colours, used here in
  Pretty Lattice's softened version (below).
- OKLab: Björn Ottosson's public-domain colour formulas. They supply no
  colours: they measure how alike two colours look, and move an element's
  colour only when it would clash with one already on screen.

Thanks to [Pretty Lattice](https://github.com/songfeitong/pretty-lattice)
by Feitong Song, whose look this viewer follows: its material and
lighting, depth fading, trackball feel, gizmo, legend swatch, standard view
and element colour table.

Full licences, and exactly what was taken from each project, are in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The code was written by Claude Code, under the author's direction and review.

## License

[MIT](LICENSE)
