# Third-party notices

bravais is MIT licensed (see `LICENSE`). It is built on, bundles, or carries
data from the following projects. Each entry says exactly what was taken.

## three.js

- Used for: all rendering (`src/render/`). three.js itself is a peer
  dependency the consumer installs; its TrackballControls addon is bundled
  into `dist/bravais.js`.
- Licence: MIT.
- https://threejs.org/

The MIT License

Copyright © 2010-2026 three.js authors

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

## moyo (`@spglib/moyo-wasm`)

- Used for: space-group operations and Hall-symbol settings when a CIF names
  a space group but lists no operators, and the symmetry analysis of
  structures, which gives the standard space group, Wyckoff letters and a
  standardized cell (`src/symmetry/`). The WebAssembly binary and its
  JavaScript glue are bundled into `dist/bravais.js`.
- Licence: MIT or Apache-2.0, used here under the MIT terms.
- https://github.com/spglib/moyo

MIT License

Copyright (c) 2023 Kohei Shinohara

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

## Pretty Lattice

- Used for: the default look of the viewer, carried over as constants and
  reimplemented in TypeScript. In detail: the "modern matte" material and
  lighting preset (`src/render/materials.ts`), the depth-fading amount and
  start (`src/render/viewer.ts`), the trackball feel (`src/render/viewer.ts`),
  the axis colours and proportions of the corner gizmo (`src/render/gizmo.ts`),
  the lit-sphere swatch of the element legend (`src/render/legend.ts`), the
  choice of Naumann's clinographic projection as the standard view
  (`src/render/camera.ts`), and the element colour table
  (`src/data/element-colors.json`), which is Pretty Lattice's softened
  version of VESTA's element colours. No Pretty Lattice source code is
  included as such; the values above were taken from it.
- Licence: MIT. Copyright (c) 2026 Feitong Song.
- https://github.com/songfeitong/pretty-lattice

MIT License

Copyright (c) 2026 Feitong Song

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

## pymatgen

- Used for: the bond-search cutoff table (`src/data/vesta-cutoffs.json`),
  taken from pymatgen's `vesta_cutoffs.yaml`. Where VESTA lists a pair twice
  (H-O, D-O), the shorter cutoff is kept.
- Licence: MIT.
- https://github.com/materialsproject/pymatgen

The MIT License (MIT)
Copyright (c) 2011-2012 MIT & The Regents of the University of California,
through Lawrence Berkeley National Laboratory

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

## VESTA

- The bond cutoffs and the base element colours above originate in VESTA
  (K. Momma and F. Izumi, "VESTA 3 for three-dimensional visualization of
  crystal, volumetric and morphology data", J. Appl. Crystallogr. 44,
  1272-1276 (2011)). They reached this package through pymatgen and Pretty
  Lattice as described above. The occupancy pies on shared sites follow
  VESTA's convention. VESTA itself is not open source and none of its code is
  used.
- https://jp-minerals.org/vesta/en/

## OKLab

- Used for: the colour distance and gamut math of the element palette
  (`src/render/oklab.ts`), implemented from Björn Ottosson's published OKLab
  and OKLCH formulas (2020), which he placed in the public domain.
- https://bottosson.github.io/posts/oklab/

## Test fixtures (`tests/fixtures/`)

Ten entries of the [Crystallography Open Database](https://www.crystallography.net/cod/), used unchanged. COD entries are free to use with attribution to the article the data came from:

- `CoO-9008618.cif`, rocksalt CoO: COD 9008618; Wyckoff, R. W. G., Crystal Structures 1, 85–237 (1963).
- `TiO2-9015662.cif`, rutile: COD 9015662; Howard, C. J.; Sabine, T. M.; Dickson, F., Acta Crystallographica, Section B 47, 462–468 (1991).
- `Co3O4-9005887.cif`, Co3O4 spinel: COD 9005887; Liu, X.; Prewitt, C. T., Physics and Chemistry of Minerals 17, 168–172 (1990).
- `CaTiO3-1567488.cif`, CaTiO3 perovskite: COD 1567488; Ali, R.; Yashima, M., Journal of Solid State Chemistry 178, 2867–2872 (2005).
- `CaCO3-1547350.cif`, calcite: COD 1547350; Nobuo Ishizawa; Hayato Setoguchi; Kazumichi Yanagisawa, Scientific Reports 3, 2832 (2013).
- `CaSO4-2H2O-2300259.cif`, gypsum, from neutron powder diffraction: COD 2300259; Henry, Paul F.; Weller, Mark T.; Wilson, Chick C., Journal of Applied Crystallography 42, 1176–1188 (2009).
- `NaAlSi3O8-9001630.cif`, low albite: COD 9001630; Downs, R. T.; Hazen, R. M.; Finger, L. W., American Mineralogist 79, 1042–1052 (1994).
- `LiNiMnCoO2-4002443.cif`, LiCo1/3Ni1/3Mn1/3O2 layered oxide: COD 4002443; Yin, S.-C.; Rho, Y.-H.; Swainson, I.; Nazar, L.F., Chemistry of Materials 18, 1901–1910 (2006).
- `aspirin-1515581.cif`, aspirin form II: COD 1515581; Varughese, Sunil; Kiran, M. S. R. N.; Solanko, Katarzyna A.; Bond, Andrew D.; Ramamurty, U.; Desiraju, Gautam R., Chemical Science 2, 2236 (2011).
- `faujasite-1507214.cif`, dehydrated sodium zeolite Y (faujasite): COD 1507214; Seo, S.M.; Kim, G.H.; Lee, H.S.; Ko, S.-O.; Lee, O.S.; Kim, Y.H.; Kim, S.H.; Heo, N.H.; Lim, W.T., Analytical Sciences: X-ray Structure Analysis Online 22, x209–x210 (2006).
