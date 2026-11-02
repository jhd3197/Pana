// El Puerto: Pepazo's long container terminal, two team bases facing across
// the yard. Renderer-free, so the server's collision and the scene's
// containers, shed and base gear read the same rows.
// Metres. x runs from the orange base (west) to the turquoise base (east),
// z from the warehouses (north, -Z) to the quay and the sea (south, +Z).
export const TERMINAL_BOUNDS = { x: 58, z: 32 };
// Sized like the library's shippingContainer (its box is length + .3 by 2.55 by 2.65).
export const CONTAINER = { h: 2.65, w: 2.44, lengths: { 40: 12.2, 20: 6.1 } };
// Each base: a painted pad, its four spawn pads and the team's gear.
export const BASES = [{ x: -52, side: -1 }, { x: 52, side: 1 }];
export const BASE = { depth: 9, halfWidth: 14 };
// The open steel shed in the middle; its mezzanine covers the north half.
export const SHED = { w: 18, d: 14, roof: 9.5, deck: 5.18, mezzanine: [-7, -.6] };
// Layouts list only the west half: [x, z, turned, feet, levels]. turned puts the
// long side along z. A row at x = 0 sits on the centre line and is not mirrored.
const HALVES = [[
  [-30, -20, 0, 40, 2], [-30, 20, 0, 40, 2], [-25, 0, 1, 40, 2],
  [-15, -13, 0, 40, 1], [-15, 13, 0, 40, 1], [-38, -7, 1, 20, 1], [-38, 7, 1, 20, 1],
  [-43, -22, 1, 20, 1], [-43, 22, 1, 20, 1], [-13, -26, 0, 20, 1], [-13, 26, 0, 20, 1],
  [0, -20, 0, 40, 1], [0, 20, 0, 40, 1],
], [
  [-19, 0, 1, 40, 2], [-24, -12, 0, 40, 2], [-24, 12, 0, 40, 2],
  [-31, -5, 1, 20, 1], [-31, 5, 1, 20, 1],
  [-40, -6.7, 0, 20, 1], [-40, 6.7, 0, 20, 1], [-12, -22, 0, 40, 1], [-12, 22, 0, 40, 1],
  [-34, -25, 0, 40, 1], [-34, 25, 0, 40, 1], [-45, 0, 1, 20, 1],
], [
  [-12.3, -19, 0, 20, 1], [-14.2, -12, 1, 20, 2], [-21, -26, 1, 20, 1], [-24, -17, 0, 40, 1],
  [-32, -24, 1, 20, 1], [-37, -16, 0, 20, 2], [-43, -9.2, 1, 20, 1], [-30, -9, 1, 20, 1],
  [-22, -4, 0, 20, 1], [-12.3, 16, 0, 20, 1], [-14.2, 9, 1, 20, 2], [-21, 26, 1, 20, 1],
  [-24, 17, 0, 40, 1], [-32, 24, 1, 20, 1], [-37, 16, 0, 20, 2], [-43, 9.2, 1, 20, 1],
  [-30, 9, 1, 20, 1], [-22, 4, 0, 20, 1], [-40, 0, 1, 20, 1],
]];
// Pasillos, Fortaleza and Laberinto: both teams always get the same yard.
export const TERMINAL_STACKS = HALVES.map(half => half.flatMap(([x, z, turned, feet, levels]) =>
  (x === 0 ? [x] : [x, -x]).map(x => ({ x, z, turned: !!turned, feet, levels }))));
export const stackBox = ({ x, z, turned, feet, levels }) => {
  const long = CONTAINER.lengths[feet] + .3, wide = CONTAINER.w + .16, h = levels * CONTAINER.h;
  return turned ? { x, z, w: wide, d: long, h, height: h } : { x, z, w: long, d: wide, h, height: h };
};
const post = (x, z, size, h) => ({ x, z, w: size, d: size, h, height: h, kind: 'post' });
// The shed's eight columns, the two posts under the mezzanine and a sandbag
// half wall in two runs across its open south half.
const SHED_COVER = [
  ...[-SHED.w / 2, -SHED.w / 6, SHED.w / 6, SHED.w / 2].flatMap(x => [-SHED.d / 2, SHED.d / 2].map(z => post(x, z, .6, SHED.roof))),
  ...[-SHED.w / 6, SHED.w / 6].map(x => post(x, SHED.mezzanine[1] - .2, .5, SHED.deck)),
  ...[-1, 1].map(s => ({ x: s * 4.5, z: SHED.d / 2 - 3, w: 6.6, d: .8, h: .7, height: .7, kind: 'sandbags' })),
];
// Each base keeps its ammo pile under the canopy and two barrel groups in front.
const BASE_COVER = BASES.flatMap(({ x, side }) => [
  { x: x + side * 2, z: 13, w: 2.4, d: 2.4, h: .7, height: .7, kind: 'ammo' },
  ...[-8, 8].map(z => ({ x: x - side * 6.9, z, w: 3, d: 2.6, h: 1, height: 1, kind: 'barrels' })),
]);
const gap = (a, b) => Math.max(Math.abs(a.x - b.x) - (a.w + b.w) / 2, Math.abs(a.z - b.z) - (a.d + b.d) / 2);
// Barrels that would close a passage in a layout stay off that layout.
export const TERMINAL_COVERS = TERMINAL_STACKS.map(stacks => {
  const cover = [...stacks.map(stackBox), ...SHED_COVER];
  for (const o of BASE_COVER) if (cover.every(c => gap(c, o) >= 2.4)) cover.push(o);
  return cover;
});
// Even seats spawn in the west half, odd seats in the east; the first two are the flag homes.
// The first eight are the four pads of each base, 6 m apart. Free-for-all needs
// eight panas 20 m apart (spawn-picker.js MIN_SPAWN_GAP), so each half adds three
// more in pairs mirrored through the centre: the two back corners of the base and a
// forward pad by the yard, clear of every layout's containers.
const OUTPOSTS = [[-55, -27], [-55, 27], [-34, -12]];
export const TERMINAL_SPAWNS = [
  ...[-9, 9, -3, 3].flatMap(z => BASES.map(({ x, side }) => ({ x: x + side * 2.5, z }))),
  ...OUTPOSTS.flatMap(([x, z]) => [{ x, z }, { x: -x, z: -z }]),
];
