// La Plaza: Pepazo's town square. Renderer-free, so the server's collision, the
// bots' grid, the minimap and the scene's props all read the same rows.
//
// Metres, final court coordinates (the 54 m court, fence at ±27). Orange
// (team 0) starts on the north half (−z), turquoise on the south (+z). Every
// layout is mirror-symmetric in x and in z, so it is also the same plaza turned
// half a turn: both teams always get the same cover (tests/plaza-layout.test.js).
//
//   centre     the glorieta (raised bandstand, a solid 1.3 m plinth) at the origin
//   spine      a bench and a low fountain between the glorieta and each base
//   square     planters, trees and closed market booths around it
//   flanks     a portico of pillars at x ±17.5 and the street behind it
//   bases      a low wall beside each flag, a building corner and a back booth
//   perimeter  the alley inside the fence (|x| or |z| over 23.3) stays open
//
// A row is { kind, x, z, w, d, h, height }: `kind` picks the prop the scene
// draws (plaza-props.js) inside exactly that box. Rows at or under SHOT_HEIGHT
// (1.1 m: benches, planters, fountains, low walls, carts) let level shots pass.

// Footprint and height per kind. Low ones (h <= 1.1) let shots over.
export const PLAZA_KINDS = {
  kiosk: { w: 4.6, d: 4.6, h: 1.3 },
  fountain: { w: 4.2, d: 4.2, h: .8 },
  bench: { w: 2.4, d: .7, h: .85 },
  planter: { w: 1.6, d: 1.6, h: .7 },
  tree: { w: .6, d: .6, h: 3.2 },
  stall: { w: 3.2, d: 1.8, h: 2.3 },
  car: { w: 2, d: 4.4, h: 1.5 },
  cart: { w: 1.6, d: 1.1, h: 1 },
  wall: { w: 4, d: .6, h: 1 },
  corner: { w: 3.6, d: .8, h: 2.8 },
  pillar: { w: 1, d: 1, h: 3.2 },
  crate: { w: 2.4, d: 2.4, h: 2.4 },
  stage: { w: 4.6, d: 3.4, h: 1.2 },
};
// One row of `kind` at (x, z); `turn` swaps its footprint (a booth along z).
const row = (kind, x, z, { turn = false, ...extra } = {}) => {
  const k = PLAZA_KINDS[kind], w = extra.w ?? (turn ? k.d : k.w), d = extra.d ?? (turn ? k.w : k.d), h = extra.h ?? k.h;
  return { kind, x, z, w, d, h, height: h, ...(turn ? { turn: true } : {}) };
};
// Every row in all four quadrants: (±x, ±z), once on an axis.
function mirror(rows) {
  const out = [], key = o => `${o.kind}:${o.x}:${o.z}`, seen = new Set();
  for (const o of rows) for (const sx of [1, -1]) for (const sz of [1, -1]) {
    const m = { ...o, x: o.x * sx || 0, z: o.z * sz || 0 };
    if (!seen.has(key(m))) { seen.add(key(m)); out.push(m); }
  }
  return out;
}

// The quadrant x ≥ 0, z ≥ 0 that every layout shares: the glorieta, the
// portico, the corners and booths that frame each base.
const FRAME = [
  row('kiosk', 0, 0),
  row('bench', 0, 5.2),
  row('tree', 5, 10),
  row('wall', 14, 0, { w: .8, d: 3.6, h: 2.6 }),
  ...[4, 11, 18].map(z => row('pillar', 17.5, z)),
  row('wall', 4.8, 19.2, { w: 3.6 }),
  row('corner', 10.5, 16),
  row('stall', 11, 21.5, { w: 3.4, d: 1.6 }),
];

// Clásica: low fountains on the spine, planters and booths in the square,
// cars parked in the flank streets, a fruit cart behind each base.
const CLASICA = mirror([
  ...FRAME,
  row('fountain', 0, 10.2),
  row('planter', 6, 5.4),
  row('stall', 10.2, 5.6, { turn: true }),
  row('car', 21.5, 7.5),
  row('cart', 16, 21.5),
]);

// Mercado: market day. The flank streets close for booths and carts, the
// square fills with carts and the cross streets in front of the bases get
// booths: shorter sight lines, more corners to fight round.
const MERCADO = mirror([
  ...FRAME,
  row('fountain', 0, 10.2),
  row('cart', 6, 5.4),
  row('stall', 10.2, 5.6, { turn: true }),
  row('stall', 21.5, 7.5, { turn: true }),
  row('cart', 21.4, 14.5, { turn: true }),
  row('stall', 9.4, 11.8),
  row('cart', 16, 21.5),
]);

// Fiesta: a tarima (stage) replaces each fountain, so the spine stops shots;
// stacks of drink crates take the flank streets and the square's corners.
const FIESTA = mirror([
  ...FRAME,
  row('stage', 0, 10.2),
  row('planter', 6, 5.4),
  row('stall', 10.2, 5.6, { turn: true }),
  row('crate', 21.5, 7.5, { w: 2 }),
  row('crate', 21.5, 14.2, { w: 2, d: 2, h: 1.6 }),
  row('crate', 9.5, 11.5, { w: 1.6, d: 1.6, h: 1.6 }),
  row('cart', 16, 21.5),
]);

export const PLAZA_COVERS = [CLASICA, MERCADO, FIESTA];
