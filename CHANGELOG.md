# Changelog

## 0.2.0 - 2026-10-20

- The first structure shows sooner, and the page no longer freezes while it
  waits: the viewer and the thumbnail renderer compile all their shaders at
  once when they are created, so the driver compiles them in parallel. On an
  M2 Max with nothing cached, the first frame comes after 0.4 s instead of
  0.7 s, and the longest freeze is 0.1 s instead of 0.65 s.
- Right after a viewer is created, while its shaders compile, `setLayers` and
  `render` draw once the shaders are ready instead of before they return.
- The README example runs as written: it gives the viewer's container a height
  and loads `examples/CoO.cif`, a COD structure the package now ships.

## 0.1.4 - 2026-10-19

- Switching structures is faster: the viewer keeps its compiled shaders
  instead of compiling them again, builds the axes once instead of leaking a
  new set on every switch, and resizes the canvas only when its size changes.
- The README, the package description and the doc comments are shorter and
  plainer.

## 0.1.3 - 2026-10-19

- A layer at opacity 0 is no longer drawn but still frames the view, so a
  viewer switching between two states of a structure keeps one centre and
  scale.
- moyo is a separate file, `dist/moyo-wasm.js`, loaded the first time a
  structure needs it, so `dist/bravais.js` shrinks from 1.1 MB to 87 kB. A
  CIF with an operator loop never loads it.
- Large structures read, expand and bond in about linear time: a P1 cell of
  27,000 atoms reads in 0.1 s instead of 5.6 s and expands in 0.03 s
  instead of 12 s.
- Bonds are listed by `start`, then `end`.
- `latticeFromParameters` and `latticeFromVectors` are exported, to build a
  structure from cell parameters or vectors.
- A thumbnail centres on its view's target when the target is not the
  origin.
- If three.js drops or renames a shader include that bravais patches, drawing
  fails with an error naming the include, instead of showing flat squares.
- `package.json` marks the package free of side effects and exports itself.
- The third-party notices credit three.js for the bundled TrackballControls
  addon.

## 0.1.2 - 2026-10-16

- README revised.

## 0.1.1 - 2026-10-16

- The TrackballControls addon is bundled, so the module's only bare import is
  `three`.

## 0.1.0 - 2026-10-15

First public release.

- Reads CIFs, applying the file's operator loop or the space-group operations
  from moyo when the loop is missing.
- `symmetryDataset(structure)`: moyo's analysis of the atoms, with the
  standard space group and its Hall setting, Wyckoff letters, site
  symmetries, and the structure in the standard cell.
- `typesetSymbol(symbol)`: a Hermann-Mauguin symbol as textbooks print it,
  Fm3̅m and P2₁/c, from the ASCII forms of moyo, spglib and CIF files.
- A rhombohedral symbol without `:H` or `:R` is read in the setting the
  listed atoms fit, or the cell shape selects. A file whose atoms are listed
  already expanded but do not close under its operations is refused instead
  of being drawn wrong.
- Expands the structure, repeats boundary sites as image atoms, and finds
  bonds with VESTA's cutoff table.
- Renders with three.js: ray-cast atoms, closed bond tubes, occupancy pies on
  shared sites, the cell frame, depth fading, and a trackball with inertia.
- A session element palette kept distinct in OKLab, an element legend, an a,
  b, c axes gizmo whose letters turn white over the arrows, layered viewers
  with transferable view states, and a shared thumbnail renderer.
