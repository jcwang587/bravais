# bravais

[![npm](https://img.shields.io/npm/v/bravais)](https://www.npmjs.com/package/bravais)
[![CI](https://github.com/jcwang587/bravais/actions/workflows/ci.yml/badge.svg)](https://github.com/jcwang587/bravais/actions/workflows/ci.yml)

A minimal crystal structure viewer for the web. Try the
[demo](https://jcwang.dev/bravais/).

## Install

```sh
npm install bravais three
```

## Use

```html
<div id="viewer" style="height: 480px"></div>
```

```js
import { buildScene, createViewer, expandStructure, readCif } from "bravais";

const response = await fetch(
  "https://raw.githubusercontent.com/materialsproject/pymatgen/v2026.9.24/test-files/cif/LiFePO4.cif",
);
const scene = buildScene(expandStructure(await readCif(await response.text())));
createViewer(document.getElementById("viewer")).setLayers([{ scene }]);
```

## Built with

- [three.js](https://threejs.org/) for rendering.
- [moyo](https://github.com/spglib/moyo) for space-group symmetry.
- [VESTA](https://jp-minerals.org/vesta/en/)'s bond cutoffs and occupancy
  pies, with the cutoff table from
  [pymatgen](https://github.com/materialsproject/pymatgen).
- Björn Ottosson's OKLab colour space, to keep element colours apart.

Thanks to Feitong Song's
[Pretty Lattice](https://github.com/songfeitong/pretty-lattice), whose look,
controls and softened element colours this viewer follows.

The code was written by Claude Code, under the author's direction and review.

## License

[MIT](LICENSE)
