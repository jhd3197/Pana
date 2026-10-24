// Stack up to four readable pieces before adding another column. Stable seat /
// piece ordering keeps both clients identical, and bounds stay inside the cell.
export function sharedCellLayout(count, index) {
  if (count <= 1) return { x: 0, y: 0, z: 0, scale: 1 };
  const stacks = Math.ceil(count / 4), columns = Math.ceil(Math.sqrt(stacks)), rows = Math.ceil(stacks / columns);
  const stack = Math.floor(index / 4), tier = index % 4;
  const row = Math.floor(stack / columns), inRow = Math.min(columns, stacks - row * columns);
  const spacing = .3 / columns;
  const scale = columns === 1 ? .9 : .84 / columns;
  return { x: (stack % columns - (inRow - 1) / 2) * spacing,
    y: tier * .48 * scale, z: (row - (rows - 1) / 2) * spacing, scale };
}
