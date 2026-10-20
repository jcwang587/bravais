# Third-party notices

bravais is MIT licensed (see [LICENSE](LICENSE)). It ships material from the
four MIT-licensed projects below, bundled into `dist/`, and one example
structure file. Each project is reproduced with its copyright notice, and the
MIT permission notice at the end applies to all four.

## three.js

The TrackballControls addon of [three.js](https://github.com/mrdoob/three.js)
is bundled, used under its MIT licence. three.js itself is a peer dependency
and is not bundled.

Copyright © 2010-2026 three.js authors

## moyo

The space-group operations and the symmetry analysis come from the
WebAssembly build of [moyo](https://github.com/spglib/moyo), used under its
MIT licence.

Copyright (c) 2023 Kohei Shinohara

## pymatgen

The bond cutoff table (`src/data/vesta-cutoffs.json`) is copied from
[pymatgen](https://github.com/materialsproject/pymatgen)'s
`vesta_cutoffs.yaml`. The values originate in VESTA (K. Momma and F. Izumi).

Copyright (c) 2011-2012 MIT & The Regents of the University of California,
through Lawrence Berkeley National Laboratory

## Pretty Lattice

The element colour table (`src/data/element-colors.json`) is
[Pretty Lattice](https://github.com/songfeitong/pretty-lattice)'s softened
version of VESTA's element colours.

Copyright (c) 2026 Feitong Song

## Example structure

`examples/CoO.cif`, the structure the README example loads, is entry 9008618
of the [Crystallography Open Database](https://www.crystallography.net/cod/),
shipped unchanged. Its header asks that the source of the data be credited:
R. W. G. Wyckoff, _Crystal Structures_, vol. 1, 2nd ed., Interscience
Publishers, New York, 1963.

## MIT permission notice

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
