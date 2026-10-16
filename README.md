# bravais

[![npm](https://img.shields.io/npm/v/bravais)](https://www.npmjs.com/package/bravais)
[![CI](https://github.com/jcwang587/bravais/actions/workflows/ci.yml/badge.svg)](https://github.com/jcwang587/bravais/actions/workflows/ci.yml)

A crystal structure viewer for the web.

## Install

```sh
npm install bravais three
```

An ES module for any page with WebGL 2 and WebAssembly: browsers, Electron,
Tauri and other web views.

## Use

```js
import { buildScene, createViewer, expandStructure, readCif } from "bravais";

const scene = buildScene(expandStructure(await readCif(cifText)));
createViewer(document.getElementById("viewer")).setLayers([{ scene }]);
```

## Built with

- [three.js](https://threejs.org/): rendering, as a peer dependency.
- [moyo](https://github.com/spglib/moyo): space-group
  operations, bundled as WebAssembly.
- [VESTA](https://jp-minerals.org/vesta/en/): the bond cutoffs, the element
  colours, used here in Pretty Lattice's softened version, and the
  occupancy pies.
- [pymatgen](https://github.com/materialsproject/pymatgen): the copy of
  VESTA's cutoff table this package ships.
- OKLab: Björn Ottosson's public-domain colour formulas. They supply no
  colours: they measure how alike two colours look, and move an element's
  colour only when it would clash with one already on screen.

Thanks to Feitong Song's
[Pretty Lattice](https://github.com/songfeitong/pretty-lattice), which this
viewer follows in its lighting and materials, depth fading, trackball feel,
axes gizmo, legend swatch, standard view and softened element colours.

The code was written by Claude Code, under the author's direction and review.

## License

[MIT](LICENSE)
