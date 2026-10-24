// Keep every pawn inside its shared cell, at the same height. Stable ordering
// is supplied by seat then piece; the final short row stays centered.
export function sharedCellLayout(count, index) {
  if (count <= 1) return { x: 0, z: 0, scale: 1 };
  const columns = Math.ceil(Math.sqrt(count)), rows = Math.ceil(count / columns);
  const row = Math.floor(index / columns), inRow = Math.min(columns, count - row * columns);
  const spacing = .3 / columns;
  return { x: (index % columns - (inRow - 1) / 2) * spacing,
    z: (row - (rows - 1) / 2) * spacing, scale: .84 / columns };
}
