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

Add a container with a height:

```html
<div id="viewer" style="height: 480px"></div>
```

Then read a CIF and visualize it:

```js
import { buildScene, createViewer, expandStructure, readCif } from "bravais";

const response = await fetch("https://unpkg.com/bravais/examples/CoO.cif");
const scene = buildScene(expandStructure(await readCif(await response.text())));
createViewer(document.getElementById("viewer")).setLayers([{ scene }]);
```

A structure read elsewhere, such as by a CIF reader in another language, can
be given as plain data instead, with its symmetry operations, its space group,
or neither when the sites list every atom of the cell:

```js
import { readStructure } from "bravais";

const structure = await readStructure({
  lattice: { a: 4.26, b: 4.26, c: 4.26, alpha: 90, beta: 90, gamma: 90 },
  sites: [
    { label: "Co", fractional: [0, 0, 0], species: [{ element: "Co" }] },
    { label: "O", fractional: [0.5, 0.5, 0.5], species: [{ element: "O" }] },
  ],
  spaceGroup: { symbol: "F m -3 m" },
});
```

`readStructure` checks the data and throws `StructureDataError` for anything
missing or malformed; the result works everywhere a structure from `readCif`
does.

## Built with

- [three.js](https://threejs.org/) for rendering.
- [moyo](https://github.com/spglib/moyo) for space-group symmetry.
- [VESTA](https://jp-minerals.org/vesta/en/)'s bond cutoffs and occupancy
  pies, with the cutoff table from
  [pymatgen](https://github.com/materialsproject/pymatgen).
- Björn Ottosson's [OKLab](https://bottosson.github.io/posts/oklab/) colour
  space, to keep element colours apart.

Thanks to Feitong Song's
[Pretty Lattice](https://github.com/songfeitong/pretty-lattice), whose look,
controls and softened element colours this viewer follows.

The code was written by Claude Code, under the author's direction and review.

## License

[MIT](LICENSE)
