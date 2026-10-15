# Changelog

## 0.1.0

First public release.

- Reads CIFs, applying the file's operator loop or the space-group operations
  from moyo when the loop is missing.
- `symmetryDataset(structure)`: moyo's analysis of the atoms, with the
  standard space group and its Hall setting, Wyckoff letters, site
  symmetries, and the structure in the standard cell.
- `typesetSymbol(symbol)`: a Hermann-Mauguin symbol as textbooks print it,
  Fm3̄m and P2₁/c, from the ASCII forms of moyo, spglib and CIF files.
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
