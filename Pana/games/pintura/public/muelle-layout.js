// Muelle de La Guaira: Pepazo's container yard. Renderer-free, so the server's
// collision and the scene's stacked containers read the same rows.
// Metres; the sea and quay are at -Z, the colonial street at +Z.
export const MUELLE_SIZE = 32;
// [x, z, axis, levels, length]: a stack of shipping containers lying along X or Z.
// Three fixed yards, one per round: Patio (mixed stacks), Laberinto (long
// container walls with crossing gaps) and Torres (few, tall, open lanes).
export const STACK_SETS = [[
  [-19, -17, 'x', 2, 12.2], [-3, -17, 'x', 1, 12.2], [14, -16, 'x', 3, 12.2],
  [-26, -4, 'z', 1, 12.2], [-12, -6, 'z', 2, 12.2], [3, -7, 'x', 1, 12.2], [20, -4, 'z', 2, 12.2],
  [-2, 5, 'x', 2, 12.2], [-18, 10, 'x', 1, 12.2], [13, 9, 'x', 2, 12.2], [27, 12, 'z', 1, 12.2],
  [-6, 18, 'z', 1, 12.2], [6, 20, 'x', 1, 12.2], [22, -25, 'z', 1, 6.1], [24, 22, 'x', 2, 6.1],
], [
  [-19.75, -16, 'x', 2, 12.2], [-3.75, -16, 'x', 1, 12.2], [12.25, -16, 'x', 3, 12.2], [25.2, -16, 'x', 1, 6.1],
  [-25.3, -6, 'x', 2, 6.1], [-12.35, -6, 'x', 1, 12.2], [3.65, -6, 'x', 2, 12.2], [19.65, -6, 'x', 1, 12.2],
  [-17.75, 4, 'x', 3, 12.2], [-1.75, 4, 'x', 1, 12.2], [14.25, 4, 'x', 2, 12.2],
  [-25.3, 14, 'x', 1, 6.1], [-12.35, 14, 'x', 2, 12.2], [3.65, 14, 'x', 1, 12.2], [19.65, 14, 'x', 3, 12.2],
  [-14, -11, 'x', 1, 6.1], [18, -11, 'x', 1, 6.1], [-22, -1, 'x', 1, 6.1], [6, -1, 'x', 2, 6.1], [-6, 9, 'x', 1, 6.1], [24, 9, 'x', 1, 6.1],
], [
  [-20, -14, 'z', 3, 12.2], [0, -15, 'x', 4, 6.1], [20, -14, 'z', 3, 12.2],
  [-10, 0, 'x', 2, 12.2], [10, 0, 'x', 2, 12.2],
  [-20, 14, 'z', 4, 6.1], [0, 15, 'x', 3, 12.2], [20, 14, 'z', 3, 12.2],
  [12, -24, 'x', 1, 6.1], [28, -14, 'z', 1, 6.1],
]];
export const STACKS = STACK_SETS[0];
// The gantry crane straddles the court's quay edge; its two inner legs are cover.
export const CRANE = { x: -11, z: -34 };
// Fruit and fish stalls where the street meets the yard.
export const STALLS = [[-21, 26], [-13, 27], [16, 27]];
export const MUELLE_SPAWNS = [{ x: -29, z: -29 }, { x: 29, z: 29 }, { x: 29, z: -29 }, { x: -29, z: 29 }, { x: 8, z: -29 }, { x: 0, z: 29 }, { x: -30, z: 6 }, { x: 29, z: 0 }];
export const stackBox = ([x, z, axis, levels, length]) => {
  const long = length + .3, wide = 2.6, h = levels * 2.65;
  return axis === 'x' ? { x, z, w: long, d: wide, h, height: h } : { x, z, w: wide, d: long, h, height: h };
};
const FIXED = [
  ...[-13, 13].map(dx => ({ x: CRANE.x + dx, z: CRANE.z + 9, w: 2.2, d: 5, h: 3.2, height: 3.2 })),
  ...STALLS.map(([x, z]) => ({ x, z, w: 3.2, d: 2.4, h: 2.4, height: 2.4 })),
];
export const MUELLE_COVERS = STACK_SETS.map(stacks => [...stacks.map(stackBox), ...FIXED]);
export const MUELLE_COVER = MUELLE_COVERS[0];
